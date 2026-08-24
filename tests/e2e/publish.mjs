import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  fixtures,
  MONTHS,
  settled,
  stubTiles,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `publish-check-${STAMP}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";

const su = await createAccount(API_KEY, email);
if (!su.localId) throw new Error("signUp: " + JSON.stringify(su).slice(0, 200));
console.log("UID=" + su.localId);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// El formulario de publicar monta un mapa: las teselas se responden aquí, no en
// los servidores de OpenStreetMap. El motivo está en `stubTiles`.
await stubTiles(page, readFileSync(PHOTO_1));
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() === 404) console.log("   404: " + r.url()); });
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 140)); });

const step = async (label, fn) => {
  try { const extra = await fn(); console.log(`  OK    ${label}${extra ? " — " + extra : ""}`); }
  catch (e) { console.log(`  FALLA ${label}: ${String(e).split("\n")[0].slice(0, 200)}`); throw e; }
};

let propertyUrl = "";
try {
  await step("login y onboarding", async () => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
    await page.waitForURL(/completar-perfil/, { timeout: 20000 });
    await settled(page);
    await page.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
    await page.getByLabel("Teléfono").fill("3001234567");
    await fillBirthdate(page, "10", MONTHS[Number("05") - 1], "1990");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
    for (const [label, option] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
      await page.getByLabel(label).click();
      await page.getByRole("option", { name: option }).first().click();
    }
    await acceptLegalConsents(page);
    await page.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
    await page.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(page);
  });

  await step("desde Mis inmuebles se llega a Publicar", async () => {
    // Publicar ya no cuelga del menú: vive dentro de Mis inmuebles.
    await page.getByRole("link", { name: /Mis inmuebles/i }).first().click();
    await page.waitForURL(/\/mis-inmuebles$/, { timeout: 20000 });
    await settled(page);
    await page.getByRole("link", { name: /Publicar inmueble/i }).first().click();
    await page.waitForURL(/inmuebles\/publicar/, { timeout: 20000 });
    await settled(page);
  });

  await step("el formulario vacío se rechaza con errores por campo", async () => {
    await page.getByRole("button", { name: /Publicar inmueble/i }).click();
    await page.waitForSelector("form p.text-destructive", { timeout: 10000 });
    const shown = await page.locator("form p.text-destructive").count();
    if (shown < 3) throw new Error(`solo ${shown} errores visibles`);
    return `${shown} errores de validación mostrados`;
  });

  await step("se llena y se suben dos fotos", async () => {
    await page.getByLabel("Título del anuncio").fill(`Apartamento luminoso en Palermo con vista ${STAMP}`);
    await page.getByLabel("Descripción").fill(
      "Apartamento de dos habitaciones con excelente iluminación natural, cocina integral y zona de ropas independiente. A dos cuadras del parque.");
    await page.getByLabel("Área (m²)").fill("65");
    await page.getByLabel("Habitaciones").fill("2");
    await page.getByLabel("Baños").fill("2");
    await page.getByLabel("Parqueadero").click();
    await page.getByRole("option", { name: "Parqueadero comunitario" }).click();
    await page.getByLabel("Estrato").click();
    await page.getByRole("option", { name: "Estrato 4" }).click();
    await page.getByLabel("Departamento").click();
    await page.getByRole("option", { name: "Caldas", exact: true }).click();
    await page.getByLabel("Ciudad").click();
    await page.getByRole("option", { name: "Manizales", exact: true }).click();
    await page.getByLabel("Barrio").fill("Palermo");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20 apto 301");
    await page.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
    await page.getByLabel("Canon mensual (COP)").fill("1800000");
    await page.getByLabel("Administración (COP)").fill("250000");
    await page.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
    await page.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
    await page.waitForSelector("text=2 de 20", { timeout: 15000 });
  });

  await step("publica y aterriza en Mis inmuebles", async () => {
    await page.getByRole("button", { name: /Publicar inmueble/i }).click();
    // Publicar devuelve al listado, no al detalle: el anuncio recién creado se ve ahí con sus
    // acciones. El detalle se abre desde el propio listado.
    try {
      await page.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
      await settled(page);
    } catch (e) {
      const alertas = await page.locator('form [role="alert"], form p.text-destructive').allInnerTexts();
      console.log("   errores en pantalla: " + JSON.stringify(alertas));
      await page.screenshot({ path: `${SHOT_DIR}/publish-falla.png`, fullPage: true });
      throw e;
    }
    const href = await page
      .locator("li", { hasText: `Apartamento luminoso en Palermo con vista ${STAMP}` })
      .getByRole("link")
      .first()
      .getAttribute("href");
    await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded" });
    await settled(page);
    propertyUrl = page.url();
    const segment = new URL(propertyUrl).pathname.split("/").pop() ?? "";
    /*
     * Lo que promete la regla es que la URL es el slug y nada más: estos enlaces se pegan en
     * WhatsApp y un código al final se lee como algo que no conviene abrir. Así que se
     * comprueba eso — palabras del título, la ciudad, y ningún id opaco pegado — y no el slug
     * completo carácter por carácter, que era mantener por segunda vez la regla del producto.
     */
    if (!/^[a-z0-9-]+$/.test(segment)) throw new Error("la URL no es amigable: " + segment);
    if (!segment.startsWith("apartamento-luminoso-en-palermo-con-vista")) {
      throw new Error("el slug no sale del título: " + segment);
    }
    if (!/-manizales(-\d+)?$/.test(segment)) throw new Error("el slug no nombra la ciudad: " + segment);
    // Un id de Firestore son 20 caracteres alfanuméricos sin guiones: eso es lo que no debe estar.
    if (/-[a-z0-9]{16,}$/.test(segment)) throw new Error("le pegaron un id a la URL: " + segment);
    return segment;
  });

  await step("el detalle muestra el anuncio", async () => {
    await page.waitForSelector("text=Apartamento luminoso en Palermo con vista", { timeout: 15000 });
    const body = await page.textContent("body");
    for (const [needle, what] of [["Palermo, Manizales", "ubicación pública"], ["1 año", "duración mínima"], ["Parqueadero comunitario", "tipo de parqueadero"], ["Calle 60 #10-20", "dirección exacta visible para el dueño"]]) {
      if (!body.includes(needle)) throw new Error(`falta ${what}`);
    }
    if (!/2\.050\.000/.test(body)) throw new Error("no muestra canon + administración");
    return "título, ubicación, precio total y dirección privada";
  });

  await step("390px sin scroll horizontal", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await page.screenshot({ path: `${SHOT_DIR}/detalle-390.png`, fullPage: true });
    if (overflow) throw new Error("hay scroll horizontal");
  });

  await step("el detalle es público: se ve sin sesión", async () => {
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(propertyUrl, { waitUntil: "domcontentloaded" });
    await settled(anonPage);
    const body = await anonPage.textContent("body");
    if (!body.includes(`Apartamento luminoso en Palermo con vista ${STAMP}`)) throw new Error("no se ve el anuncio");
    if (body.includes("Calle 60 #10-20")) throw new Error("¡FUGA! la dirección exacta es visible sin sesión");
    await anonPage.screenshot({ path: `${SHOT_DIR}/detalle-publico.png`, fullPage: true });
    await anon.close();
    return "sin la dirección exacta";
  });
} finally {
  console.log(problems.length ? "  PROBLEMAS EN CONSOLA:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
  console.log("URL=" + propertyUrl);
  await browser.close();
}
