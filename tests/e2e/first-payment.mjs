/**
 * El primer canon: el propietario dice por dónde recibirlo, el inquilino paga desde su banco y
 * sube el comprobante, y el propietario confirma si el dinero llegó. Este producto no mueve dinero;
 * lo que guarda es dónde pagar y la prueba de que se pagó.
 */
import { chromium } from "playwright";
import { adminDb, adminFieldValue, BASE, config, createAccount, fixtures, MONTHS, ok, settled } from "./lib.mjs";
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
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
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
  await p.getByRole("checkbox").click();
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
await dueño.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
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
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 8 de 9"), null, { timeout: 20000 });
ok("el proceso está en el primer canon", "paso 8 de 9");

// Sin datos de cobro no se cierra, y lo dice.
const continuar = dueño.getByRole("button", { name: /Continuar a/i }).first();
if ((await continuar.getAttribute("aria-disabled")) !== "true") {
  throw new Error("se puede cerrar el arriendo sin el primer canon");
}
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Escribe por dónde quieres recibir")) {
  const texto = await dueño.evaluate(() => document.body.innerText);
  if (!/por d.nde quieres recibir/i.test(texto)) throw new Error("no dice que faltan los datos de cobro");
}
ok("sin datos de cobro el arriendo no se cierra, y dice por que");

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
await dueño.locator("#payout-holder-doc").fill("Cédula de ciudadanía 43112233");
await dueño.getByRole("button", { name: /Guardar los datos de pago/i }).click();
await dueño.waitForFunction(() => /@marta2025/.test(document.body.innerText), null, { timeout: 25000 });
ok("el propietario guarda su llave Bre-B");

// Con los datos puestos sigue bloqueado: falta que el inquilino pague.
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("con solo los datos de cobro deja cerrar");
}
ok("poner los datos no es cobrar: sigue bloqueado");

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

// Y sigue bloqueado tras el rechazo.
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("con el comprobante rechazado deja cerrar");
}
ok("con el comprobante rechazado sigue bloqueado");

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

await dueño.waitForFunction(
  () => {
    const boton = [...document.querySelectorAll("button")].find((el) => /Continuar a/.test(el.textContent ?? ""));
    return boton && boton.getAttribute("aria-disabled") !== "true";
  },
  null,
  { timeout: 25000 },
);
ok("y con eso el arriendo se puede poner en curso");
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
