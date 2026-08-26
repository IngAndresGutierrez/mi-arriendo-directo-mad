/**
 * Un inmueble en borrador: todo diligenciado menos las fotos.
 *
 * El escenario que existe para resolver es el del propietario que tiene el canon, el estrato y
 * la matrícula en la cabeza y no tiene las fotos, porque para eso hay que ir al apartamento. Sin
 * borrador las dos únicas salidas eran publicar un anuncio sin una sola foto o dejar la
 * información en una nota del teléfono hasta que alguien pasara a tomarlas.
 *
 * Lo que este driver afirma no es que aparezcan las palabras "Borrador" en pantalla, sino las
 * consecuencias reales, que son tres y ninguna se ve compilando:
 *
 *  1. el borrador **no existe para nadie más**: ni en el catálogo, ni en su propia URL;
 *  2. desde el borrador se puede **encargar las fotos**, que es el motivo de todo esto;
 *  3. publicarlo lo vuelve público de verdad — comprobado sin sesión, no leyendo la insignia.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  fixtures,
  hydrated,
  LOGIN_PATH,
  MONTHS,
  PHOTOS_INPUT,
  settled,
  stubTiles,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

const email = `draft-check-${STAMP}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";
const TITLE = `Casa con patio en Palermo borrador ${STAMP}`;

const su = await createAccount(API_KEY, email);
if (!su.localId) throw new Error("signUp: " + JSON.stringify(su).slice(0, 200));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await stubTiles(page, readFileSync(PHOTO_1));

const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push("console: " + m.text().slice(0, 140));
});

const step = async (label, fn) => {
  try {
    const extra = await fn();
    console.log(`  OK    ${label}${extra ? " — " + extra : ""}`);
  } catch (e) {
    console.log(`  FALLA ${label}: ${String(e).split("\n")[0].slice(0, 200)}`);
    throw e;
  }
};

/** La tarjeta de este inmueble dentro de Mis inmuebles. */
const card = () => page.locator("li", { hasText: TITLE });

let draftUrl = "";

try {
  await step("login y onboarding", async () => {
    await page.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
    await page.waitForURL(/completar-perfil/, { timeout: 20000 });
    await settled(page);
    await page.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
    await page.getByLabel("Teléfono").fill("3001234567");
    await fillBirthdate(page, "10", MONTHS[4], "1990");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
    for (const [label, option] of [
      ["Género", /Femenino/i],
      ["Departamento", /Caldas/],
      ["Ciudad", /^Manizales$/],
    ]) {
      await page.getByLabel(label).click();
      await page.getByRole("option", { name: option }).first().click();
    }
    await acceptLegalConsents(page);
    await page.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
    await page.waitForURL(/\/inicio/, { timeout: 30000 });
    await settled(page);
  });

  await step("el formulario se llena entero, sin subir una sola foto", async () => {
    await page.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
    await settled(page);
    await hydrated(page);
    await page.getByLabel("Título del anuncio").fill(TITLE);
    await page
      .getByLabel("Descripción")
      .fill(
        "Casa de tres habitaciones con patio interior, cocina integral y zona de ropas. " +
          "Queda a dos cuadras del parque y del colegio.",
      );
    await page.getByLabel("Área (m²)").fill("120");
    await page.getByLabel("Habitaciones").fill("3");
    await page.getByLabel("Baños").fill("2");
    await page.getByLabel("Parqueadero").click();
    await page.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
    await page.getByLabel("Estrato").click();
    await page.getByRole("option", { name: "Estrato 4" }).click();
    await page.getByLabel("Departamento").click();
    await page.getByRole("option", { name: "Caldas", exact: true }).click();
    await page.getByLabel("Ciudad").click();
    await page.getByRole("option", { name: "Manizales", exact: true }).click();
    await page.getByLabel("Barrio").fill("Palermo");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
    await page
      .getByLabel("Número de matrícula inmobiliaria", { exact: true })
      .fill("050-123456");
    await page.getByLabel("Canon mensual (COP)").fill("2100000");
    await page.getByLabel("Administración (COP)").fill("0");
  });

  await step("publicar sin fotos sigue estando prohibido", async () => {
    /*
     * El borrador relaja exactamente una regla y solo para el botón que la pide. Si esto se
     * pusiera verde, `propertyFormSchema` estaría dándole el esquema laxo a los dos botones y el
     * catálogo se llenaría de anuncios sin una foto — que es justo lo que el borrador existe para
     * no tener que hacer.
     */
    await page.getByRole("button", { name: /^Publicar inmueble$/ }).click();
    const error = page.locator("form p.text-destructive", { hasText: /al menos una foto/i });
    await error.first().waitFor({ timeout: 10000 });
    if (!page.url().includes("/inmuebles/publicar")) {
      throw new Error("publicó sin fotos: salió del formulario");
    }
    return "el esquema estricto sigue puesto en el botón cian";
  });

  await step("guardar como borrador sí pasa, con los mismos datos", async () => {
    await page.getByRole("button", { name: /Guardar como borrador/i }).click();
    try {
      await page.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
    } catch (e) {
      const alertas = await page
        .locator('form [role="alert"], form p.text-destructive')
        .allInnerTexts();
      console.log("   errores en pantalla: " + JSON.stringify(alertas));
      await page.screenshot({ path: `${SHOT_DIR}/draft-falla.png`, fullPage: true });
      throw e;
    }
    await settled(page);
    await card().first().waitFor({ timeout: 15000 });
    const badge = await card().first().innerText();
    if (!/Borrador/.test(badge)) throw new Error("la tarjeta no dice Borrador: " + badge);
    // El canon se guardó igual que en un anuncio publicado: un borrador no es media ficha.
    if (!/2\.100\.000/.test(badge)) throw new Error("no guardó el canon: " + badge);
  });

  await step("la tarjeta no ofrece copiar un enlace que nadie puede abrir", async () => {
    // Un borrador contesta 404 a todo el mundo menos a su dueño, así que "Copiar enlace" sería
    // entregar un enlace roto. Es la misma regla que "un control que no hace nada sobra".
    if ((await card().getByRole("button", { name: /Copiar enlace/i }).count()) > 0) {
      throw new Error("ofrece copiar el enlace de un borrador");
    }
  });

  await step("Publicar está, no actúa, y dice por qué", async () => {
    const publish = card().getByRole("button", { name: /^Publicar$/ });
    await publish.waitFor({ timeout: 10000 });
    if ((await publish.getAttribute("aria-disabled")) !== "true") {
      throw new Error("el botón Publicar no se anuncia como no disponible");
    }
    /*
     * `force: true` a propósito. Playwright se niega a pulsar un `aria-disabled`, igual que un
     * lector de pantalla no lo ofrece — esa negativa ya es media afirmación. Forzarlo comprueba
     * la otra mitad, que es la que de verdad importa: aunque el clic llegue, no pasa nada. Un
     * control anunciado como no disponible que resulta que actúa es su propia clase de mentira.
     */
    await publish.click({ force: true });
    await page.waitForTimeout(800);
    if (!/Borrador/.test(await card().first().innerText())) {
      throw new Error("publicó un borrador sin fotos");
    }
    const body = await page.textContent("body");
    if (!/al menos una foto/i.test(body)) throw new Error("no dice qué falta");
    return "el motivo está en la página, no solo en el control";
  });

  await step("el borrador no existe para un extraño", async () => {
    const href = await card().getByRole("link").first().getAttribute("href");
    draftUrl = new URL(href, page.url()).toString();

    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    const response = await anonPage.goto(draftUrl, { waitUntil: "domcontentloaded" });
    await settled(anonPage);
    const body = await anonPage.textContent("body");
    if (body.includes(TITLE)) throw new Error("¡FUGA! un extraño ve el borrador");
    if (body.includes("Calle 60 #10-20")) throw new Error("¡FUGA! la dirección exacta se ve");
    if (response && response.status() === 200 && body.includes("Palermo")) {
      throw new Error("la página del borrador respondió con contenido");
    }

    await anonPage.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
    await settled(anonPage);
    if ((await anonPage.textContent("body")).includes(TITLE)) {
      throw new Error("¡FUGA! el borrador aparece en el catálogo público");
    }
    await anon.close();
    return "ni en su URL ni en el catálogo";
  });

  await step("su dueño sí lo ve, y sabe que solo lo ve él", async () => {
    await page.goto(draftUrl, { waitUntil: "domcontentloaded" });
    await settled(page);
    const body = await page.textContent("body");
    if (!body.includes(TITLE)) throw new Error("el dueño no ve su propio borrador");
    if (!/solo t[úu] puedes verlo/i.test(body)) throw new Error("no le avisa que es privado");
  });

  await step("desde el borrador se puede encargar las fotos", async () => {
    // El motivo de que exista un borrador: encargar es una acción *sobre* un inmueble, así que el
    // inmueble tiene que existir antes de poder mandar a alguien a fotografiarlo.
    await page.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
    await settled(page);
    await card().getByRole("link", { name: /Encargar/i }).first().click();
    await page.waitForURL(/\/encargar$/, { timeout: 20000 });
    await settled(page);
    await page.getByLabel("Qué hay que hacer").click();
    const photos = page.getByRole("option", { name: /Tomar fotos/i });
    if ((await photos.count()) === 0) throw new Error("no se puede encargar tomar fotos");
    await page.keyboard.press("Escape");
    return "el encargo de tipo 'Tomar fotos' está disponible";
  });

  await step("390px sin scroll horizontal en la lista con un borrador", async () => {
    await page.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/draft-390.png`, fullPage: true });
    await assertNoHorizontalScroll(page, "mis inmuebles con un borrador");
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  await step("se editan las fotos y el borrador sigue siendo borrador", async () => {
    await page.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
    await settled(page);
    await card().getByRole("link", { name: /Editar/i }).first().click();
    await page.waitForURL(/\/editar$/, { timeout: 20000 });
    await settled(page);
    await hydrated(page);
    await page.setInputFiles(PHOTOS_INPUT, [PHOTO_1, PHOTO_2]);
    await page.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
    // "Guardar cambios" en un borrador guarda un borrador: publicar es el otro botón.
    await page.getByRole("button", { name: /^Guardar cambios$/ }).click();
    await page.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
    await settled(page);
    const text = await card().first().innerText();
    if (!/Borrador/.test(text)) throw new Error("guardar cambios lo publicó: " + text);
    return "las fotos entraron sin publicarlo";
  });

  await step("con fotos, Publicar publica de verdad", async () => {
    const publish = card().getByRole("button", { name: /^Publicar$/ });
    if ((await publish.getAttribute("aria-disabled")) === "true") {
      throw new Error("sigue bloqueado con fotos subidas");
    }
    await publish.click();
    await page.waitForFunction(
      (title) => {
        const item = [...document.querySelectorAll("li")].find((li) =>
          li.innerText.includes(title),
        );
        return item ? /Disponible/.test(item.innerText) : false;
      },
      TITLE,
      { timeout: 30000 },
    );
    // Ahora sí hay enlace que copiar, porque ahora sí lleva a alguna parte.
    if ((await card().getByRole("button", { name: /Copiar enlace/i }).count()) === 0) {
      throw new Error("publicado y sin ofrecer el enlace");
    }
  });

  await step("y un extraño lo ve: la consecuencia, no la insignia", async () => {
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(draftUrl, { waitUntil: "domcontentloaded" });
    await settled(anonPage);
    const body = await anonPage.textContent("body");
    if (!body.includes(TITLE)) throw new Error("publicado y sigue invisible sin sesión");
    if (body.includes("Calle 60 #10-20")) throw new Error("¡FUGA! la dirección exacta es pública");
    await anonPage.screenshot({ path: `${SHOT_DIR}/draft-publicado.png`, fullPage: true });
    await anon.close();
    return "misma URL, ahora pública, y sin la dirección";
  });

  assertQuiet(problems);
} finally {
  await browser.close();
}
