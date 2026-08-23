/**
 * Siembra tres arriendos (uno en curso avanzado, uno en curso recién llegado, dos cerrados) y
 * fotografía /arriendos desde el lado del propietario y del inquilino.
 */
import { chromium } from "playwright";
import { BASE, config, settled } from "./lib.mjs";
import { readFileSync } from "node:fs";
// firebase-admin vive en el proyecto, playwright aquí: cada uno se resuelve desde su sitio.
import { createRequire } from "node:module";
const requireDelProyecto = createRequire(
  "/Users/andresgutierrez/Projects/proptech/mi-arriendo-directo/package.json",
);
const { cert, initializeApp } = requireDelProyecto("firebase-admin/app");
const { getFirestore, FieldValue } = requireDelProyecto("firebase-admin/firestore");
const { getAuth } = requireDelProyecto("firebase-admin/auth");

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


const env = Object.fromEntries(
  readFileSync("/Users/andresgutierrez/Projects/proptech/mi-arriendo-directo/.env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

async function cuenta(email) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }),
  }).then((r) => r.json());
  return r.localId;
}

const dueñoEmail = `shot-owner-${STAMP}@miarriendodirecto.test`;
const inquilinoEmail = `shot-tenant-${STAMP}@miarriendodirecto.test`;
const dueño = await cuenta(dueñoEmail);
const inquilino = await cuenta(inquilinoEmail);

for (const [uid, fullName, role, email] of [
  [dueño, "Ana Propietaria Pérez", "landlord", dueñoEmail],
  [inquilino, "Carlos Inquilino Ramírez", "tenant", inquilinoEmail],
]) {
  await db.collection("users").doc(uid).set({
    fullName, role, email, phone: "+573001234567", phoneCountry: "CO",
    gender: "female", birthDate: "1990-05-10",
    address: { line: "Calle 1 # 2-3", city: "Manizales", department: "Caldas" },
    termsAcceptedAt: new Date().toISOString(), createdAt: FieldValue.serverTimestamp(),
  });
  await getAuth().setCustomUserClaims(uid, { role });
}

const dossier = {
  documentNumber: "1053812345", occupation: "employee", employer: "Crehana",
  monthlyIncome: 6000000, occupants: 2, hasPets: false,
  referenceName: "Carolina Restrepo", referenceRelation: "Jefe directo",
  referencePhone: "+573009876543", referencePhoneCountry: "CO",
};

const propiedades = [
  ["Apartamento Palermo luminoso", "apartamento-palermo-luminoso", 1800000],
  ["Apartaestudio Alcázares", "apartaestudio-alcazares", 1400000],
  ["Apartamento moderno La Francia", "apartamento-moderno-la-francia", 2200000],
];
const ids = [];
for (const [title, slug, rent] of propiedades) {
  const ref = await db.collection("properties").add({
    title, slug, description: "Dos habitaciones, cocina integral y zona de ropas.",
    type: "apartment", rent, adminFee: 0, areaM2: 70, bedrooms: 2, bathrooms: 2,
    parking: "yes", stratum: 4, furnished: false, petsAllowed: true, minLeaseMonths: 12,
    availableFrom: "2026-10-01", status: "available", photos: [],
    area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
    landlordUid: dueño, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("propertySlugs").doc(slug).set({ propertyId: ref.id });
  ids.push(ref.id);
}

const base = {
  landlordUid: dueño, tenantUid: inquilino, tenantName: "Carlos Inquilino Ramírez",
  propertyCity: "Manizales", dossier, desiredMoveIn: "2026-10-01", leaseMonths: 12,
  message: "", checksAuthorizedAt: null, documentReviews: {}, checkResults: {},
  history: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
};
await db.collection("applications").add({
  ...base, propertyId: ids[0], propertySlug: propiedades[0][1], propertyTitle: propiedades[0][0],
  monthlyCost: 1800000, stage: "background_check", status: "open", closingNote: "",
});
await db.collection("applications").add({
  ...base, propertyId: ids[1], propertySlug: propiedades[1][1], propertyTitle: propiedades[1][0],
  monthlyCost: 1400000, stage: "tenant_data", status: "rejected",
  closingNote: "Perfil financiero insuficiente.",
});
await db.collection("applications").add({
  ...base, propertyId: ids[2], propertySlug: propiedades[2][1], propertyTitle: propiedades[2][0],
  monthlyCost: 2200000, stage: "active", status: "open", closingNote: "",
});

async function fotografiar(email, nombre) {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(page);
  await page.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("ClaveDePrueba1");
  await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
  await page.waitForURL(/\/inicio/, { timeout: 25000 });
await settled(page);
  await page.getByRole("link", { name: "Arriendos", exact: true }).first().click();
  await page.waitForURL(/\/arriendos$/, { timeout: 20000 });
  await settled(page);
  await page.waitForSelector("h1", { timeout: 10000 });
  await page.screenshot({ path: `${SHOT_DIR}/arriendos-${nombre}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  if (ancho.doc > ancho.win + 1) throw new Error(`scroll horizontal en 390px: ${JSON.stringify(ancho)}`);
  await page.screenshot({ path: `${SHOT_DIR}/arriendos-${nombre}-movil.png`, fullPage: true });
  const estado = await page.evaluate(() => {
    const sidebar = document.querySelector("aside nav") ?? document.querySelector("nav");
    return [...sidebar.querySelectorAll("a")].map((a) => ({
      texto: a.innerText.replace(/\n/g, " "),
      actual: a.getAttribute("aria-current"),
      cian: a.className.includes("text-accent"),
    }));
  });
  console.log(JSON.stringify(estado));
  const activa = await page.locator('nav [aria-current="page"]').first().innerText();
  if (!/Arriendos/.test(activa)) throw new Error(`el menú marca "${activa}" en /arriendos`);
  const titulo = await page.locator("h1").innerText();
  console.log(`${nombre}: h1 = "${titulo}"`);
  await b.close();
}

await fotografiar(dueñoEmail, "propietario");
await fotografiar(inquilinoEmail, "inquilino");
console.log("capturas listas");
console.log(`LIMPIAR uids=${dueño},${inquilino}`);
