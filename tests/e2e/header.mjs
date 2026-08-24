/** El header público con sesión: Contacto siempre, y la cuenta en vez de "Iniciar sesión". */
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  MONTHS,
  ok,
  settled,
  LOGIN_PATH,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const email = `header-${STAMP}@miarriendodirecto.test`;

await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push(String(e)));

// ---------- sin sesión ----------
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.getByRole("banner").getByRole("link", { name: "Contacto" }).count())) throw new Error("falta Contacto sin sesión");
if (!(await p.getByRole("link", { name: /Iniciar sesión/ }).count())) throw new Error("falta Iniciar sesión sin sesión");
ok("sin sesión: Contacto e Iniciar sesión");
await p.getByRole("banner").getByRole("link", { name: "Contacto" }).click();
await p.waitForURL(/\/soporte$/, { timeout: 20000 });
await settled(p);
if (!(await p.getByRole("heading", { name: "Soporte" }).count())) throw new Error("soporte no abre sin sesión");
ok("Contacto lleva a soporte sin pasar por el login");

// ---------- con sesión ----------
await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await p.getByLabel("Día", { exact: true }).fill("10");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: MONTHS[4], exact: true }).click();
await p.getByLabel("Año", { exact: true }).fill("1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [label, option] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
  await p.getByLabel(label).click();
  await p.getByRole("option", { name: option }).first().click();
}
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

for (const ruta of ["/inmuebles", "/soporte"]) {
  await p.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await settled(p);
  if (ruta === "/inmuebles") {
    if (await p.getByRole("link", { name: /Iniciar sesión/ }).count()) throw new Error(`${ruta} ofrece iniciar sesión estando dentro`);
    if (!(await p.getByRole("banner").getByRole("link", { name: "Contacto" }).count())) throw new Error(`${ruta} perdió Contacto`);
    if (!(await p.getByRole("button", { name: /Tu cuenta/ }).count())) throw new Error(`${ruta} no muestra la cuenta`);
    ok(`${ruta}: Contacto y la cuenta, sin "Iniciar sesión"`);
  } else {
    // Con sesión, soporte vive dentro del producto: menú lateral, no header público.
    if (!(await p.getByRole("navigation", { name: "Navegación principal" }).count())) throw new Error("soporte con sesión no trae el menú");
    ok("/soporte con sesión abre dentro del producto");
  }
}

await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const cuenta = p.getByRole("button", { name: /Tu cuenta/ });
if (!(await cuenta.getAttribute("aria-label")).includes(email)) throw new Error("la cuenta no dice de quién es");
await cuenta.click();
await p.getByRole("menuitem", { name: "Mi perfil" }).waitFor({ timeout: 5000 });
await p.screenshot({ path: `${SHOT_DIR}/header-cuenta.png`, clip: { x: 700, y: 0, width: 580, height: 260 } });
ok("el menú ofrece portal, perfil y salir", (await p.getByRole("menuitem").allInnerTexts()).join(" · "));
await p.getByRole("menuitem", { name: "Mi perfil" }).click();
await p.waitForURL(/perfil-inquilino/, { timeout: 20000 });
await settled(p);
ok("Mi perfil abre el perfil");

// El detalle de un inmueble, la otra vista pública
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const href = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
await p.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(p);
if (await p.getByRole("link", { name: /Iniciar sesión/ }).count()) throw new Error("el detalle ofrece iniciar sesión estando dentro");
if (!(await p.getByRole("button", { name: /Tu cuenta/ }).count())) throw new Error("el detalle no muestra la cuenta");
ok("el detalle de un inmueble hace lo mismo", href);

// Cerrar sesión desde aquí
await p.getByRole("button", { name: /Tu cuenta/ }).click();
await p.getByRole("menuitem", { name: /Cerrar sesión/ }).click();
await p.waitForURL((u) => new URL(u).pathname === LOGIN_PATH, { timeout: 25000 });
await settled(p);
ok("cerrar sesión desde el header público vuelve al login");
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.getByRole("link", { name: /Iniciar sesión/ }).count())) throw new Error("sigue creyendo que hay sesión");
ok("y el header vuelve a ofrecer entrar");

await p.setViewportSize({ width: 390, height: 844 });
if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error("scroll horizontal a 390px");
await p.screenshot({ path: `${SHOT_DIR}/header-movil.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });
ok("390px sin scroll horizontal");
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
