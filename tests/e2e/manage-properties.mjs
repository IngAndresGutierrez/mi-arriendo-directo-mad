import { chromium } from "playwright";
import { BASE, MONTHS, config, fillBirthdate, fixtures, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
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
const email = `manage-${STAMP}@miarriendodirecto.test`;
const su = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
console.log("UID=" + su.localId);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 120)); });

await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await p.getByRole("checkbox").click();
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

// --- lista vacía ---
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.textContent("body")).includes("Todavía no has publicado ninguno")) throw new Error("falta el estado vacío");
ok("la lista arranca con su estado vacío");

// --- publicar uno ---
await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByLabel("Título del anuncio").fill(`Casa amplia con patio en Palermo ${STAMP}`);
await p.getByLabel("Descripción").fill("Casa de tres habitaciones con patio interior, cocina integral y zona de ropas independiente.");
await p.getByLabel("Área (m²)").fill("120");
await p.getByLabel("Habitaciones").fill("3");
await p.getByLabel("Baños").fill("2");
await p.getByLabel("Estrato").click(); await p.getByRole("option", { name: "Estrato 4" }).click();
await p.getByLabel("Parqueadero").click(); await p.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await p.getByLabel("Departamento").click(); await p.getByRole("option", { name: "Caldas", exact: true }).click();
await p.getByLabel("Ciudad").click(); await p.getByRole("option", { name: "Manizales", exact: true }).click();
await p.getByLabel("Barrio").fill("Palermo");
await p.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await p.getByLabel("Canon mensual (COP)").click(); await p.keyboard.type("2500000");
await p.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await p.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await p.getByRole("button", { name: /Publicar inmueble/i }).click();
await p.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(p);
const publishedPath = await listingPathOf(p, `Casa amplia con patio en Palermo ${STAMP}`);
const publishedUrl = BASE + publishedPath;
ok("publicado, y termina en el listado", publishedPath);

// --- aparece en la lista ---
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.textContent("body")).includes(`Casa amplia con patio en Palermo ${STAMP}`)) throw new Error("no aparece en la lista");
ok("aparece en Mis inmuebles", "1 publicado");

// --- copiar enlace ---
await p.getByRole("button", { name: /Copiar enlace/i }).click();
await p.waitForSelector("text=Enlace copiado", { timeout: 5000 });
const clip = await p.evaluate(() => navigator.clipboard.readText());
// Contra la URL real del anuncio, no contra un slug escrito a mano: el slug lo compone el
// producto a partir del título, así que replicarlo aquí sería mantener dos veces la misma
// regla — y al añadir el stamp al título, la copia de la prueba se quedó vieja.
if (clip !== publishedUrl) throw new Error(`copió ${clip}, esperaba ${publishedUrl}`);
ok("copia el enlace al portapapeles", clip.replace("http://localhost:3000", ""));
await p.screenshot({ path: `${SHOT_DIR}/mis-inmuebles.png`, fullPage: true });

// --- editar ---
await p.getByRole("link", { name: /Editar/i }).click();
await p.waitForURL(/\/editar$/, { timeout: 20000 });
await settled(p);
const titleField = p.getByLabel("Título del anuncio");
if ((await titleField.inputValue()) !== `Casa amplia con patio en Palermo ${STAMP}`) throw new Error("el formulario no llegó con los datos");
if ((await p.getByLabel("Dirección", { exact: true }).inputValue()) !== "Calle 60 #10-20") throw new Error("falta la dirección privada");
ok("el formulario de edición llega lleno", "incluida la dirección privada");

// --- quitar una foto pide confirmación ---
await p.getByRole("button", { name: "Quitar la foto 2" }).click();
await p.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
if (!(await p.getByRole("dialog").textContent()).includes("¿Quitar esta foto?")) throw new Error("otro diálogo");
await p.getByRole("button", { name: "Cancelar" }).click();
await p.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
if ((await p.locator('img[alt="Foto 2"]').count()) !== 1) throw new Error("cancelar borró la foto igual");
ok("quitar una foto pide confirmación, y cancelar no la quita");

await titleField.fill(`Casa remodelada con patio en Palermo ${STAMP}`);
await p.getByRole("button", { name: /Guardar cambios/i }).click();
// Guardar una edición vuelve al listado, no al anuncio: la corrección no es algo que ir a ver.
await p.waitForURL((u) => new URL(u).pathname === "/mis-inmuebles", { timeout: 40000 });
await settled(p);
if (!(await p.evaluate(() => document.body.innerText)).includes(`Casa remodelada con patio en Palermo ${STAMP}`)) {
  throw new Error("el listado no trae el título nuevo");
}
ok("al guardar, vuelve al listado con el título nuevo", new URL(p.url()).pathname);

// El enlace nuevo se lo pedimos al producto en vez de deducirlo del título.
await p.getByRole("button", { name: /Copiar enlace/i }).click();
await p.waitForSelector("text=Enlace copiado", { timeout: 5000 });
const editedUrl = await p.evaluate(() => navigator.clipboard.readText());
if (editedUrl === publishedUrl) throw new Error("el enlace no cambió al cambiar el título");
const nuevo = await p.goto(editedUrl, { waitUntil: "domcontentloaded" });
if (nuevo.status() !== 200) throw new Error("el enlace nuevo no responde: " + nuevo.status());
ok("el enlace sigue al título nuevo", new URL(p.url()).pathname);

const oldStill = await p.goto(publishedUrl, { waitUntil: "domcontentloaded" });
ok("y el enlace anterior no muere", `${oldStill.status()} en ${new URL(p.url()).pathname}`);

// --- eliminar pide confirmación ---
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByRole("button", { name: /^Eliminar$/ }).click();
await p.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
const dialogText = await p.getByRole("dialog").textContent();
if (!dialogText.includes(`Casa remodelada con patio en Palermo ${STAMP}`)) throw new Error("el diálogo no dice qué se borra");
await p.getByRole("button", { name: "Cancelar" }).click();
await p.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
if (!(await p.textContent("body")).includes("Casa remodelada")) throw new Error("cancelar lo borró igual");
ok("eliminar pide confirmación nombrando el inmueble, y cancelar no borra");

await p.getByRole("button", { name: /^Eliminar$/ }).click();
await p.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
await p.getByRole("button", { name: "Eliminar inmueble" }).click();
await p.waitForFunction(() => document.body.textContent.includes("Todavía no has publicado ninguno"), null, { timeout: 30000 });
ok("al confirmar, desaparece de la lista");

const gone = await p.goto(editedUrl, { waitUntil: "domcontentloaded" });
if (gone.status() !== 404) throw new Error(`el enlace sigue vivo: ${gone.status()}`);
ok("y su enlace público responde 404");

await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await p.screenshot({ path: `${SHOT_DIR}/mis-inmuebles-movil.png`, fullPage: true });
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
