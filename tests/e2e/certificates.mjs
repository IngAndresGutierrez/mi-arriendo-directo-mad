/**
 * El recibo de pago y el paz y salvo.
 *
 * Los dos son PDFs que arma el servidor a partir del registro, así que **compilar no dice nada**:
 * `pdf-lib` produce un archivo perfectamente válido y completamente vacío si algo se dibuja fuera de
 * la página, y `pdf.save()` revienta en la línea que escribe el fichero cuando un título de inmueble
 * lleva un emoji. Lo único que distingue las dos cosas es bajar el archivo y mirar dentro.
 *
 * Lo que se afirma:
 *
 * - que un mes **sin confirmar** no tiene recibo, que es la regla entera — un recibo certifica que
 *   el dinero llegó, y eso solo lo puede decir la persona cuya cuenta es;
 * - que el paz y salvo **se niega** mientras haya algo pendiente, y que el motivo se ve en pantalla;
 * - que los dos salen con las cifras y los nombres de verdad dentro, no con un PDF en blanco;
 * - y que un extraño no puede pedir ninguno de los dos.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

import {
  adminDb,
  adminFieldValue,
  assertQuiet,
  BASE,
  config,
  createAccount,
  leaseTab,
  ok,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const db = adminDb();
const FieldValue = adminFieldValue();

const PROPIETARIO = "Ana Propietaria Pérez";
const INQUILINO = "Carlos Inquilino Ramírez";
const dueñoEmail = `cert-owner-${STAMP}@miarriendodirecto.test`;
const inqEmail = `cert-tenant-${STAMP}@miarriendodirecto.test`;
const ajenoEmail = `cert-otro-${STAMP}@miarriendodirecto.test`;

const dueñoCuenta = await createAccount(API_KEY, dueñoEmail);
const inqCuenta = await createAccount(API_KEY, inqEmail);
await createAccount(API_KEY, ajenoEmail);

const navegador = await chromium.launch();
const problemas = [];
const [dueño, inq] = await Promise.all([
  openSession(navegador, { email: dueñoEmail, name: PROPIETARIO, problems: problemas }),
  openSession(navegador, { email: inqEmail, name: INQUILINO, problems: problemas }),
]);

/*
 * Arranca hace tres meses, así que el calendario trae tres meses vencidos y uno en curso. El título
 * lleva un emoji **a propósito**: es el carácter que hace reventar `pdf.save()` desde la línea que
 * escribe el fichero, y el que `drawableText` existe para doblar.
 */
const hoy = new Date();
const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 5));
const LEASE_ID = `lease-cert-${STAMP}`;
const TITULO = `Apartamento con balcón 🎉 ${STAMP}`;

await db
  .collection("leases")
  .doc(LEASE_ID)
  .set({
    propertyId: `property-${STAMP}`,
    propertySlug: `apartamento-cert-${STAMP}`,
    propertyTitle: TITULO,
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

/** Los meses del calendario, tal como los deriva el producto — no como los calcule este archivo. */
const mesesDe = (desde, cuantos) =>
  Array.from({ length: cuantos }, (_, i) => {
    const fecha = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + i, 5));
    return fecha.toISOString().slice(0, 7);
  });
const MESES = mesesDe(inicio, 4);

async function sembrarMes(periodo, { confirmado }) {
  await db
    .collection("leases")
    .doc(LEASE_ID)
    .collection("periods")
    .doc(periodo)
    .set({
      amount: 1_800_000,
      dueDate: `${periodo}-05`,
      receipt: {
        path: `canon/${LEASE_ID}/${periodo}.pdf`,
        fileName: "comprobante.pdf",
        contentType: "application/pdf",
        bytes: 1000,
        amount: 1_800_000,
        paidOn: `${periodo}-04`,
        uploadedAt: `${periodo}-04T10:00:00.000Z`,
        note: "",
      },
      verdict: confirmado
        ? { status: "confirmed", at: `${periodo}-05T10:00:00.000Z`, reason: "" }
        : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

// Los tres primeros confirmados; el cuarto (el mes en curso) subido y sin confirmar.
for (const periodo of MESES.slice(0, 3)) await sembrarMes(periodo, { confirmado: true });
await sembrarMes(MESES[3], { confirmado: false });
ok("tenencia sembrada: tres meses confirmados y uno en revisión", MESES.join(" · "));

const CONFIRMADO = MESES[0];
const EN_REVISION = MESES[3];

/** El PDF que devuelve una ruta, con su tipo y su texto crudo. */
async function pedir(page, ruta) {
  const respuesta = await page.request.get(BASE + ruta);
  const cuerpo = respuesta.ok() ? Buffer.from(await respuesta.body()) : Buffer.alloc(0);

  return {
    status: respuesta.status(),
    tipo: respuesta.headers()["content-type"] ?? "",
    cache: respuesta.headers()["cache-control"] ?? "",
    bytes: cuerpo.byteLength,
    crudo: cuerpo.toString("latin1"),
  };
}

/*
 * Lo que dice un PDF no se lee del binario tal cual: `pdf-lib` comprime los flujos de contenido. Se
 * descomprimen aquí con `zlib`, que es lo que hace que estas aserciones hablen de lo que se ve en el
 * papel y no de lo que hay en los metadatos.
 */
const { inflateSync } = await import("node:zlib");
function textoDe(crudo) {
  const partes = [];
  const buffer = Buffer.from(crudo, "latin1");
  let desde = 0;
  for (;;) {
    const inicioStream = buffer.indexOf("stream", desde);
    if (inicioStream === -1) break;
    const fin = buffer.indexOf("endstream", inicioStream);
    if (fin === -1) break;
    const datos = buffer.subarray(inicioStream + 6, fin);
    try {
      partes.push(inflateSync(datos.subarray(datos.indexOf(0x78))).toString("latin1"));
    } catch {
      /* No todos los streams están comprimidos ni son texto. */
    }
    desde = fin + 9;
  }

  /*
   * Y los literales de texto van en **hexadecimal** — `<6D6961...> Tj` —, que es como `pdf-lib`
   * escribe una cadena cuando la codificación de la fuente lo pide. Sin este paso el flujo
   * descomprimido no contiene "1.800.000" en ninguna parte y la aserción pasaría a ser sobre los
   * metadatos del fichero en vez de sobre lo que hay impreso en la hoja.
   */
  return partes
    .join("\n")
    .replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex) =>
      Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("latin1"),
    );
}

// ---------- el recibo de un mes confirmado ----------
const recibo = await pedir(inq, `/api/arriendos/${LEASE_ID}/recibo/${CONFIRMADO}`);
if (recibo.status !== 200) throw new Error(`el recibo respondió ${recibo.status}`);
if (!recibo.tipo.startsWith("application/pdf")) throw new Error(`no es un PDF: ${recibo.tipo}`);
if (!recibo.cache.includes("no-store")) throw new Error(`el recibo es cacheable: ${recibo.cache}`);
if (recibo.bytes < 900) throw new Error(`el recibo pesa ${recibo.bytes} bytes: está vacío`);
ok("el inquilino descarga el recibo de un mes confirmado", `${recibo.bytes} bytes`);

/*
 * **Y dentro dice lo que tiene que decir.** Un PDF de 1 KB con la página en blanco pasa cualquier
 * aserción sobre el tipo y el tamaño; lo que distingue las dos cosas es leer el texto.
 */
const textoRecibo = textoDe(recibo.crudo);
for (const [que, esperado] of [
  ["el valor", "1.800.000"],
  ["el arrendador", "Ana Propietaria"],
  ["el arrendatario", "Carlos Inquilino"],
  ["la referencia", "REC-"],
  /*
   * **Con tildes.** WinAnsi sí las codifica y `shared/pdf/text.test.ts` lo fija; escribir el
   * documento sin ellas "por si acaso" era una superstición que costaba el español de un papel que
   * alguien le lleva a un tercero.
   */
  ["el español bien escrito", "Según el registro"],
]) {
  if (!textoRecibo.includes(esperado)) {
    throw new Error(`el recibo no lleva ${que} (${esperado}) dentro`);
  }
}
/*
 * El emoji del título llegó hasta `pdf.save()` y no lo tumbó: `drawableText` lo dobló a `?`. Sin esa
 * función el fallo sale de la línea que escribe el fichero, no de la que tiene el carácter malo.
 */
if (textoRecibo.includes("🎉")) throw new Error("el emoji llegó crudo al PDF");
/* Guardados al lado de las capturas: una composición de PDF no se revisa en un diff. */
writeFileSync(`${SHOT_DIR}/recibo.pdf`, Buffer.from(recibo.crudo, "latin1"));
ok("el recibo lleva dentro el valor, las partes y su referencia", "y sobrevive a un emoji");

// ---------- un mes sin confirmar no tiene recibo ----------
const sinConfirmar = await pedir(inq, `/api/arriendos/${LEASE_ID}/recibo/${EN_REVISION}`);
if (sinConfirmar.status !== 404) {
  throw new Error(`un mes en revisión dio recibo con ${sinConfirmar.status}`);
}
ok("un mes con el comprobante subido y sin confirmar no tiene recibo", "solo lo dice quien recibe");

const inventado = await pedir(inq, `/api/arriendos/${LEASE_ID}/recibo/1999-01`);
if (inventado.status !== 404) throw new Error(`un mes inventado respondió ${inventado.status}`);
ok("un mes que no está en el calendario tampoco");

// ---------- el paz y salvo se niega mientras haya algo pendiente ----------
const negado = await pedir(inq, `/api/arriendos/${LEASE_ID}/paz-y-salvo`);
if (negado.status !== 409) throw new Error(`el paz y salvo salió con ${negado.status} habiendo pendientes`);
ok("no hay paz y salvo con un mes esperando confirmación");

// ---------- y la pantalla dice por qué ----------
await inq.goto(`${BASE}/arriendos/${LEASE_ID}`, { waitUntil: "domcontentloaded" });
await settled(inq);
await leaseTab(inq, "Información");
const info = await inq.getByRole("region", { name: /El arriendo/i }).innerText();
if (!info.includes("esperando la confirmación")) {
  throw new Error("la pantalla no dice por qué no hay paz y salvo: " + info);
}
if ((await inq.getByRole("link", { name: /Descargar el paz y salvo/ }).count()) !== 0) {
  throw new Error("ofrece un paz y salvo que el endpoint rechaza");
}
ok("la pantalla dice el motivo en vez de ofrecer un enlace que va a fallar");

// ---------- el propietario confirma, y entonces sí ----------
await db
  .collection("leases")
  .doc(LEASE_ID)
  .collection("periods")
  .doc(EN_REVISION)
  .update({ verdict: { status: "confirmed", at: `${EN_REVISION}-06T10:00:00.000Z`, reason: "" } });

const pazYSalvo = await pedir(inq, `/api/arriendos/${LEASE_ID}/paz-y-salvo`);
if (pazYSalvo.status !== 200) throw new Error(`el paz y salvo respondió ${pazYSalvo.status}`);
if (pazYSalvo.bytes < 900) throw new Error(`el paz y salvo pesa ${pazYSalvo.bytes} bytes: está vacío`);

const textoPaz = textoDe(pazYSalvo.crudo);
if (!textoPaz.includes("PYS-")) throw new Error("el paz y salvo no lleva su referencia");
if (!textoPaz.includes("Cánones confirmados")) {
  throw new Error("el paz y salvo perdió las tildes que WinAnsi sí codifica");
}
if (!textoPaz.includes("7.200.000")) {
  throw new Error("el paz y salvo no suma los cuatro meses confirmados");
}
/*
 * **Y no dice que el contrato terminó.** Bajo Ley 820 el arriendo se prorroga salvo que alguien
 * avise, así que un certificado que lo diera por acabado afirmaría algo que la ley niega.
 */
if (/termin[oó] el contrato|contrato terminado/i.test(textoPaz)) {
  throw new Error("el paz y salvo da por terminado el contrato");
}
writeFileSync(`${SHOT_DIR}/paz-y-salvo.pdf`, Buffer.from(pazYSalvo.crudo, "latin1"));
ok("con todo confirmado sale el paz y salvo, con la suma correcta", `${pazYSalvo.bytes} bytes`);

// ---------- el propietario también los tiene ----------
const delDueño = await pedir(dueño, `/api/arriendos/${LEASE_ID}/recibo/${CONFIRMADO}`);
if (delDueño.status !== 200) throw new Error(`el propietario no pudo bajar el recibo: ${delDueño.status}`);
ok("el propietario también descarga el recibo, para su contabilidad");

// ---------- y un extraño no ----------
const ajeno = await openSession(navegador, {
  email: ajenoEmail,
  name: "Beto Ajeno Gómez",
  problems: problemas,
});
for (const [que, ruta] of [
  ["el recibo", `/api/arriendos/${LEASE_ID}/recibo/${CONFIRMADO}`],
  ["el paz y salvo", `/api/arriendos/${LEASE_ID}/paz-y-salvo`],
]) {
  const robado = await pedir(ajeno, ruta);
  if (robado.status !== 404) throw new Error(`un extraño bajó ${que} con ${robado.status}`);
}
ok("un extraño recibe 404 en los dos, igual que ante una tenencia inexistente");

// ---------- el enlace del recibo está en el mes pagado ----------
await inq.goto(`${BASE}/arriendos/${LEASE_ID}`, { waitUntil: "domcontentloaded" });
await settled(inq);
await leaseTab(inq, "Pagos");
const mes = inq.locator(`#mes-${CONFIRMADO}`);
await mes.getByRole("button").first().click();
const enlace = mes.getByRole("link", { name: /Recibo de pago/ });
await enlace.waitFor({ timeout: 15000 });
if ((await enlace.getAttribute("href")) !== `/api/arriendos/${LEASE_ID}/recibo/${CONFIRMADO}`) {
  throw new Error("el enlace del recibo no apunta al mes que lo abre");
}
await inq.screenshot({ path: `${SHOT_DIR}/recibo-mes.png`, fullPage: true });
ok("el mes pagado ofrece su recibo, y apunta a su propio periodo");

assertQuiet(problemas);
await navegador.close();

// ---------- limpieza ----------
const meses = await db.collection("leases").doc(LEASE_ID).collection("periods").get();
for (const uno of meses.docs) await uno.ref.delete();
await db.collection("leases").doc(LEASE_ID).delete();
ok("datos de prueba borrados");
