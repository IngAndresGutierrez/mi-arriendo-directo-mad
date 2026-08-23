// El otro lado de la moneda: quien se retira por su cuenta sí puede volver a postularse.
import { chromium } from "playwright";
import { BASE, config, fixtures, ok, settled } from "./lib.mjs";
import { openSession as libOpenSession } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
// Publicar termina en el listado: el enlace del anuncio sale de la tarjeta que acaba de aparecer.
async function listingPathOf(page, title) {
  const href = await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: title })
    .first()
    .getAttribute("href");
  if (!href) throw new Error(`no encontré el anuncio de "${title}" en el listado`);
  return href;
}
const ownerEmail = `owner-${STAMP}@miarriendodirecto.test`;
const tenantEmail = `renter-${STAMP}@miarriendodirecto.test`;
for (const email of [ownerEmail, tenantEmail]) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
}
const b = await chromium.launch();
// Estos dos drivers no vigilaban la consola: la copia local de openSession no la enganchaba.
const problems = [];
const openSession = (email, name) => libOpenSession(b, { email, name, problems });
const owner = await openSession(ownerEmail, "Marta Propietaria Gómez");
await owner.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.getByLabel("Título del anuncio").fill(`Casa con jardín en Palermo ${STAMP}`);
await owner.getByLabel("Descripción").fill("Tres habitaciones, cocina integral y jardín interior con zona de ropas.");
await owner.getByLabel("Área (m²)").fill("90");
await owner.getByLabel("Habitaciones").fill("3");
await owner.getByLabel("Baños").fill("2");
await owner.getByLabel("Estrato").click(); await owner.getByRole("option", { name: "Estrato 4" }).click();
await owner.getByLabel("Parqueadero").click(); await owner.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await owner.getByLabel("Departamento").click(); await owner.getByRole("option", { name: "Caldas", exact: true }).click();
await owner.getByLabel("Ciudad").click(); await owner.getByRole("option", { name: "Manizales", exact: true }).click();
await owner.getByLabel("Barrio").fill("Palermo");
await owner.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await owner.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await owner.getByLabel("Canon mensual (COP)").click(); await owner.keyboard.type("2000000");
await owner.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await owner.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await owner.getByRole("button", { name: /Publicar inmueble/i }).click();
await owner.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(owner);
const listingPath = await listingPathOf(owner, `Casa con jardín en Palermo ${STAMP}`);

const tenant = await openSession(tenantEmail, "Ana Inquilina Pérez");
async function apply() {
  await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
  await settled(tenant);
  await tenant.getByRole("link", { name: "Postularme" }).click();
  await tenant.waitForURL(/\/postularme\//, { timeout: 20000 });
  await settled(tenant);
  await tenant.getByLabel("Número de documento").fill("1053812345");
  await tenant.getByLabel("Dónde trabajas").fill("Crehana");
  // La segunda vez el campo llega lleno desde el perfil: escribir encima concatena.
  await tenant.getByLabel("Ingresos mensuales (COP)").click();
  await tenant.keyboard.press("ControlOrMeta+a");
  await tenant.keyboard.type("6000000");
  await tenant.getByLabel("Personas que vivirían ahí").fill("2");
  await tenant.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
  await tenant.getByLabel("Qué relación tienen").fill("Jefe directo");
  await tenant.getByLabel("Teléfono de tu referencia").fill("3009876543");
  await tenant.getByLabel("Cuándo te mudarías").fill("2026-10-01");
  await tenant.getByRole("button", { name: /Enviar postulación/i }).click();
  try {
    await tenant.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 30000 });
    await settled(tenant);
  } catch {
    const alert = await tenant.locator("form p.text-destructive, form [role=\"alert\"]").allInnerTexts();
    throw new Error(`no entró. URL=${tenant.url()} · alertas=${JSON.stringify(alert)}`);
  }
}
await apply();
ok("se postula");

await tenant.getByRole("button", { name: /Retirar mi postulación/i }).click();
const dialog = tenant.getByRole("dialog");
await dialog.waitFor({ state: "visible" });
await dialog.getByRole("button", { name: "Retirar postulación" }).click();
await tenant.waitForFunction(() => document.body.innerText.includes("Retirada"), null, { timeout: 20000 });
ok("se retira por su cuenta");

await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
if (await tenant.getByRole("link", { name: "Postularme" }).count() === 0) throw new Error("quien se retiró queda bloqueado para siempre");
ok("quien se retiró SÍ puede volver a postularse", "el botón sigue ahí");
await apply();
ok("y la segunda postulación entra");
await b.close();
