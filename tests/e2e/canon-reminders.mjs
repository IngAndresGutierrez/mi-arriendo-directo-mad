/**
 * Los recordatorios del canon: el aviso de que un mes vence, el de que venció hoy y el de mora.
 *
 * Es el único movimiento de un arriendo que **no lo provoca nadie** — lo dispara un cron — así que
 * no hay pantalla desde la que se pueda ver que eligió mal. Lo que este driver añade sobre los 22
 * tests unitarios de la regla es lo que solo se ve extremo a extremo: que el endpoint no corre sin
 * el secreto, que la barrida escribe *antes* de mandar y por eso no se repite, que la campana del
 * inquilino termina mostrándolo, y que el propietario **no** se entera de un mes que todavía no
 * vence.
 *
 * ## La Ley 2300 hace que este driver tenga dos ramas, y es a propósito
 *
 * Un mensaje sobre dinero que alguien debe es contacto de cobranza, y la barrida se niega fuera de
 * la ventana legal (lun–vie 7–19, sáb 8–15, nunca domingos ni festivos). No hay forma honesta de
 * mover el reloj: la ruta va detrás de `CRON_SECRET`, y dejar que quien lo tenga pase una hora
 * sería exactamente la manera de saltarse esa ley. Así que el driver **le pregunta a la barrida qué
 * decidió** y afirma sobre eso:
 *
 * - ventana abierta → el recorrido completo;
 * - ventana cerrada → que no salió **nada**, que es la afirmación que protege la Ley 2300.
 *
 * Las dos son reales. La segunda cubre menos, y lo dice en voz alta al terminar en vez de fingir
 * que corrió todo.
 */
import { readFileSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import {
  adminAuth,
  adminDb,
  adminFieldValue,
  assertQuiet,
  BASE,
  config,
  createAccount,
  ok,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const db = adminDb();
const auth = adminAuth();
const FieldValue = adminFieldValue();
const RAIZ = joinPath(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SECRETO = (process.env.CRON_SECRET ?? "").trim() || leerCronSecret();
if (!SECRETO) throw new Error("falta CRON_SECRET en el entorno o en .env.local");

function leerCronSecret() {
  try {
    return (
      readFileSync(joinPath(RAIZ, ".env.local"), "utf8")
        .split("\n")
        .find((linea) => linea.startsWith("CRON_SECRET="))
        ?.slice("CRON_SECRET=".length)
        .replace(/^"|"$/g, "")
        .trim() ?? ""
    );
  } catch {
    return "";
  }
}

const RUTA = `${BASE}/api/cron/canon-reminders`;
const barrer = (token = SECRETO) =>
  fetch(RUTA, { headers: { Authorization: `Bearer ${token}` } });

const avisos = async (uid, tipo) =>
  (
    await db
      .collection("notifications")
      .where("recipientUid", "==", uid)
      .where("type", "==", tipo)
      .get()
  ).size;

// ---------- el endpoint no es público ----------
if ((await barrer("no-es-el-secreto")).status !== 401) {
  throw new Error("la barrida corrió con un secreto equivocado");
}
if ((await fetch(RUTA)).status !== 401) {
  throw new Error("la barrida corrió sin ninguna autorización");
}
ok("la barrida rechaza un secreto equivocado y la falta de autorización");

// ---------- dos cuentas ----------
const dueñoEmail = `canon-owner-${STAMP}@miarriendodirecto.test`;
const inqEmail = `canon-tenant-${STAMP}@miarriendodirecto.test`;
const INQUILINO = "Carlos Inquilino Ramírez";
const dueño = await createAccount(API_KEY, dueñoEmail);
const inquilino = await createAccount(API_KEY, inqEmail);
await auth.setCustomUserClaims(inquilino.localId, { role: "tenant" });

/**
 * Una tenencia cuyo canon del mes en curso vence dentro de `enDias` días.
 *
 * **La tenencia arranca exactamente en la fecha objetivo**, y no tres meses antes, que fue el primer
 * intento. Arrancando antes el calendario trae también los meses anteriores, todos sin pagar — y la
 * barrida, correctamente, se ocupa del más viejo primero: sembrar un vencimiento "dentro de tres
 * días" acababa mandando la mora de hace cuatro semanas. El producto tenía razón y la siembra no.
 * Con el arranque en la fecha objetivo hay **un solo mes** dentro de la ventana, que es lo que hace
 * que la aserción hable del recordatorio que se quiso probar.
 *
 * El día del mes de `startDate` es lo que fija el vencimiento de cada mes. Nada de esto replica una
 * regla del producto: `leaseSchedule` decide, y lo que se afirma después es lo que la barrida hizo.
 */
async function tenencia(id, enDias) {
  const objetivo = new Date();
  objetivo.setUTCDate(objetivo.getUTCDate() + enDias);
  const inicio = objetivo;

  await db
    .collection("leases")
    .doc(id)
    .set({
      propertyId: `property-${STAMP}`,
      propertySlug: `apartamento-canon-${STAMP}`,
      propertyTitle: `Apartamento del canon ${STAMP}`,
      propertyCity: "Manizales",
      landlordUid: dueño.localId,
      tenantUid: inquilino.localId,
      tenantName: INQUILINO,
      monthlyCost: 1_800_000,
      startDate: inicio.toISOString().slice(0, 10),
      months: 12,
      payout: {
        method: "breb",
        phone: "",
        key: "@ana2026",
        accountType: "",
        accountNumber: "",
        bankName: "",
        holderName: "Ana Propietaria Pérez",
        holderDocument: "",
        note: "",
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return id;
}

const marcados = async (leaseId) => {
  const meses = await db.collection("leases").doc(leaseId).collection("periods").get();

  return meses.docs.flatMap((doc) => doc.data().remindersSent ?? []);
};

// ---------- un mes que vence en tres días ----------
const PRONTO = await tenencia(`lease-canon-soon-${STAMP}`, 3);
const primera = await barrer();
if (primera.status !== 200) throw new Error(`la barrida respondió ${primera.status}`);
const resultado = await primera.json();

if (typeof resultado.checked !== "number" || typeof resultado.sent !== "number") {
  throw new Error("la barrida no reporta qué hizo: " + JSON.stringify(resultado));
}
ok("la barrida corre con el secreto correcto", JSON.stringify(resultado));

const ventanaAbierta = resultado.blocked === null;

if (!ventanaAbierta) {
  /*
   * Fuera de la ventana de la Ley 2300. Se afirma lo que esa ley exige —que no salga nada— y se
   * dice claramente qué quedó sin cubrir, en vez de dar por bueno un recorrido que no ocurrió.
   */
  if (!["sunday", "holiday", "outside_hours"].includes(resultado.blocked)) {
    throw new Error("la barrida se bloqueó por un motivo que no existe: " + resultado.blocked);
  }
  if (resultado.sent !== 0 || resultado.checked !== 0) {
    throw new Error("se bloqueó y aun así hizo algo: " + JSON.stringify(resultado));
  }
  if ((await marcados(PRONTO)).length !== 0) {
    throw new Error("marcó recordatorios estando fuera de la ventana legal");
  }
  for (const tipo of ["canon_due_soon", "canon_due_today", "canon_overdue"]) {
    if ((await avisos(inquilino.localId, tipo)) !== 0) {
      throw new Error(`mandó ${tipo} fuera de la ventana de la Ley 2300`);
    }
  }
  ok(`fuera de la ventana legal (${resultado.blocked}) no sale nada`, "Ley 2300");
  console.log(
    "  ⚠ el recorrido de entrega NO corrió: la ventana estaba cerrada. " +
      "Vuelve a correrlo lun–vie 7:00–19:00 o sáb 8:00–15:00, hora de Bogotá.",
  );
} else {
  if ((await avisos(inquilino.localId, "canon_due_soon")) !== 1) {
    throw new Error("al inquilino no le llegó el aviso de que su canon vence pronto");
  }
  /*
   * Y el propietario **no** se entera: un mes que todavía no vence es el calendario, y una campana
   * que suena por el calendario es una que se silencia antes del mes que importa.
   */
  if ((await avisos(dueño.localId, "canon_due_soon")) !== 0) {
    throw new Error("le avisó al propietario de un canon que todavía no vence");
  }
  ok("un canon que vence en tres días avisa al inquilino y solo a él");

  // ---------- la barrida es idempotente ----------
  const segunda = await (await barrer()).json();
  if ((await avisos(inquilino.localId, "canon_due_soon")) !== 1) {
    throw new Error("la segunda barrida duplicó el aviso: " + JSON.stringify(segunda));
  }
  ok("una segunda barrida no repite el aviso", JSON.stringify(segunda));

  // ---------- un mes vencido avisa a los dos ----------
  const MORA = await tenencia(`lease-canon-late-${STAMP}`, -5);
  await barrer();
  for (const [quien, cuenta] of [
    ["inquilino", inquilino],
    ["propietario", dueño],
  ]) {
    if ((await avisos(cuenta.localId, "canon_overdue")) !== 1) {
      throw new Error(`la mora no le llegó al ${quien}, o le llegó doble`);
    }
  }
  /*
   * Y los dos anteriores quedan descartados, no enviados: abrir con "tu canon vence en 3 días"
   * sobre un mes que ya está en mora es el aviso que hace que nadie confíe en los demás.
   */
  const enMora = await marcados(MORA);
  for (const id of ["due_soon", "due_today", "overdue"]) {
    if (!enMora.includes(id)) throw new Error(`no anotó ${id} en el mes en mora: ${JSON.stringify(enMora)}`);
  }
  if ((await avisos(inquilino.localId, "canon_due_soon")) !== 1) {
    throw new Error("mandó el de 'vence pronto' sobre un mes ya vencido");
  }
  ok("un mes vencido avisa a los dos y descarta los dos avisos anteriores", JSON.stringify(enMora));

  // ---------- un mes con comprobante no se persigue ----------
  /*
   * Vence **hoy**, para que el mes en juego sea sin ambigüedad el de hoy: con el vencimiento a dos
   * días, un 30 de mes el candidato pasa a ser el mes siguiente y el id del documento ya no es el
   * que este archivo escribiría. Así el id es `YYYY-MM` de hoy y la fecha de vencimiento es hoy,
   * las dos leídas del reloj y no de una regla del producto copiada aquí.
   */
  const PAGADO = await tenencia(`lease-canon-paid-${STAMP}`, 0);
  const hoyISO = new Date().toISOString().slice(0, 10);
  await db
    .collection("leases")
    .doc(PAGADO)
    .collection("periods")
    .doc(hoyISO.slice(0, 7))
    .set({
      amount: 1_800_000,
      dueDate: hoyISO,
      receipt: {
        path: `payments/${PAGADO}/a.pdf`,
        fileName: "comprobante.pdf",
        contentType: "application/pdf",
        bytes: 1000,
        amount: 1_800_000,
        paidOn: hoyISO,
        uploadedAt: new Date().toISOString(),
        note: "",
      },
      verdict: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  const antes = await avisos(inquilino.localId, "canon_due_today");
  await barrer();
  if ((await avisos(inquilino.localId, "canon_due_today")) !== antes) {
    throw new Error("persiguió un mes cuyo comprobante ya estaba subido");
  }
  const mesPagado = await db
    .collection("leases")
    .doc(PAGADO)
    .collection("periods")
    .doc(hoyISO.slice(0, 7))
    .get();
  if ((mesPagado.data().remindersSent ?? []).length !== 0) {
    throw new Error("marcó un recordatorio sobre un mes cuyo comprobante ya estaba subido");
  }
  ok("no persigue un mes con el comprobante ya subido");

  // ---------- y el inquilino lo ve en la campana ----------
  const navegador = await chromium.launch();
  const problemas = [];
  const p = await openSession(navegador, {
    email: inqEmail,
    name: INQUILINO,
    problems: problemas,
    viewport: { width: 1100, height: 900 },
  });
  await settled(p);

  const panel = p.getByRole("dialog", { name: "Notificaciones" });
  for (let intento = 0; intento < 10; intento += 1) {
    await p.getByRole("button", { name: /^Notificaciones/ }).click();
    try {
      await panel.waitFor({ state: "visible", timeout: 3000 });
      break;
    } catch {
      /* El clic llegó antes de la hidratación. Se vuelve a intentar. */
    }
  }
  const texto = await panel.innerText();
  if (!/canon/i.test(texto)) throw new Error("la campana no muestra el recordatorio: " + texto);

  /*
   * **Y el enlace lleva al mes, no al principio de la página.** Es la aserción que importa aquí:
   * `toNotification` nombra uno a uno los campos que copia, así que un `period` que no llegue a la
   * campana deja el aviso apuntando al principio de un arriendo con doce meses — el fallo exacto
   * que este producto ya tuvo y que los correos ocultaban, porque el correo lee el `NotifyInput` de
   * salida y no el documento de vuelta.
   */
  const enlace = (await panel.locator("li a").first().getAttribute("href")) ?? "";
  /*
   * El id se compara contra la tenencia que este driver creó, no contra un patrón: la primera
   * versión adivinaba su forma con una expresión regular y se rompió porque el `stamp` lleva
   * guiones. Preguntarle el valor al producto en vez de describirlo es la regla de siempre.
   */
  if (!enlace.startsWith(`/arriendos/${MORA}#mes-`)) {
    throw new Error("el aviso no lleva al arriendo correcto: " + enlace);
  }
  if (!/#mes-\d{4}-\d{2}$/.test(enlace)) {
    throw new Error("el aviso no lleva al mes, sino al principio de la página: " + enlace);
  }
  /*
   * Y no lleva la cuenta donde pagar. Es la misma regla que ya siguen `payout_ready` y los avisos
   * del arriendo: un mensaje con el número de cuenta de alguien dentro es la forma de toda estafa
   * de pagos, y el nuestro llegaría desde un dominio que el inquilino se cree.
   */
  if (texto.includes("@ana2026")) throw new Error("¡FUGA! el aviso lleva la cuenta de pago");
  await p.screenshot({ path: `${SHOT_DIR}/canon-recordatorio.png`, fullPage: true });
  ok("el inquilino lo ve en la campana, sin la cuenta de pago dentro");

  assertQuiet(problemas);
  await navegador.close();
}

// ---------- limpieza ----------
for (const id of [
  `lease-canon-soon-${STAMP}`,
  `lease-canon-late-${STAMP}`,
  `lease-canon-paid-${STAMP}`,
]) {
  const meses = await db.collection("leases").doc(id).collection("periods").get();
  for (const mes of meses.docs) await mes.ref.delete();
  await db.collection("leases").doc(id).delete();
}
const suyos = await db
  .collection("notifications")
  .where("recipientUid", "in", [inquilino.localId, dueño.localId])
  .get();
for (const aviso of suyos.docs) await aviso.ref.delete();
ok("datos de prueba borrados");
