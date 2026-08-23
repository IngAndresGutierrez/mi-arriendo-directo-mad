/**
 * La etapa de la entrevista, entera: el propietario propone, al inquilino le llega el aviso,
 * confirma, el propietario escribe la conclusión y solo entonces el proceso avanza.
 */
import { chromium } from "playwright";
import { BASE, MONTHS, config, fixtures, ok, settled } from "./lib.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const requireDelProyecto = createRequire("/Users/andresgutierrez/Projects/proptech/mi-arriendo-directo/package.json");
const { cert, initializeApp } = requireDelProyecto("firebase-admin/app");
const { getFirestore, FieldValue } = requireDelProyecto("firebase-admin/firestore");
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

const env = Object.fromEntries(
  readFileSync("/Users/andresgutierrez/Projects/proptech/mi-arriendo-directo/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
initializeApp({ credential: cert({
  projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
}) });
const db = getFirestore();
const problemas = [];
const b = await chromium.launch();

async function cuenta(email) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
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
await inq.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
ok("proceso creado", new URL(proceso).pathname);


// ---------- el proceso, puesto en la etapa de la garantía ----------
const applicationId = new URL(proceso).pathname.split("/").pop();
await db.collection("applications").doc(applicationId).update({
  stage: "guarantee",
  updatedAt: FieldValue.serverTimestamp(),
});
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 5 de 9"), null, { timeout: 20000 });
ok("el proceso está en la póliza", "paso 5 de 9");

// Sin póliza no se avanza, y lo dice.
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("se puede firmar sin garantía");
}
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Solicita la póliza")) {
  throw new Error("no dice que falta solicitar la póliza");
}
ok("sin póliza el avance está bloqueado y dice por qué");

// ---------- lo que el propietario necesita para cotizar ----------
await dueño.getByRole("button", { name: /Póliza de arrendamiento/i }).first().click();
const visto = await dueño.evaluate(() => document.body.innerText);
for (const frase of ["Sin codeudor", "Pago del arriendo si el inquilino incumple", "cuotas de administración", "Asistencia domiciliaria", "12 meses"]) {
  if (!visto.includes(frase)) throw new Error(`falta en el panel: "${frase}"`);
}
ok("el panel dice qué cubre, sin codeudor y con el tope de 12 meses");

const cotizar = dueño.getByRole("link", { name: /Cotizar en Sura/i });
if ((await cotizar.getAttribute("href")) !== "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador") {
  throw new Error("el enlace de cotización no es el de Sura: " + (await cotizar.getAttribute("href")));
}
if ((await cotizar.getAttribute("target")) !== "_blank") throw new Error("no abre en otra pestaña");
ok("y ofrece cotizar en Sura, en otra pestaña");

/*
 * El correo y la matrícula se comprobaban aquí, sobre el `body`. Ahora viven en el diálogo con
 * los otros ocho datos, así que se verifican más abajo, dentro de él — que además es donde se
 * puede afirmar que están *en la hoja* y no simplemente en algún sitio de la página.
 */

// ---------- el plan, a la vista sin abrir nada ----------
/*
 * Fuera del diálogo a propósito: es la única instrucción de la etapa y esconderla detrás de un
 * clic es como no darla. Se comprueba antes de abrir nada.
 */
if (!/Elige siempre el plan Plus/i.test(visto)) throw new Error("el plan Plus no está a la vista");
ok("el plan Plus se lee sin abrir nada");

// ---------- la hoja de datos, dentro del diálogo ----------
await dueño.getByRole("button", { name: /Ver los datos del cotizador/i }).click();
const hoja = dueño.getByRole("dialog");
await hoja.waitFor({ state: "visible", timeout: 15000 });
/*
 * Se lee dentro del diálogo, no en el `body`: "Caldas", "Manizales" y el monto también salen en
 * la tarjeta del inmueble, así que buscarlos en toda la página pasaría aunque la hoja estuviera
 * vacía.
 */
const enLaHoja = await hoja.innerText();
for (const [que, valor] of [
  ["el arriendo", "1.800.000"],
  ["la duración", "meses"],
  ["el departamento", "Caldas"],
  ["la ciudad", "Manizales"],
  ["la dirección", "Calle 60 #10-20"],
  ["la matrícula", "050-123456"],
  ["el nombre del inquilino", INQ_NOMBRE],
  ["el tipo de documento", "Cédula de ciudadanía"],
  ["el número de documento", "1053812345"],
  ["el correo del inquilino", inqEmail],
]) {
  if (!enLaHoja.includes(valor)) throw new Error(`la hoja no trae ${que}: ${valor}`);
}
ok("la hoja trae los diez datos del cotizador", "inmueble e inquilino");

/*
 * Lo que importa no es que el monto se vea bonito, es que lo que llega al portapapeles sea
 * pegable en un campo numérico: `$ 1.800.000` lo rechaza. Se asserta el portapapeles, no el texto.
 */
await hoja
  .locator('[data-slot="copy-row"]', { hasText: "Valor mensual del arrendamiento" })
  .getByRole("button", { name: /Copiar/i })
  .click();
const copiado = await dueño.evaluate(() => navigator.clipboard.readText());
if (copiado !== "1800000") throw new Error(`copió "${copiado}", esperaba los dígitos sin formato`);
ok("el monto se muestra formateado y se copia sin puntos ni signo", `"1.800.000" → "${copiado}"`);

// Copiar no cierra el diálogo: si lo cerrara habría que reabrirlo por cada uno de los diez.
if (!(await hoja.isVisible())) throw new Error("copiar cerró el diálogo");
ok("copiar no cierra el diálogo");

await dueño.screenshot({ path: `${SHOT_DIR}/poliza-datos.png`, fullPage: true });
await dueño.keyboard.press("Escape");
await hoja.waitFor({ state: "hidden", timeout: 10000 });
ok("y se cierra con Escape");
await dueño.screenshot({ path: `${SHOT_DIR}/poliza.png`, fullPage: true });

// ---------- el inquilino ve lo mismo, menos la matrícula ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Póliza de arrendamiento/i }).first().click();
const suyo = await inq.evaluate(() => document.body.innerText);
if (!suyo.includes("Pago del arriendo si el inquilino incumple")) throw new Error("el inquilino no ve qué cubre");
if (!suyo.includes("No necesitas codeudor")) throw new Error("no le dicen que no necesita codeudor");
if (suyo.includes("050-123456")) throw new Error("¡el inquilino ve la matrícula inmobiliaria!");
if (suyo.includes("Cotizar en Sura")) throw new Error("al inquilino le ofrecen cotizar");
ok("el inquilino ve las coberturas, no la matrícula ni el botón de cotizar");

// ---------- solicitada: sigue bloqueado ----------
/*
 * Sin botón: el campo se guarda solo al dejar de escribir. Escribir la nota es lo que dice "ya la
 * solicité", así que el estado pasa a "En estudio" sin que nadie pulse nada — que es exactamente
 * lo que se comprueba aquí. Antes había un submit para este único campo.
 */
await dueño.locator("#guarantee-request-note").fill("Ya la solicité, están estudiando el caso.");
await dueño.waitForFunction(() => /Guardado\./.test(document.body.innerText), null, { timeout: 20000 });
ok("la nota se guarda sola, sin botón");
await dueño.waitForFunction(() => document.body.innerText.includes("En estudio"), null, { timeout: 20000 });
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("una solicitud en estudio deja avanzar");
}
ok("solicitada pero en estudio, todavía no se puede avanzar");

await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
if (!(await inq.evaluate(() => document.body.innerText)).includes("Están tramitando la póliza")) {
  throw new Error("al inquilino no le avisaron del trámite");
}
ok("al inquilino le avisan de que la están tramitando");
await inq.keyboard.press("Escape");

// ---------- el enlace para el inquilino, ya en estudio ----------
/*
 * Va después de "Ya la solicité" porque guardar el enlace también marca la póliza como
 * solicitada: si fuese antes, el campo de la nota ya no estaría y el driver estaría probando
 * un camino que el producto no ofrece.
 */
const campoEnlace = dueño.locator("#guarantee-tenant-link");
const abrirPanel = async (pagina) => {
  await pagina.getByRole("button", { name: /Póliza de arrendamiento/i }).first().click();
};

/*
 * Este enlace lo pega el propietario y lo abre el inquilino, desde una página en la que confía.
 * Sin botón, la protección ya no se ve en un control deshabilitado, así que lo que se comprueba es
 * lo que de verdad importa: que un host ajeno **no se guarde**. Se recarga para preguntárselo al
 * servidor y no a la pantalla.
 */
await campoEnlace.fill("https://sura.co.example.com/phishing");
await dueño.waitForTimeout(2000);
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await abrirPanel(dueño);
if ((await dueño.locator("#guarantee-tenant-link").inputValue()).includes("example.com")) {
  throw new Error("guardó un enlace que no es de Sura");
}
ok("un enlace que solo parece de Sura no se guarda");

const ENLACE = "https://ecomm.sura.co/seguros/hogar/arriendo/inquilino/resumen-proceso?quoteId=E0SGqCQ";
await dueño.locator("#guarantee-tenant-link").fill(ENLACE);
await dueño.waitForFunction(() => /Guardado\./.test(document.body.innerText), null, { timeout: 25000 });
ok("el enlace de Sura se guarda solo, sin botón");

// Y quedó guardado de verdad, no solo dicho en pantalla.
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await abrirPanel(dueño);
if ((await dueño.locator("#guarantee-tenant-link").inputValue()) !== ENLACE) {
  throw new Error("el enlace no sobrevivió a la recarga");
}
ok("y sobrevive a la recarga");

/*
 * La pantalla del inquilino se cargó antes de que el propietario pegara el enlace. La página se
 * refresca sola con la suscripción, pero aquí se recarga a propósito para no depender de cuándo
 * llegue: lo que se está probando es el enlace, no el tiempo de propagación. Y hay que volver a
 * abrir el panel, porque arrancan plegados.
 */
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Póliza de arrendamiento/i }).first().click();

const suEnlace = inq.getByRole("link", { name: /Continuar en Sura/i });
if (!(await suEnlace.count())) throw new Error("al inquilino no le ofrecen continuar su parte");
if ((await suEnlace.getAttribute("href")) !== ENLACE) {
  throw new Error("el enlace del inquilino no es el que pegó el propietario: " + (await suEnlace.getAttribute("href")));
}
if ((await suEnlace.getAttribute("target")) !== "_blank") throw new Error("no abre en otra pestaña");
ok("y tiene su propio enlace para continuar en Sura, el que pegó el propietario");

// ---------- expedida: avanza ----------
await dueño.locator("#guarantee-policy").fill("AR-99123");
await dueño.getByRole("button", { name: /Registrar la póliza/i }).click();
await dueño.waitForFunction(() => document.body.innerText.includes("Póliza activa"), null, { timeout: 20000 });
await dueño.waitForFunction(() => {
  const boton = [...document.querySelectorAll("button")].find((b) => /Continuar a/i.test(b.textContent ?? ""));
  return boton && boton.getAttribute("aria-disabled") !== "true";
}, null, { timeout: 15000 }).catch(() => { throw new Error("con la póliza registrada sigue bloqueado"); });
ok("con la póliza registrada, el proceso puede avanzar");

await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
const avisoFinal = await inq.evaluate(() => document.body.innerText);
if (!avisoFinal.includes("La póliza quedó activa")) throw new Error("no le avisaron de la póliza activa");
if (!avisoFinal.includes("AR-99123")) throw new Error("el aviso no dice cuál es la póliza");
ok("y al inquilino le llega el número de la póliza");
await inq.keyboard.press("Escape");

await inq.setViewportSize({ width: 390, height: 844 });
if (await inq.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
