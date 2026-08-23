// Comprueba lo que se ve: los dos botones a la misma altura y el de rechazar al extremo.
import { chromium } from "playwright";
import { BASE, config, fixtures, ok, settled } from "./lib.mjs";
import { openSession as libOpenSession } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
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
await owner.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await owner.getByLabel("Descripción").fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await owner.getByLabel("Área (m²)").fill("70");
await owner.getByLabel("Habitaciones").fill("2");
await owner.getByLabel("Baños").fill("2");
await owner.getByLabel("Estrato").click(); await owner.getByRole("option", { name: "Estrato 4" }).click();
await owner.getByLabel("Parqueadero").click(); await owner.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await owner.getByLabel("Departamento").click(); await owner.getByRole("option", { name: "Caldas", exact: true }).click();
await owner.getByLabel("Ciudad").click(); await owner.getByRole("option", { name: "Manizales", exact: true }).click();
await owner.getByLabel("Barrio").fill("Palermo");
await owner.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await owner.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await owner.getByLabel("Canon mensual (COP)").click(); await owner.keyboard.type("1800000");
await owner.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await owner.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await owner.getByRole("button", { name: /Publicar inmueble/i }).click();
await owner.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(owner);
const listingPath = await owner.locator("li", { hasText: `Apartamento con balcón en Palermo ${STAMP}` }).getByRole("link", { name: `Apartamento con balcón en Palermo ${STAMP}` }).first().getAttribute("href");

const tenant = await openSession(tenantEmail, "Ana Inquilina Pérez");
await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
await tenant.getByRole("link", { name: "Postularme" }).click();
await tenant.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(tenant);
await tenant.getByLabel("Número de documento").fill("1053812345");
await tenant.getByLabel("Dónde trabajas").fill("Crehana");
await tenant.getByLabel("Ingresos mensuales (COP)").click(); await tenant.keyboard.type("6000000");
await tenant.getByLabel("Personas que vivirían ahí").fill("2");
await tenant.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await tenant.getByLabel("Qué relación tienen").fill("Jefe directo");
await tenant.getByLabel("Teléfono de tu referencia").fill("3009876543");
await tenant.getByLabel("Cuándo te mudarías").fill("2026-10-01");
await tenant.getByRole("button", { name: /Enviar postulación/i }).click();
await tenant.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(tenant);
const processUrl = tenant.url();

await owner.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(owner);
const seguir = await owner.getByRole("button", { name: /Continuar a/ }).boundingBox();
const rechazar = await owner.getByRole("button", { name: /Rechazar postulación/ }).boundingBox();
if (Math.abs(seguir.height - rechazar.height) > 1) throw new Error(`alturas distintas: ${seguir.height} vs ${rechazar.height}`);
ok("los dos botones miden lo mismo de alto", `${Math.round(seguir.height)}px`);
if (Math.round(seguir.y) !== Math.round(rechazar.y)) throw new Error("no están en la misma fila");
ok("están en la misma fila");
const fila = await owner.locator("div").filter({ has: owner.getByRole("button", { name: /Rechazar postulación/ }) }).last().boundingBox();
const gapDerecha = fila.x + fila.width - (rechazar.x + rechazar.width);
const gapEntre = rechazar.x - (seguir.x + seguir.width);
if (gapDerecha > 4) throw new Error(`no queda pegado a la derecha: ${Math.round(gapDerecha)}px de sobra`);
if (gapEntre < 40) throw new Error(`quedó junto al otro botón: ${Math.round(gapEntre)}px entre ellos`);
ok("rechazar queda al extremo derecho, lejos del principal", `${Math.round(gapEntre)}px de separación`);
await owner.screenshot({ path: `${SHOT_DIR}/acciones.png`, clip: { x: 0, y: Math.max(0, seguir.y - 60), width: 1440, height: 200 } });

// Y en móvil no se salen.
await owner.setViewportSize({ width: 390, height: 844 });
await owner.reload({ waitUntil: "domcontentloaded" });
const overflow = await owner.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");
await b.close();
