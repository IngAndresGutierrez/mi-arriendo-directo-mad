import { join } from "node:path";
import { chromium } from "playwright";
import {
  assertQuiet,
  BASE,
  config,
  createAccount,
  ok,
  openSession,
  settled,
  LOGIN_PATH,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp, shotDir: SHOT_DIR } = config();

const email = `signout-check-${stamp}@miarriendodirecto.test`;
const password = "ClaveDePrueba1";

const signUp = await createAccount(API_KEY, email);
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
    await page.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
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
    await page.waitForURL((u) => new URL(u).pathname === LOGIN_PATH, { timeout: 20000 });
    await settled(page);
    const cookie = await sessionCookie();
    if (cookie) throw new Error("la cookie de sesion sobrevivio");
    return `URL ${LOGIN_PATH} y sin cookie`;
  });

  await step("la sesion esta muerta: el onboarding ya no es accesible", async () => {
    await page.goto(BASE + "/registro/completar-perfil", { waitUntil: "domcontentloaded" });
    await settled(page);
    const path = new URL(page.url()).pathname;
    if (path !== LOGIN_PATH) throw new Error("no redirigio al login, quedo en " + path);
    return "redirige al login";
  });

  /*
   * ---------- y cerrar sesión **desde el portal**, que es otra cosa ----------
   *
   * Todo lo de arriba cierra sesión desde `/registro/completar-perfil`, y ahí **no hay campana**:
   * esa pantalla usa `requireUser()` y no lleva el chrome del producto. Por eso este driver estaba
   * verde mientras la consola escupía `permission-denied` al salir desde `/inicio`.
   *
   * `signOutUser()` revoca los refresh tokens *antes* de que el SDK suelte la credencial —el orden
   * es deliberado, la cookie es la sesión autoritativa— así que en esa ventana el `onSnapshot` de la
   * campana sigue enganchado y el servidor lo rechaza. Es el final de la sesión, no una regla, y
   * reportarlo como error manda el diagnóstico a las reglas desplegadas y a los índices.
   */
  await step("cerrar sesión desde el portal deja la consola limpia", async () => {
    const portalEmail = `signout-bell-${stamp}@miarriendodirecto.test`;
    await createAccount(API_KEY, portalEmail);
    const dentro = await openSession(browser, {
      email: portalEmail,
      name: "Ana Campana Pérez",
      problems,
    });

    // Sin esto la prueba pasaría por no llegar a tener suscripción que rechazar.
    await dentro
      .getByRole("button", { name: "Notificaciones" })
      .waitFor({ state: "visible", timeout: 15000 });

    await dentro.getByRole("button", { name: /Cerrar sesión/i }).click();
    await dentro.waitForURL((u) => new URL(u).pathname === LOGIN_PATH, { timeout: 20000 });
    await settled(dentro);
    // Un margen para que el rechazo llegue: es asíncrono y venía *después* de la navegación.
    await dentro.waitForTimeout(1500);

    return "sin permission-denied al salir con la campana montada";
  });
} finally {
  /*
   * **Y esto ahora falla.** Antes solo se imprimía, así que un error de consola era invisible para
   * `run.mjs` y el driver salía verde con el fallo delante.
   */
  if (problems.length) console.log("  PROBLEMAS EN CONSOLA:\n   " + problems.join("\n   "));
  else ok("consola sin errores");
  await browser.close();
  assertQuiet(problems);
}
