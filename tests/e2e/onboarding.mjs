import { join } from "node:path";
import { chromium } from "playwright";
import { MONTHS, config, fillBirthdate, settled } from "./lib.mjs";

const { apiKey: API_KEY, stamp, shotDir: SHOT_DIR } = config();


const email = `refactor-drive-${stamp}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";

// Usuario de prueba por REST: no hace falta el Admin SDK para crearlo.
const signUp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password, returnSecureToken: true }) },
).then((r) => r.json());
if (!signUp.localId) throw new Error("signUp: " + JSON.stringify(signUp));
console.log("UID=" + signUp.localId);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 160)); });

const step = async (label, fn) => {
  try { await fn(); console.log(`  OK   ${label}`); }
  catch (e) { console.log(`  FALLA ${label}: ${String(e).split("\n")[0]}`); throw e; }
};

try {
  await step("login con el usuario nuevo", async () => {
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
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
    await page.getByRole("checkbox").click();
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
  console.log(problems.length ? "  PROBLEMAS EN CONSOLA:\n   " + problems.join("\n   ") : "  OK   consola sin errores");
  await browser.close();
}
