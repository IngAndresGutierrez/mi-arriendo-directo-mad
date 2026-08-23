import { chromium } from "playwright";
import { BASE, ok, settled } from "./lib.mjs";

const b = await chromium.launch();
const ctx = await b.newContext();
// No client JS: this is exactly the window before hydration, held open.
await ctx.route("**/_next/static/**/*.js", (r) => r.abort());
const p = await ctx.newPage();

async function submitWithoutJs(path, fill, buttonName, label) {
  await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await settled(p);
  const hydrated = await p.evaluate(() => {
    const f = document.querySelector("form");
    return f ? Object.keys(f).some((k) => k.startsWith("__react")) : false;
  });
  if (hydrated) throw new Error("la página hidrató: la prueba no vale");
  const method = await p.evaluate(() => document.querySelector("form")?.getAttribute("method"));
  await fill(p);
  await p.getByRole("button", { name: buttonName }).first().click();
  await p.waitForLoadState("domcontentloaded").catch(() => {});
  const url = new URL(p.url());
  const leaked = [...url.searchParams.keys()];
  if (leaked.length) throw new Error(`${label}: la URL quedó con ${JSON.stringify(leaked)}`);
  ok(`${label}: method=${method}, la URL no lleva nada`, url.pathname + (url.search || ""));
}

await submitWithoutJs("/", async (page) => {
  await page.getByLabel("Correo electrónico").fill("alguien@example.com");
  await page.getByLabel("Contraseña").fill("MiClaveSecreta1");
}, /Ingresar|Iniciar/i, "login");

await submitWithoutJs("/registro", async (page) => {
  await page.getByLabel("Correo electrónico").fill("alguien@example.com");
}, /Continuar|Siguiente/i, "registro paso 1");

await b.close();
