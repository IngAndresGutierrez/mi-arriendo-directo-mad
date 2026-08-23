/** El resumen de la postulación: tres datos con su rótulo, legibles de un vistazo. */
import { chromium } from "playwright";
import { BASE, config, createAccount, fixtures, MONTHS, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

async function cuenta(email) {
  await createAccount(API_KEY, email);
}
async function entrar(b, email, nombre) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
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
const dueñoEmail = `shotown-${STAMP}@miarriendodirecto.test`;
const inqEmail = `shotinq-${STAMP}@miarriendodirecto.test`;
await cuenta(dueñoEmail); await cuenta(inqEmail);
const b = await chromium.launch();
const dueño = await entrar(b, dueñoEmail, "Ana Propietaria Pérez");

await dueño.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Título del anuncio").fill(`Apartaestudio en los Alcazares ${STAMP}`);
await dueño.getByLabel("Descripción").fill("Apartaestudio con cocina integral, zona de ropas y balcón, a dos cuadras del parque.");
await dueño.getByLabel("Área (m²)").fill("45");
await dueño.getByLabel("Habitaciones").fill("1");
await dueño.getByLabel("Baños").fill("1");
await dueño.getByLabel("Estrato").click(); await dueño.getByRole("option", { name: "Estrato 4" }).click();
await dueño.getByLabel("Parqueadero").click(); await dueño.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await dueño.getByLabel("Departamento").click(); await dueño.getByRole("option", { name: "Caldas", exact: true }).click();
await dueño.getByLabel("Ciudad").click(); await dueño.getByRole("option", { name: "Manizales", exact: true }).click();
await dueño.getByLabel("Barrio").fill("Los Alcazares");
await dueño.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await dueño.getByLabel("Canon mensual (COP)").click(); await dueño.keyboard.type("1400000");
await dueño.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await dueño.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await dueño.getByRole("button", { name: /Publicar inmueble/i }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);
const href = await dueño.locator("li", { hasText: `Apartaestudio en los Alcazares ${STAMP}` }).getByRole("link").first().getAttribute("href");

const inq = await entrar(b, inqEmail, "Carlos Inquilino Ramírez");
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
const enUnMes = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
await inq.getByLabel("Cuándo te mudarías").fill(enUnMes);
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
ok("postulación creada", new URL(proceso).pathname);

await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.waitForSelector("h1", { timeout: 15000 });
const datos = await dueño.evaluate(() => {
  const dl = document.querySelector("section dl");
  return [...dl.children].map((d) => ({
    rotulo: d.querySelector("dt").innerText.trim(),
    valor: d.querySelector("dd").innerText.trim(),
    mayusculas: getComputedStyle(d.querySelector("dt")).textTransform,
  }));
});
if (datos.length !== 3) throw new Error("no son tres datos: " + JSON.stringify(datos));
if (datos.some((d) => d.mayusculas !== "none")) throw new Error("algún rótulo sigue en mayúsculas");
console.log("   " + datos.map((d) => `${d.rotulo}: ${d.valor}`).join(" | "));
ok("tres datos con su rótulo, sin mayúsculas sostenidas");
const caja = await dueño.locator("section").filter({ hasText: "La postulación" }).first().boundingBox();
await dueño.screenshot({ path: `${SHOT_DIR}/postulacion.png`, clip: { x: caja.x - 10, y: caja.y - 90, width: Math.min(caja.width + 20, 1080), height: 230 } });
await b.close();
