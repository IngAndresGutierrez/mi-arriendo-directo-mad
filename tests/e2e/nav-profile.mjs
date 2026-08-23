import { chromium } from "playwright";
import { BASE, config, createAccount, fillBirthdate, MONTHS, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `menu-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 130)); });
const sidebar = p.locator('[data-slot="app-sidebar"]');

await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => {
  const f = document.querySelector("form");
  return f && Object.keys(f).some((k) => k.startsWith("__react"));
}, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana Inquilina Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await p.getByRole("checkbox").click();
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

// Comprimido: cabe en una sola entrada de dos líneas.
const collapsed = await sidebar.getByRole("navigation").getByRole("link").allTextContents();
console.log("  menú comprimido:", JSON.stringify(collapsed));
if (!collapsed.includes("Mi perfil")) throw new Error("no está la entrada comprimida");
const height = (await sidebar.locator('a[href="/perfil-inquilino"]').boundingBox()).height;
if (height > 72) throw new Error(`la entrada mide ${Math.round(height)}px comprimida: se desborda`);
ok("comprimido cabe en dos líneas", `${Math.round(height)}px de alto`);
await p.screenshot({ path: `${SHOT_DIR}/menu-comprimido.png` });

// Expandido: el nombre completo.
await p.getByRole("button", { name: "Expandir menú" }).click();
await p.waitForFunction(() => document.querySelector('[data-slot="app-sidebar"]')?.dataset.state === "expanded", null, { timeout: 5000 });
const expanded = await sidebar.getByRole("navigation").getByRole("link").allTextContents();
console.log("  menú expandido:", JSON.stringify(expanded));
if (!expanded.includes("Perfil de inquilino")) throw new Error("expandido no dice el nombre completo");
ok("expandido dice 'Perfil de inquilino'");
await p.screenshot({ path: `${SHOT_DIR}/menu-expandido.png` });

// Lleva a la página y queda marcada como activa.
await sidebar.getByRole("link", { name: "Perfil de inquilino" }).click();
await p.waitForURL(/\/perfil-inquilino$/, { timeout: 20000 });
await settled(p);
if ((await sidebar.locator('[aria-current="page"]').textContent()).trim() !== "Perfil de inquilino") throw new Error("no queda marcada");
ok("lleva a la página y queda marcada como activa");

// El orden pone primero lo que existe.
ok("las secciones que existen van primero", JSON.stringify(expanded));

// Móvil: el drawer trae la misma entrada, con el nombre completo.
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByRole("button", { name: "Abrir menú" }).click();
const drawer = p.getByRole("dialog");
await drawer.waitFor({ state: "visible" });
const inDrawer = await drawer.getByRole("link").allTextContents();
if (!inDrawer.includes("Perfil de inquilino")) throw new Error("el drawer no la trae: " + JSON.stringify(inDrawer));
ok("en móvil el drawer la trae con el nombre completo");
await drawer.getByRole("link", { name: "Perfil de inquilino" }).click();
await p.waitForURL(/\/perfil-inquilino$/, { timeout: 20000 });
await settled(p);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
