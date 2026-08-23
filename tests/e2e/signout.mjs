import { join } from "node:path";
import { chromium } from "playwright";
import { config, settled } from "./lib.mjs";

const { apiKey: API_KEY, stamp, shotDir: SHOT_DIR } = config();

const email = `signout-check-${stamp}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";

const signUp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password, returnSecureToken: true }) },
).then((r) => r.json());
if (!signUp.localId) throw new Error("signUp: " + JSON.stringify(signUp));
console.log("UID=" + signUp.localId);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 160)); });

const step = async (label, fn) => {
  try { const extra = await fn(); console.log(`  OK    ${label}${extra ? " — " + extra : ""}`); }
  catch (e) { console.log(`  FALLA ${label}: ${String(e).split("\n")[0]}`); throw e; }
};

const sessionCookie = async () =>
  (await ctx.cookies()).find((c) => c.name === "session");

try {
  await step("login lleva al onboarding", async () => {
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
    await page.waitForURL(/completar-perfil/, { timeout: 20000 });
    await settled(page);
    if (!(await sessionCookie())) throw new Error("no hay cookie de sesion");
    return "cookie de sesion presente";
  });

  await step("el boton existe y es accesible", async () => {
    const btn = page.getByRole("button", { name: /Cerrar sesión/i });
    await btn.waitFor({ state: "visible", timeout: 10000 });
    return `nombre accesible: "${(await btn.textContent())?.trim()}"`;
  });

  await step("390px sin scroll horizontal con el boton dentro", async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error("hay scroll horizontal");
  });
  await page.screenshot({ path: join(SHOT_DIR, "signout.png") });

  await step("cierra sesion: vuelve al login Y borra la cookie", async () => {
    await page.getByRole("button", { name: /Cerrar sesión/i }).click();
    await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 });
    await settled(page);
    const cookie = await sessionCookie();
    if (cookie) throw new Error("la cookie de sesion sobrevivio");
    return "URL / y sin cookie";
  });

  await step("la sesion esta muerta: el onboarding ya no es accesible", async () => {
    await page.goto("http://localhost:3000/registro/completar-perfil", { waitUntil: "domcontentloaded" });
    await settled(page);
    const path = new URL(page.url()).pathname;
    if (path !== "/") throw new Error("no redirigio al login, quedo en " + path);
    return "redirige al login";
  });
} finally {
  console.log(problems.length ? "  PROBLEMAS EN CONSOLA:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
  await browser.close();
}
