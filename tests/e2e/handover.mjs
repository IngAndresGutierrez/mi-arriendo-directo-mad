/**
 * El acta de entrega: en qué estado se entregó el inmueble, y en qué estado se devolvió.
 *
 * Lo que este driver añade sobre los 40 tests unitarios y los 5 de reglas es lo que solo se ve
 * extremo a extremo:
 *
 * - que las **fotos suban de verdad** al bucket y vuelvan con una URL firmada — el camino que ni
 *   `pnpm build` ni un test unitario tocan, porque la subida la hace el SDK web del navegador;
 * - que **la aceptación se caiga sola** cuando el propietario edita el acta después, que es la regla
 *   sobre la que descansa todo el diseño;
 * - que cada parte vea **solo sus controles** — un inquilino que pudiera redactar el acta de su
 *   propia casa la convertiría en una afirmación en vez de un registro;
 * - y que el aviso de la campana lleve al ancla del acta, no al principio de una página con cuatro
 *   pestañas.
 */
import { chromium } from "playwright";

import {
  adminDb,
  adminFieldValue,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fixtures,
  leaseTab,
  ok,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: FOTO_1, photo2: FOTO_2 } = fixtures();
const db = adminDb();
const FieldValue = adminFieldValue();

const FOTOS = 'input[data-slot="handover-photos"]';

// ---------- dos cuentas y una tenencia en curso ----------
const dueñoEmail = `acta-owner-${STAMP}@miarriendodirecto.test`;
const inqEmail = `acta-tenant-${STAMP}@miarriendodirecto.test`;
const INQUILINO = "Carlos Inquilino Ramírez";

const dueñoCuenta = await createAccount(API_KEY, dueñoEmail);
const inqCuenta = await createAccount(API_KEY, inqEmail);

const navegador = await chromium.launch();
const problemas = [];
const [dueño, inq] = await Promise.all([
  openSession(navegador, { email: dueñoEmail, name: "Ana Propietaria Pérez", problems: problemas }),
  openSession(navegador, { email: inqEmail, name: INQUILINO, problems: problemas }),
]);

const hoy = new Date();
const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 10));
const LEASE_ID = `lease-acta-${STAMP}`;

await db
  .collection("leases")
  .doc(LEASE_ID)
  .set({
    propertyId: `property-${STAMP}`,
    propertySlug: `apartamento-del-acta-${STAMP}`,
    propertyTitle: `Apartamento del acta ${STAMP}`,
    propertyCity: "Manizales",
    landlordUid: dueñoCuenta.localId,
    tenantUid: inqCuenta.localId,
    tenantName: INQUILINO,
    monthlyCost: 1_800_000,
    startDate: inicio.toISOString().slice(0, 10),
    months: 12,
    payout: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
ok("tenencia en curso sembrada", LEASE_ID);

const URL_ARRIENDO = `${BASE}/arriendos/${LEASE_ID}`;
const acta = async () =>
  (await db.collection("leases").doc(LEASE_ID).collection("handovers").doc("checkin").get()).data() ??
  null;

async function abrirEntrega(page) {
  await page.goto(URL_ARRIENDO, { waitUntil: "domcontentloaded" });
  await settled(page);
  await leaseTab(page, "Entrega");
}

// ---------- el inquilino no redacta el acta de su propia casa ----------
await abrirEntrega(inq);
const entregaInquilino = inq.locator("#entrega-checkin");
if ((await entregaInquilino.getByRole("button", { name: /Redactar|Editar el acta/ }).count()) !== 0) {
  throw new Error("el inquilino puede redactar el acta");
}
if (!(await entregaInquilino.innerText()).includes("aún no ha preparado")) {
  throw new Error("al inquilino no se le dice que todavía no hay acta");
}
/* Y no se le dice que "agregue espacios", que es lo que el propietario lee: no es su trabajo. */
if ((await entregaInquilino.innerText()).includes("Agrégalos")) {
  throw new Error("al inquilino se le está pidiendo que redacte el acta");
}
ok("el inquilino no redacta el acta, y se le dice por qué no hay nada");

// ---------- la devolución está bloqueada mientras no haya entrega ----------
const devolucion = inq.locator("#entrega-checkout");
if (!(await devolucion.innerText()).includes("Primero envía el acta de entrega")) {
  throw new Error("la devolución no explica por qué no se puede empezar todavía");
}
ok("la devolución dice que necesita algo contra qué compararse");

// ---------- el propietario redacta, con fotos ----------
await abrirEntrega(dueño);
const entrega = dueño.locator("#entrega-checkin");
await entrega.getByRole("button", { name: /Redactar el acta/ }).click();

/*
 * Cada espacio se maneja dentro de su propia tarjeta, no con `.nth()` sobre toda la página: hay dos
 * espacios con los mismos rótulos, y un selector sin ámbito es una suposición sobre el orden del
 * documento. `data-slot="handover-area"` es el asidero que el producto expone para eso.
 */
const espacio = (page, n) => page.locator('[data-slot="handover-area"]').nth(n);

/*
 * Y el estado se elige haciendo clic en **la etiqueta**, no en el input: el input va `sr-only` para
 * que la tarjeta entera sea el control, así que Playwright se niega — con razón — a hacer clic en un
 * elemento que no ocupa espacio. Es exactamente lo que hace una persona.
 */
const marcarEstado = (tarjeta, texto) => tarjeta.getByText(texto, { exact: true }).click();

/*
 * `exact: true` sobre el rótulo, y no es cosmético: `getByLabel("Espacio")` es subcadena sin
 * distinguir mayúsculas, así que también encontraba el botón "Quitar **el espacio**" de la misma
 * tarjeta. Es el mismo tropiezo que el enlace "Aviso" contra un título que llevaba la palabra
 * dentro.
 */
const nombreDe = (tarjeta) => tarjeta.getByLabel("Espacio", { exact: true });

/*
 * El espacio se **elige del menú**, que es lo que hay ahora: antes era un campo de texto con un
 * `<datalist>` invisible detrás, y en pantalla eso es un campo vacío que no anuncia nada.
 */
const agregarEspacio = async (page, nombre) => {
  await page.getByRole("button", { name: /Agregar espacio/ }).click();
  await page.getByRole("menuitem", { name: nombre, exact: true }).click();
};

await agregarEspacio(dueño, "Cocina");
if ((await nombreDe(espacio(dueño, 0)).inputValue()) !== "Cocina") {
  throw new Error("elegir del menú no puso el nombre del espacio");
}
await marcarEstado(espacio(dueño, 0), "En buen estado");
await espacio(dueño, 0).getByLabel("Detalle (opcional)").fill("Todo funciona. Mesón sin rayones.");
await espacio(dueño, 0).locator(FOTOS).setInputFiles([FOTO_1, FOTO_2]);
await dueño.waitForSelector('img[alt$=".png"]', { timeout: 20000 });

// Un segundo espacio, con daños: es el estado que se discute seis meses después.
await agregarEspacio(dueño, "Baño principal");
await marcarEstado(espacio(dueño, 1), "Con daños");
await espacio(dueño, 1).getByLabel("Detalle (opcional)").fill("Grieta en el lavamanos.");

/* El editor con sus dos espacios, antes de guardar: es la pantalla que hay que mirar. */
await dueño.screenshot({ path: `${SHOT_DIR}/acta-editor.png`, fullPage: true });
await dueño.getByRole("button", { name: /Guardar el acta/ }).click();
await dueño.waitForSelector("text=Baño principal", { timeout: 40000 });

const guardada = await acta();
if (!guardada) throw new Error("el acta no se guardó");
if (guardada.areas.length !== 2) throw new Error(`guardó ${guardada.areas.length} espacios`);
/*
 * Las fotos están **en el bucket**, no solo en el documento: la acción se niega si no puede
 * confirmarlas contra Cloud Storage, así que dos fotos guardadas son dos objetos subidos de verdad.
 */
if (guardada.areas[0].photos.length !== 2) {
  throw new Error(`la cocina guardó ${guardada.areas[0].photos.length} fotos`);
}
if (!guardada.areas[0].photos.every((foto) => foto.path.startsWith(`handovers/${dueñoCuenta.localId}/`))) {
  throw new Error("una foto quedó fuera de la carpeta del propietario");
}
if (guardada.submittedAt !== null) throw new Error("guardar el borrador lo dio por enviado");
ok("el propietario redacta el acta con fotos, y queda en borrador", `${guardada.areas.length} espacios`);

// ---------- y el inquilino todavía no ve nada que responder ----------
await abrirEntrega(inq);
if ((await inq.locator("#entrega-checkin").getByRole("button", { name: /Aceptar el acta/ }).count()) !== 0) {
  throw new Error("el inquilino puede aceptar un acta que nadie le ha enviado");
}
ok("un borrador no le pide nada al inquilino");

// ---------- se envía ----------
await abrirEntrega(dueño);
await dueño.locator("#entrega-checkin").getByRole("button", { name: /Enviar al inquilino/ }).click();
await dueño.waitForSelector("text=Pendiente de revisión del inquilino", { timeout: 30000 });
ok("el acta se envía al inquilino");

// ---------- el inquilino objeta ----------
await abrirEntrega(inq);
await inq.locator("#entrega-checkin").getByRole("button", { name: /Poner observaciones/ }).click();
await inq
  .getByLabel("Qué no coincide")
  .fill("La grieta del lavamanos ya estaba cuando recibí el apartamento.");
await inq.getByRole("button", { name: /Enviar observaciones/ }).click();
await inq.waitForSelector("text=Con observaciones", { timeout: 30000 });

const objetada = await acta();
if (!objetada.objection?.note?.includes("ya estaba")) throw new Error("no guardó la objeción");
if (objetada.objection.fingerprint !== objetada.fingerprint) {
  throw new Error("la objeción no quedó atada a la versión que se objetó");
}
ok("el inquilino objeta, y la objeción queda atada a esa versión");

// ---------- acepta ----------
await abrirEntrega(inq);
await inq.locator("#entrega-checkin").getByRole("button", { name: /Aceptar el acta/ }).click();
await inq.waitForSelector("text=Aceptada por el inquilino", { timeout: 30000 });

const aceptada = await acta();
if (aceptada.acceptance?.fingerprint !== aceptada.fingerprint) {
  throw new Error("la aceptación no quedó atada a la versión aceptada");
}
/*
 * La huella la calcula el **servidor**. Que la aceptada coincida con la del documento es lo único
 * que hace que "aceptada" signifique algo, y el cliente nunca la manda: las reglas le niegan la
 * escritura entera.
 */
if (!aceptada.acceptance.at) throw new Error("la aceptación no quedó fechada");
ok("el inquilino acepta, y queda el registro con su fecha");

await inq.screenshot({ path: `${SHOT_DIR}/acta-aceptada.png`, fullPage: true });

// ---------- LA REGLA: editar el acta tumba la aceptación, sola ----------
await abrirEntrega(dueño);
await dueño.locator("#entrega-checkin").getByRole("button", { name: /Editar el acta/ }).click();
await espacio(dueño, 1).getByLabel("Detalle (opcional)").fill("Grieta en el lavamanos, ya existente.");
await dueño.getByRole("button", { name: /Guardar el acta/ }).click();
await dueño.waitForSelector("text=Pendiente de revisión del inquilino", { timeout: 40000 });

const editada = await acta();
if (editada.fingerprint === aceptada.fingerprint) {
  throw new Error("editar el acta no movió la huella: la aceptación seguiría valiendo");
}
if (!editada.acceptance) throw new Error("borró la aceptación en vez de dejarla caducar");
if (editada.acceptance.fingerprint === editada.fingerprint) {
  throw new Error("la aceptación siguió aplicando sobre una versión que ya cambió");
}
const texto = await dueño.locator("#entrega-checkin").innerText();
if (!texto.includes("vuelve a estar pendiente")) {
  throw new Error("no explica que el acta cambió después de aceptarse: " + texto);
}
ok("editar el acta tumba la aceptación sola, y lo dice", "sin limpiar nada");

// ---------- ahora sí se puede empezar la devolución ----------
await abrirEntrega(dueño);
if (
  (await dueño.locator("#entrega-checkout").getByRole("button", { name: /Redactar el acta/ }).count()) !==
  1
) {
  throw new Error("la devolución sigue bloqueada con la entrega ya enviada");
}
ok("con la entrega enviada, la devolución se puede empezar");

/*
 * **Y arranca con los mismos espacios que la entrega**, que es lo que hace que la comparación
 * exista: dos actas que nombran habitaciones distintas no se pueden leer una al lado de la otra.
 */
await dueño.locator("#entrega-checkout").getByRole("button", { name: /Redactar el acta/ }).click();
const espaciosDevolucion = await dueño
  .locator("#entrega-checkout")
  .locator('[data-slot="handover-area"]')
  .evaluateAll((tarjetas) =>
    tarjetas.map((tarjeta) => tarjeta.querySelector("input[id^='area-']")?.value ?? ""),
  );
if (JSON.stringify(espaciosDevolucion) !== JSON.stringify(["Cocina", "Baño principal"])) {
  throw new Error("la devolución no arrancó con los espacios de la entrega: " + JSON.stringify(espaciosDevolucion));
}
ok("la devolución arranca con los espacios de la entrega", espaciosDevolucion.join(" · "));

// ---------- el aviso lleva al acta, no al principio de la página ----------
const avisos = await db
  .collection("notifications")
  .where("recipientUid", "==", dueñoCuenta.localId)
  .where("type", "==", "handover_objected")
  .get();
if (avisos.size !== 1) throw new Error(`el propietario recibió ${avisos.size} avisos de la objeción`);
if (avisos.docs[0].data().handover !== "checkin") {
  throw new Error("el aviso no dice de qué acta habla: " + JSON.stringify(avisos.docs[0].data()));
}
/* Y el motivo viaja dentro: es lo único con lo que el propietario decide si corrige o llama. */
if (!avisos.docs[0].data().detail?.includes("ya estaba")) {
  throw new Error("el aviso de la objeción no lleva el motivo");
}

const panel = dueño.getByRole("dialog", { name: "Notificaciones" });
for (let intento = 0; intento < 10; intento += 1) {
  await dueño.getByRole("button", { name: /^Notificaciones/ }).click();
  try {
    await panel.waitFor({ state: "visible", timeout: 3000 });
    break;
  } catch {
    /* El clic llegó antes de la hidratación. */
  }
}
const enlace = (await panel.locator("li a").first().getAttribute("href")) ?? "";
if (enlace !== `/arriendos/${LEASE_ID}#entrega-checkin`) {
  throw new Error("el aviso no lleva al acta: " + enlace);
}
ok("el aviso de la objeción lleva el motivo y cae en el acta", enlace);

// ---------- 390 px ----------
await inq.setViewportSize({ width: 390, height: 780 });
await abrirEntrega(inq);
await assertNoHorizontalScroll(inq, "el acta en 390px");
await inq.screenshot({ path: `${SHOT_DIR}/acta-movil.png`, fullPage: true });
ok("cabe en 390px sin scroll horizontal");

assertQuiet(problemas);
await navegador.close();

// ---------- limpieza ----------
const actas = await db.collection("leases").doc(LEASE_ID).collection("handovers").get();
for (const una of actas.docs) await una.ref.delete();
await db.collection("leases").doc(LEASE_ID).delete();
const suyos = await db
  .collection("notifications")
  .where("recipientUid", "in", [dueñoCuenta.localId, inqCuenta.localId])
  .get();
for (const aviso of suyos.docs) await aviso.ref.delete();
ok("datos de prueba borrados");
