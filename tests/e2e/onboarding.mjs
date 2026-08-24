import { join } from "node:path";
import { chromium } from "playwright";
import {
  BASE,
  config,
  createAccount,
  fillBirthdate,
  MONTHS,
  settled,
  LOGIN_PATH,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp, shotDir: SHOT_DIR } = config();


const email = `refactor-drive-${stamp}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";

// Usuario de prueba por REST: no hace falta el Admin SDK para crearlo.
const signUp = await createAccount(API_KEY, email);
if (!signUp.localId) throw new Error("signUp: " + JSON.stringify(signUp));
console.log("UID=" + signUp.localId);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 160)); });

const step = async (label, fn) => {
  try { await fn(); console.log(`  OK    ${label}`); }
  catch (e) { console.log(`  FALLA ${label}: ${String(e).split("\n")[0]}`); throw e; }
};

try {
  await step("login con el usuario nuevo", async () => {
    await page.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
    await page.waitForURL(/completar-perfil/, { timeout: 20000 });
    await settled(page);
  });

  await step("el onboarding se llena y se envía", async () => {
    await page.getByLabel("Nombre completo").fill("Ana Refactor");
    await page.getByLabel("Teléfono").fill("3001234567");
    await fillBirthdate(page, "10", MONTHS[Number("05") - 1], "1990");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
    for (const [label, option] of [["Género", /Femenino/i], ["Departamento", /Bogotá/], ["Ciudad", /^Bogotá$/]]) {
      await page.getByLabel(label).click();
      await page.getByRole("option", { name: option }).first().click();
    }
  });

  /*
   * **Las dos autorizaciones son dos, y esto es lo que lo fija.**
   *
   * Antes era una sola casilla: "Autorizo el tratamiento de mis datos personales y acepto los
   * Términos". Aceptar un contrato y autorizar el tratamiento de datos son actos distintos, y el
   * segundo tiene que ser **expreso** (Ley 1581 art. 9) — empaquetados, el registro no puede decir
   * cuál de los dos se estaba contestando. Un rediseño que las volviera a juntar pasaría todos los
   * demás drivers sin que nada se quejara, porque el helper marcaría las dos igual.
   *
   * Se afirma sobre la consecuencia: con solo una marcada el formulario **no avanza** y dice cuál
   * falta. Y el error se busca dentro del `<form>`, porque el overlay de `next dev` también usa
   * `role="alert"`.
   */
  await step("aceptar los Términos no autoriza el tratamiento de datos", async () => {
    await page.locator("#acceptsTerms").click();
    await page.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();

    const error = page.locator('form [id="authorizesDataTreatment-error"]');
    await error.waitFor({ state: "visible", timeout: 10000 });
    const texto = await error.innerText();
    if (!/autorizar el tratamiento/i.test(texto)) {
      throw new Error(`el error no dice qué falta: "${texto}"`);
    }
    if (!/completar-perfil/.test(page.url())) {
      throw new Error("el formulario avanzó con una sola de las dos autorizaciones");
    }

    // Y la otra dirección: autorizar el tratamiento no acepta los Términos.
    await page.locator("#acceptsTerms").click();
    await page.locator("#authorizesDataTreatment").click();
    await page.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
    await page.locator('form [id="acceptsTerms-error"]').waitFor({ state: "visible", timeout: 10000 });
    if (!/completar-perfil/.test(page.url())) {
      throw new Error("el formulario avanzó sin aceptar los Términos");
    }
  });

  await step("con las dos marcadas, el onboarding se envía", async () => {
    await page.locator("#acceptsTerms").click();
    await page.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
    await page.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(page);
  });

  await step("/inicio renderiza el saludo", async () => {
    await page.waitForSelector("text=Ana", { timeout: 10000 });
  });

  await step("390px sin scroll horizontal", async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error("hay scroll horizontal");
  });
  await page.screenshot({ path: join(SHOT_DIR, "onboarding.png") });
} finally {
  console.log(problems.length ? "  PROBLEMAS EN CONSOLA:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
  await browser.close();
}
