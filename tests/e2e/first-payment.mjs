/**
 * El primer canon: el propietario dice por dónde recibirlo, el inquilino paga desde su banco y
 * sube el comprobante, y el propietario confirma si el dinero llegó. Este producto no mueve dinero;
 * lo que guarda es dónde pagar y la prueba de que se pagó.
 */
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  adminDb,
  adminFieldValue,
  BASE,
  config,
  createAccount,
  declareReferenceAuthorized,
  fixtures,
  LOGIN_PATH,
  MONTHS,
  ok,
  onStage,
  PHOTOS_INPUT,
  settled,
  stepLabel,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


const db = adminDb();
const FieldValue = adminFieldValue();
const problemas = [];
const b = await chromium.launch();

async function cuenta(email) {
  await createAccount(API_KEY, email);
}
async function entrar(email, nombre) {
  // `clipboard-read` porque la hoja del cotizador se verifica por lo que llega al portapapeles,
  // no por lo que se ve en la fila: es ahí donde importa que el monto vaya sin formato.
  const p = await (
    await b.newContext({
      viewport: { width: 1100, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    })
  ).newPage();
  p.on("pageerror", (e) => problemas.push(`${nombre}: ${e}`));
  await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
  await p.getByLabel("Correo electrónico").fill(email);
  await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
  await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
  await p.waitForURL(/completar-perfil/, { timeout: 25000 });
  await settled(p);
  await p.getByLabel("Nombre completo").fill(nombre);
  await p.getByLabel("Teléfono").fill("3001234567");
  await p.getByLabel("Día", { exact: true }).fill("10");
  await p.getByLabel("Mes", { exact: true }).click();
  await p.getByRole("option", { name: MONTHS[4], exact: true }).click();
  await p.getByLabel("Año", { exact: true }).fill("1990");
  await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
  for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
    await p.getByLabel(l).click();
    await p.getByRole("option", { name: o }).first().click();
  }
  await acceptLegalConsents(p);
  await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
  await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
  return p;
}

const dueñoEmail = `entdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `entinq-${STAMP}@miarriendodirecto.test`;
await cuenta(dueñoEmail); await cuenta(inqEmail);
// El nombre va en una constante porque la hoja del cotizador lo asserta más abajo: escribirlo
// dos veces es cómo la aserción acabó buscando el nombre de otro driver.
const INQ_NOMBRE = "Carlos Inquilino Ramírez";
const dueño = await entrar(dueñoEmail, "Ana Propietaria Pérez");
const inq = await entrar(inqEmail, INQ_NOMBRE);

// ---------- un proceso hasta la etapa de la entrevista ----------
await dueño.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await dueño.getByLabel("Descripción").fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await dueño.getByLabel("Área (m²)").fill("70");
await dueño.getByLabel("Habitaciones").fill("2");
await dueño.getByLabel("Baños").fill("2");
await dueño.getByLabel("Estrato").click(); await dueño.getByRole("option", { name: "Estrato 4" }).click();
await dueño.getByLabel("Parqueadero").click(); await dueño.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await dueño.getByLabel("Departamento").click(); await dueño.getByRole("option", { name: "Caldas", exact: true }).click();
await dueño.getByLabel("Ciudad").click(); await dueño.getByRole("option", { name: "Manizales", exact: true }).click();
await dueño.getByLabel("Barrio").fill("Palermo");
await dueño.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await dueño.getByLabel("Canon mensual (COP)").click(); await dueño.keyboard.type("1800000");
await dueño.setInputFiles(PHOTOS_INPUT, [PHOTO_1, PHOTO_2]);
await dueño.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await dueño.getByRole("button", { name: /Publicar inmueble/i }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);
const href = await dueño.locator("li", { hasText: `Apartamento con balcón en Palermo ${STAMP}` }).getByRole("link").first().getAttribute("href");

await inq.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("link", { name: "Postularme" }).click();
await inq.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(inq);
await inq.getByLabel("Número de documento").fill("1053812345");
await inq.getByLabel("Dónde trabajas").fill("Crehana");
await inq.getByLabel("Ingresos mensuales (COP)").click(); await inq.keyboard.type("6000000");
await inq.getByLabel("Personas que vivirían ahí").fill("2");
await inq.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await inq.getByLabel("Qué relación tienen").fill("Jefe directo");
await inq.getByLabel("Teléfono de tu referencia").fill("3009876543");
await declareReferenceAuthorized(inq);
await inq.getByLabel("Cuándo te mudarías").fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
ok("proceso creado", new URL(proceso).pathname);




// ---------- el proceso, puesto en el primer canon ----------
const applicationId = new URL(proceso).pathname.split("/").pop();
await db.collection("applications").doc(applicationId).update({
  stage: "first_payment",
  updatedAt: FieldValue.serverTimestamp(),
});
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await onStage(dueño, "first_payment");
ok("el proceso está en el primer canon", stepLabel("first_payment"));

/*
 * **Aquí ya no hay ningún "Continuar a"**, y eso es lo que se comprueba: esta es la última etapa, y
 * lo que termina el proceso es confirmar el canon, no un botón aparte que repita la decisión. Un
 * control ofrecido en la última tarjeta sería exactamente el paso que se quitó.
 */
if ((await dueño.getByRole("button", { name: /Continuar a/i }).count()) !== 0) {
  throw new Error("la última etapa sigue ofreciendo un botón de avanzar");
}
ok("en la última etapa no hay botón de avanzar: lo que cierra el proceso es confirmar el canon");

// Y sin datos de cobro no se cierra, y lo dice.
if (!/por d.nde quieres recibir/i.test(await dueño.evaluate(() => document.body.innerText))) {
  throw new Error("no dice que faltan los datos de cobro");
}
if (/Proceso completado/.test(await dueño.evaluate(() => document.body.innerText))) {
  throw new Error("el proceso se lee terminado sin haber cobrado nada");
}
ok("sin datos de cobro el proceso no se da por terminado, y dice qué falta");

await dueño.getByRole("button", { name: /Primer canon/i }).first().click();
const visto = await dueño.evaluate(() => document.body.innerText);
for (const frase of ["El pago es directo entre ustedes", "No verificamos estos datos"]) {
  if (!visto.includes(frase)) throw new Error(`el panel no dice "${frase}"`);
}
if (!/1\.800\.000/.test(visto)) throw new Error("no muestra el canon de referencia");
ok("el panel dice que el pago es directo y no verificado, y muestra el canon");

// ---------- los datos de cobro ----------
/*
 * Se prueba Bre-B porque es el metodo con la validacion mas laxa a proposito: la llave tiene cinco
 * formas y la unica comprobacion real es contra el directorio de los bancos, que no consultamos.
 */
await dueño.selectOption("#payout-method", "breb");
await dueño.locator("#payout-key").fill("@marta2025");
await dueño.locator("#payout-holder").fill("Marta Propietaria Gómez");
/*
 * El documento del titular **no se pide aquí**, y esta aserción es lo que cambió: a una llave Bre-B
 * —como a un Nequi o un Daviplata— se paga con la llave, y la app enseña el nombre de quien recibe
 * antes de confirmar. El campo se rellenaba en esta línea; ahora se comprueba que no existe, porque
 * pedirlo era guardar una cédula que nadie al otro lado usa.
 */
if (await dueño.locator("#payout-holder-doc").count()) {
  throw new Error("pide el documento del titular para una llave Bre-B");
}
ok("a Bre-B no le pide el documento del titular: nadie lo usa para pagar");

// Y a un banco sí, que es donde el banco lo pide al registrar la cuenta.
await dueño.selectOption("#payout-method", "bancolombia");
if (!(await dueño.locator("#payout-holder-doc").count())) {
  throw new Error("no pide el documento del titular para una cuenta bancaria");
}
ok("y a una cuenta bancaria sí se lo pide");
await dueño.selectOption("#payout-method", "breb");
await dueño.getByRole("button", { name: /Guardar los datos de pago/i }).click();
await dueño.waitForFunction(() => /@marta2025/.test(document.body.innerText), null, { timeout: 25000 });
ok("el propietario guarda su llave Bre-B");

// Con los datos puestos el proceso sigue sin terminar: falta que el inquilino pague.
{
  const texto = await dueño.evaluate(() => document.body.innerText);
  if (/Proceso completado/.test(texto)) throw new Error("poner los datos de cobro dio el proceso por terminado");
  if (!/Falta que el inquilino pague/i.test(texto)) throw new Error("no dice que falta el pago del inquilino");
}
ok("poner los datos no es cobrar: el proceso sigue abierto y dice qué falta");

// ---------- lo que ve el inquilino ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Primer canon/i }).first().click();
const suyo = await inq.evaluate(() => document.body.innerText);
for (const frase of ["@marta2025", "Marta Propietaria Gómez", "Comprueba el nombre del titular"]) {
  if (!suyo.includes(frase)) throw new Error(`al inquilino no le muestran "${frase}"`);
}
ok("el inquilino ve la llave, el titular y el aviso de comprobar el nombre");

// La llave se copia: es lo que va a pegar en su banco.
const fila = inq.locator('[data-slot="payout-row"]', { hasText: "Llave Bre-B" });
await fila.getByRole("button", { name: /Copiar/i }).click();
const copiado = await inq.evaluate(() => navigator.clipboard.readText());
if (copiado !== "@marta2025") throw new Error(`copio "${copiado}", esperaba la llave`);
ok("la llave se copia al portapapeles", copiado);

// ---------- el comprobante ----------
/* Sin fecha no se sube: el comprobante sin fecha no dice cuando se pago. */
await inq.setInputFiles("#receipt-file", PHOTO_1);
await inq.waitForFunction(
  () => /Escribe la fecha del pago/.test(document.body.innerText),
  null,
  { timeout: 15000 },
);
ok("sin la fecha del pago no deja subir el comprobante");

await inq.locator("#receipt-date").fill("2026-10-01");
await inq.locator("#receipt-note").fill("Transferencia desde Nequi.");
await inq.setInputFiles("#receipt-file", PHOTO_1);
await inq.waitForFunction(() => /photo-1\.png/.test(document.body.innerText), null, { timeout: 40000 });
ok("el inquilino sube su comprobante con monto y fecha");

// ---------- el propietario responde ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByRole("button", { name: /Primer canon/i }).first().click();
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Comprueba")) {
  throw new Error("al propietario no le advierten de comprobarlo en su cuenta");
}
ok("al propietario le dicen que lo compruebe en su cuenta, no en la captura");

/* Un rechazo sin motivo no pasa: es lo unico que le dice al inquilino que corregir. */
await dueño.getByRole("button", { name: /No llegó/i }).click();
const rechazar = dueño.getByRole("button", { name: /Rechazar el comprobante/i });
if (!(await rechazar.isDisabled())) throw new Error("deja rechazar sin motivo");
await dueño.locator("#verdict-reason").fill("El monto no coincide con el canon.");
await rechazar.click();
await dueño.waitForFunction(() => /Rechazado/.test(document.body.innerText), null, { timeout: 25000 });
ok("rechazar exige motivo, y el motivo queda escrito");

// Y con el comprobante rechazado el proceso sigue sin terminar.
const trasRechazo = await dueño.evaluate(() => document.body.innerText);
if (/Proceso completado/.test(trasRechazo)) {
  throw new Error("con el comprobante rechazado el proceso se da por terminado");
}
if (!trasRechazo.includes(stepLabel("first_payment"))) {
  throw new Error("con el comprobante rechazado no dice en qué paso va");
}
ok("con el comprobante rechazado el proceso sigue abierto en su última etapa");

// ---------- el inquilino sube otro, y el rechazo viejo deja de aplicar ----------
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Primer canon/i }).first().click();
if (!(await inq.evaluate(() => document.body.innerText)).includes("El monto no coincide")) {
  throw new Error("el inquilino no ve el motivo del rechazo");
}
await inq.locator("#receipt-date").fill("2026-10-02");
await inq.setInputFiles("#receipt-file", PHOTO_2);
await inq.waitForFunction(() => /photo-2\.png/.test(document.body.innerText), null, { timeout: 40000 });
/*
 * La regla que importa: el veredicto pertenece al comprobante que juzgo. Un rechazo mas antiguo que
 * el comprobante nuevo deja de contar solo, sin borrar nada — si no, quedaria "rechazado" en
 * pantalla y nada que arreglar.
 */
if (/Rechazado/.test(await inq.evaluate(() => document.body.innerText))) {
  throw new Error("el rechazo viejo sigue aplicando al comprobante nuevo");
}
ok("el rechazo viejo deja de aplicar al subir otro comprobante");

// ---------- confirmar ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByRole("button", { name: /Primer canon/i }).first().click();
await dueño.getByRole("button", { name: /Sí, lo recibí/i }).click();
await dueño.waitForFunction(() => /Canon recibido/.test(document.body.innerText), null, { timeout: 25000 });
ok("el propietario confirma que recibio el canon");

/*
 * **La consecuencia, que es lo nuevo**: confirmar el canon termina el proceso y abre el arriendo,
 * sin que nadie pulse nada más. Se espera a que la insignia lo diga y a que la última tarjeta
 * ofrezca el enlace al arriendo, que es lo único que queda por hacer desde aquí.
 */
await dueño.waitForFunction(
  () => /Proceso completado/.test(document.body.innerText),
  null,
  { timeout: 25000 },
);
if ((await dueño.evaluate(() => document.body.innerText)).includes(stepLabel("first_payment"))) {
  throw new Error("terminado y sigue numerando pasos");
}
const alArriendo = dueño.locator("#etapa-first-payment").getByRole("link", { name: /Ir al arriendo/i });
if ((await alArriendo.count()) !== 1) {
  throw new Error("la última etapa no ofrece el enlace al arriendo");
}
ok("confirmar el canon termina el proceso solo, y desde ahí se va al arriendo");

// Y el arriendo existe de verdad: es la mitad de la promesa que no se ve en la pantalla.
const arrendamiento = await db.collection("leases").doc(applicationId).get();
if (!arrendamiento.exists) throw new Error("confirmar el canon no abrió el arriendo");
const primerMes = await db.collection("leases").doc(applicationId).collection("periods").get();
if (primerMes.empty) throw new Error("el arriendo se abrió sin el primer mes pagado");
ok("el arriendo quedó abierto con su primer mes", `${primerMes.size} mes`);
await dueño.screenshot({ path: `${SHOT_DIR}/primer-canon.png`, fullPage: true });

// ---------- 390px ----------
await inq.setViewportSize({ width: 390, height: 900 });
await settled(inq);
const ancho = await inq.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
if (ancho.doc > ancho.win + 1) throw new Error(`scroll horizontal a 390px: ${JSON.stringify(ancho)}`);
ok("390px sin scroll horizontal");

if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
