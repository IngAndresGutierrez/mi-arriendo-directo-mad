/**
 * Los recordatorios de la entrevista: un día antes y diez minutos antes, por campana, correo y
 * WhatsApp, sin repetirse y sin despertar a nadie por una cita que no se confirmó.
 */
import { chromium } from "playwright";
import { adminAuth, adminDb, adminFieldValue, BASE, config, createAccount, ok, settled } from "./lib.mjs";
import { readFileSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const RAIZ = joinPath(dirname(fileURLToPath(import.meta.url)), "..", "..");

/*
 * El Admin SDK de `lib.mjs`, no uno propio: este driver se inicializaba solo con la cuenta de
 * servicio *real*, así que contra los emuladores le preguntaba al proyecto de verdad por una cuenta
 * recién creada en el emulador y moría con `USER_NOT_FOUND` en la aserción cero.
 */
const db = adminDb();
const FieldValue = adminFieldValue();
const auth = adminAuth();

/*
 * De `.env.local` solo hace falta una cosa, y no es una credencial de Firebase: el secreto del cron,
 * que es lo que el propio servidor exige para dejar correr la barrida.
 */
const SECRETO = (process.env.CRON_SECRET ?? "").trim() || leerCronSecret();
if (!SECRETO) throw new Error("falta CRON_SECRET en el entorno o en .env.local");

function leerCronSecret() {
  try {
    return (
      readFileSync(joinPath(RAIZ, ".env.local"), "utf8")
        .split("\n")
        .find((l) => l.startsWith("CRON_SECRET="))
        ?.slice("CRON_SECRET=".length)
        .replace(/^"|"$/g, "") ?? ""
    );
  } catch {
    return "";
  }
}

async function cuenta(email, nombre, role) {
  const r = await createAccount(API_KEY, email);
  await db.collection("users").doc(r.localId).set({
    fullName: nombre, role, email, phone: "+573001234567", phoneCountry: "CO",
    gender: "female", birthDate: "1990-05-10",
    address: { line: "Calle 1 # 2-3", city: "Manizales", department: "Caldas" },
    termsAcceptedAt: new Date().toISOString(), createdAt: FieldValue.serverTimestamp(),
  });
  await auth.setCustomUserClaims(r.localId, { role });
  return r.localId;
}

const dueñoEmail = `rec-owner-${STAMP}@miarriendodirecto.test`;
const inqEmail = `rec-tenant-${STAMP}@miarriendodirecto.test`;
const dueño = await cuenta(dueñoEmail, "Ana Propietaria Pérez", "landlord");
const inquilino = await cuenta(inqEmail, "Carlos Inquilino Ramírez", "tenant");

const propiedad = await db.collection("properties").add({
  title: `Apartamento con balcón en Palermo ${STAMP}`, slug: `balcon-palermo-${STAMP}`,
  description: "Dos habitaciones, cocina integral y zona de ropas.", type: "apartment",
  rent: 1800000, adminFee: 0, areaM2: 70, bedrooms: 2, bathrooms: 2, parking: "yes", stratum: 4,
  furnished: false, petsAllowed: true, minLeaseMonths: 12, availableFrom: "2026-12-01",
  status: "available", photos: [],
  area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
  landlordUid: dueño, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
});
await db.collection("propertySlugs").doc(`balcon-palermo-${STAMP}`).set({ propertyId: propiedad.id });

const dossier = {
  documentType: "cc", documentNumber: "1053812345", occupation: "employee", employer: "Crehana",
  monthlyIncome: 6000000, householdSize: 2, hasPets: false, petsDescription: "",
  reference: { name: "Carolina Restrepo", phone: "+573009876543", phoneCountry: "CO", relationship: "Jefe directo" },
};
async function proceso({ minutosAntes, confirmada = true }) {
  const cita = new Date(Date.now() + minutosAntes * 60_000);
  const ref = await db.collection("applications").add({
    propertyId: propiedad.id, propertySlug: `balcon-palermo-${STAMP}`,
    propertyTitle: `Apartamento con balcón en Palermo ${STAMP}`, propertyCity: "Manizales",
    monthlyCost: 1800000, landlordUid: dueño, tenantUid: inquilino,
    tenantName: "Carlos Inquilino Ramírez", stage: "interview", status: "open",
    dossier, desiredMoveIn: "2026-12-01", leaseMonths: 12, message: "", closingNote: "",
    checksAuthorizedAt: null, documentReviews: {}, checkResults: {}, history: [],
    interview: {
      at: cita.toISOString(), channel: "meet", link: "https://meet.google.com/abc-defg-hij",
      note: "", proposedAt: new Date().toISOString(),
      confirmedAt: confirmada ? new Date().toISOString() : null,
      declinedAt: null, declineNote: "", feedback: null,
    },
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref;
}
const barrer = () =>
  fetch(`${BASE}/api/cron/interview-reminders`, { headers: { Authorization: `Bearer ${SECRETO}` } })
    .then((r) => r.json());
const avisos = async (uid, tipo) =>
  (await db.collection("notifications").where("recipientUid", "==", uid).where("type", "==", tipo).get()).size;

// ---------- una cita a nueve minutos ----------
const yaCasi = await proceso({ minutosAntes: 9 });
let r = await barrer();
if (r.sent < 1) throw new Error("no envió el recordatorio inminente: " + JSON.stringify(r));
const marcadas = (await yaCasi.get()).data().interview.remindersSent ?? [];
if (!marcadas.includes("ten_minutes")) throw new Error("no anotó el recordatorio enviado");
if (!marcadas.includes("day_before")) throw new Error("no descartó el de un día antes, que ya no aplica");
ok("a nueve minutos manda el de 10 minutos y descarta el de un día antes", JSON.stringify(marcadas));

for (const [quien, uid] of [["inquilino", inquilino], ["propietario", dueño]]) {
  if ((await avisos(uid, "interview_reminder_soon")) !== 1) throw new Error(`al ${quien} no le llegó, o le llegó doble`);
}
ok("les llega a los dos, una sola vez");

// ---------- el barrido se repite sin repetir avisos ----------
r = await barrer();
if (r.sent !== 0) throw new Error("el segundo barrido volvió a enviar: " + JSON.stringify(r));
if ((await avisos(inquilino, "interview_reminder_soon")) !== 1) throw new Error("duplicó el aviso");
ok("un segundo barrido no manda nada", JSON.stringify(r));

// ---------- una cita para mañana ----------
const mañana = await proceso({ minutosAntes: 23 * 60 });
r = await barrer();
const deMañana = (await mañana.get()).data().interview.remindersSent ?? [];
if (JSON.stringify(deMañana) !== JSON.stringify(["day_before"])) {
  throw new Error("la de mañana no recibió solo el de un día antes: " + JSON.stringify(deMañana));
}
if ((await avisos(inquilino, "interview_reminder_day")) !== 1) throw new Error("no llegó el de mañana");
ok("a 23 horas manda solo el de un día antes", JSON.stringify(deMañana));

// ---------- lo que no se debe recordar ----------
const sinConfirmar = await proceso({ minutosAntes: 9, confirmada: false });
const pasada = await proceso({ minutosAntes: -5 });
const lejana = await proceso({ minutosAntes: 3 * 24 * 60 });
r = await barrer();
for (const [nombre, ref] of [["sin confirmar", sinConfirmar], ["ya empezada", pasada], ["a tres días", lejana]]) {
  const enviados = (await ref.get()).data().interview.remindersSent ?? [];
  if (enviados.length) throw new Error(`recordó una cita ${nombre}: ${JSON.stringify(enviados)}`);
}
ok("no recuerda una cita sin confirmar, ya empezada, ni a tres días");

// ---------- y el inquilino lo ve en la campana ----------
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push(String(e)));
await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(inqEmail);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 25000 });
await settled(p);
await p.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
const texto = await p.evaluate(() => document.body.innerText);
if (!texto.includes("Tu entrevista empieza en 10 minutos")) throw new Error("la campana no muestra el recordatorio inminente");
if (!texto.includes("Mañana tienes la entrevista")) throw new Error("la campana no muestra el de mañana");
if (!texto.includes("el enlace a mano")) throw new Error("el recordatorio no dice qué hacer");
ok("la campana muestra los dos recordatorios, con lo que hay que hacer");
await p.screenshot({ path: `${SHOT_DIR}/recordatorios.png`, clip: { x: 500, y: 0, width: 600, height: 520 } });
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
