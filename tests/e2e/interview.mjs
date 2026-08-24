/**
 * La etapa de la entrevista, entera: el propietario propone, al inquilino le llega el aviso,
 * confirma, el propietario escribe la conclusión y solo entonces el proceso avanza.
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
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

/*
 * El Admin SDK de `lib.mjs`, no uno propio. Este driver se inicializaba solo con la cuenta de
 * servicio *real* leída de `.env.local`, así que contra los emuladores escribía en el proyecto
 * equivocado y moría antes de su primera aserción.
 */
const db = adminDb();
const FieldValue = adminFieldValue();
const problemas = [];
const b = await chromium.launch();

async function cuenta(email) {
  await createAccount(API_KEY, email);
}
async function entrar(email, nombre) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
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
  await acceptLegalConsents(p);
  await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
  await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
  return p;
}

const dueñoEmail = `entdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `entinq-${STAMP}@miarriendodirecto.test`;
await cuenta(dueñoEmail); await cuenta(inqEmail);
const dueño = await entrar(dueñoEmail, "Ana Propietaria Pérez");
const inq = await entrar(inqEmail, "Carlos Inquilino Ramírez");

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
await declareReferenceAuthorized(inq);
await inq.getByLabel("Cuándo te mudarías").fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
ok("proceso creado", new URL(proceso).pathname);

/*
 * Las tres etapas anteriores tienen su propio trabajo (subir documentos, aprobarlos, autorizar y
 * registrar cuatro consultas) y ya se prueban en `documents.mjs`. Aquí interesa la entrevista, así
 * que el proceso se coloca en esa etapa por detrás en vez de repetir media hora de clics.
 */
const applicationId = new URL(proceso).pathname.split("/").pop();
await db.collection("applications").doc(applicationId).update({
  stage: "interview",
  updatedAt: FieldValue.serverTimestamp(),
});
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 4 de 7"), null, { timeout: 20000 });
ok("el proceso está en la entrevista", "paso 4 de 7");

// ---------- sin proponer nada, no se puede avanzar ----------
const bloqueado = await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled");
if (bloqueado !== "true") throw new Error("se puede avanzar sin haber agendado la entrevista");
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Propón una fecha")) {
  throw new Error("no dice por qué está bloqueado");
}
ok("sin agendar, el avance está bloqueado y dice por qué");

// ---------- el propietario propone ----------
await dueño.getByRole("button", { name: /Entrevista con el propietario/i }).first().click();
const dia = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
await dueño.locator("#interview-day").fill(dia);
await dueño.locator("#interview-time").fill("15:00");
await dueño.locator("#interview-link").fill("https://meet.google.com/abc-defg-hij");
await dueño.locator("#interview-note").fill("Si no te sirve, dime qué días puedes.");
{
  // El propietario tiene a mano dónde crear la reunión; el inquilino no ve ese enlace.
  const crear = dueño.getByRole("link", { name: /Crear la reunión en Google Meet/i });
  if ((await crear.getAttribute("href")) !== "https://meet.new") throw new Error("falta el enlace para crear el Meet");
  if ((await crear.getAttribute("target")) !== "_blank") throw new Error("el enlace no abre en otra pestaña");
  ok("el propietario tiene el enlace para crear la reunión");
}
{
  const caja = await dueño.locator("div").filter({ hasText: "Propón la entrevista de 30 minutos" }).last().boundingBox();
  await dueño.screenshot({ path: `${SHOT_DIR}/entrevista-form.png`, clip: { x: caja.x - 10, y: caja.y - 10, width: caja.width + 20, height: Math.min(caja.height + 20, 700) } });
}
await dueño.getByRole("button", { name: /Proponer y avisar/i }).click();
await dueño.waitForFunction(() => document.body.innerText.includes("Sin confirmar"), null, { timeout: 20000 });
ok("el propietario propone fecha, hora y enlace de Meet");

// ---------- al inquilino le llega ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Entrevista con el propietario/i }).first().click();
const visto = await inq.evaluate(() => document.body.innerText);
if (!visto.includes("3:00 p. m. a 3:30 p. m.")) throw new Error("el inquilino no ve la media hora: " + visto.slice(0, 300));
if (visto.includes("Entrar a la videollamada")) throw new Error("ofrece el enlace antes de confirmar");
if (visto.includes("Crear la reunión")) throw new Error("al inquilino le ofrece crear la reunión");
{
  const caja = await inq.locator("section, li").filter({ hasText: "Sin confirmar" }).last().boundingBox();
  await inq.screenshot({ path: `${SHOT_DIR}/entrevista-inquilino.png`, clip: { x: caja.x, y: caja.y - 40, width: caja.width, height: Math.min(caja.height + 80, 620) } });
}
ok("el inquilino ve la cita, sin enlace todavía");

await inq.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
const campana = await inq.evaluate(() => document.body.innerText);
if (!campana.includes("Te proponen una hora para la entrevista")) throw new Error("no llegó la notificación");
ok("y le llegó el aviso a la campana");
await inq.keyboard.press("Escape");

// ---------- confirma ----------
await inq.getByRole("button", { name: /Confirmar el horario/i }).click();
await inq.waitForFunction(() => document.body.innerText.includes("Confirmada"), null, { timeout: 20000 });
if (!(await inq.evaluate(() => document.body.innerText)).includes("Entrar a la videollamada")) {
  throw new Error("tras confirmar no aparece el enlace");
}
ok("confirma y entonces sí aparece el enlace");

// ---------- el propietario sigue bloqueado hasta escribir la conclusión ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("avanza sin conclusión de la entrevista");
}
const dice = await dueño.evaluate(() => document.body.innerText);
if (!dice.includes("escribe cómo te fue")) throw new Error("no explica que falta la conclusión");
ok("confirmada pero sin conclusión, sigue sin poder avanzar");

// El aviso de la confirmación vive en la campana, no en la página.
await dueño.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
const avisos = await dueño.evaluate(() => document.body.innerText);
if (!avisos.includes("La entrevista quedó confirmada")) throw new Error("al propietario no le avisaron de la confirmación");
ok("al propietario le avisan de la confirmación");
await dueño.keyboard.press("Escape");

await dueño.getByRole("button", { name: /Entrevista con el propietario/i }).first().click();
await dueño.locator("#interview-feedback").fill("Habló claro sobre su trabajo y quedó de enviar el soporte de ingresos.");
await dueño.getByRole("button", { name: /Guardar la conclusión/i }).click();
await dueño.waitForFunction(() => document.body.innerText.includes("Salió bien"), null, { timeout: 20000 });
ok("el propietario registra la conclusión");

// ---------- y ahora sí avanza ----------
const avanzar = dueño.getByRole("button", { name: /Continuar a/i }).first();
// Se espera al refresco del servidor antes de juzgar: el panel se actualiza antes que el botón.
await dueño
  .waitForFunction(() => {
    const boton = [...document.querySelectorAll("button")].find((b) => /Continuar a/i.test(b.textContent ?? ""));
    return boton && boton.getAttribute("aria-disabled") !== "true";
  }, null, { timeout: 15000 })
  .catch(() => { throw new Error("sigue bloqueado con la conclusión escrita"); });
await avanzar.click();
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 5 de 7"), null, { timeout: 25000 });
ok("con la conclusión escrita, el proceso avanza", "paso 5 de 7");

// el inquilino lee la conclusión, y la etapa cerrada conserva su panel sin botones
await inq.reload({ waitUntil: "domcontentloaded" });
await inq.getByRole("button", { name: /Entrevista con el propietario/i }).first().click();
const cerrada = await inq.evaluate(() => document.body.innerText);
if (!cerrada.includes("Habló claro sobre su trabajo")) throw new Error("el inquilino no lee la conclusión");
if (cerrada.includes("Confirmar el horario")) throw new Error("una etapa pasada sigue ofreciendo botones");
ok("el inquilino lee la conclusión y la etapa pasada no ofrece botones");

await inq.setViewportSize({ width: 390, height: 844 });
if (await inq.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

// ---------- /inicio muestra el arriendo en curso ----------
await inq.setViewportSize({ width: 1100, height: 1000 });
await inq.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(inq);
const inicio = await inq.evaluate(() => document.body.innerText);
if (inicio.includes("Todavía no tienes")) throw new Error("Inicio dice que no hay nada teniendo un proceso abierto");
if (!inicio.includes("Tus contratos en curso")) throw new Error("Inicio no lista los contratos");
if (!inicio.includes(`Apartamento con balcón en Palermo ${STAMP}`)) throw new Error("no nombra el inmueble");
if (!inicio.includes("Paso 5 de 7")) throw new Error("no dice en qué etapa va: " + inicio.slice(0, 400));
ok("Inicio muestra el arriendo en curso con su etapa");
{
  const caja = await inq.locator("section").filter({ hasText: "Tus contratos en curso" }).first().boundingBox().catch(() => null);
  if (caja) await inq.screenshot({ path: `${SHOT_DIR}/inicio-arriendos.png`, clip: caja });
}
await inq.getByRole("link", { name: /Apartamento con balcón en Palermo/ }).first().click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 20000 });
await settled(inq);
ok("y desde ahí se entra al proceso");

await dueño.screenshot({ path: `${SHOT_DIR}/entrevista.png`, fullPage: true });
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
