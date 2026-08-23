import { chromium } from "playwright";
import { BASE, MONTHS, config, fillBirthdate, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `drawer-${STAMP}@miarriendodirecto.test`;
await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 120)); });

await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
// Wait for React to own the form: before hydration the browser submits it natively, as a GET
// that puts the password in the URL.
await p.waitForFunction(() => {
  const form = document.querySelector("form");
  return form && Object.keys(form).some((k) => k.startsWith("__react"));
}, null, { timeout: 20000 });
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

/*
 * El diseño cambió: de `lg` para arriba el menú es fijo y no hay hamburguesa; el drawer es lo
 * que se ve por debajo. Este driver comprueba esa regla y luego el drawer, en móvil.
 */
const menu = p.getByRole("button", { name: "Abrir menú" });
if (await menu.isVisible()) throw new Error("hay hamburguesa en escritorio, donde el menú es fijo");
if (!(await p.locator('[data-slot="app-sidebar"]').isVisible())) throw new Error("no hay menú fijo en escritorio");
ok("en escritorio el menú es fijo, sin hamburguesa");

await p.setViewportSize({ width: 390, height: 844 });
if (!(await menu.isVisible())) throw new Error("no hay hamburguesa en móvil");
ok("por debajo de lg aparece la hamburguesa (390px)");

// El menú arranca cerrado y no ocupa espacio del contenido.
if (await p.getByRole("dialog").count()) throw new Error("el drawer arranca abierto");
await menu.click();
const drawer = p.getByRole("dialog");
await drawer.waitFor({ state: "visible", timeout: 5000 });
const items = await drawer.getByRole("link").allTextContents();
console.log("  menú:", JSON.stringify(items));
if (items.some((t) => /Publicar/i.test(t))) throw new Error("'Publicar' sigue en el menú");
if (!items.some((t) => /Mis inmuebles/.test(t))) throw new Error("falta 'Mis inmuebles'");
ok("una sola entrada de inmuebles, sin 'Publicar'");

const soon = await drawer.locator('[aria-disabled="true"]').allTextContents();
if (!soon.every((t) => t.includes("Pronto"))) throw new Error("secciones futuras sin distintivo: " + JSON.stringify(soon));
ok("las secciones futuras se marcan 'Pronto'", `${soon.length} de ellas`);

await p.waitForFunction(() => {
  const el = document.querySelector('[role="dialog"]');
  return el && getComputedStyle(el).opacity === "1" && el.getBoundingClientRect().left === 0;
}, null, { timeout: 5000 });
await p.screenshot({ path: `${SHOT_DIR}/drawer-movil.png` });

// Escape cierra.
await p.keyboard.press("Escape");
await drawer.waitFor({ state: "hidden", timeout: 5000 });
ok("Escape lo cierra");

// Navegar cierra el drawer.
await menu.click();
await drawer.waitFor({ state: "visible" });
await drawer.getByRole("link", { name: "Mis inmuebles" }).click();
await p.waitForURL(/\/mis-inmuebles$/, { timeout: 20000 });
await settled(p);
await p.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 5000 });
ok("al navegar se cierra solo", "y llegó a /mis-inmuebles");

// La entrada activa se marca, también en una subruta.
await menu.click();
await drawer.waitFor({ state: "visible" });
const current = await drawer.locator('[aria-current="page"]').textContent();
if (current.trim() !== "Mis inmuebles") throw new Error("marca activa: " + current);
ok("marca la sección activa");
await p.keyboard.press("Escape");
await drawer.waitFor({ state: "hidden" });

// Publicar se alcanza desde la lista.
await p.getByRole("link", { name: /Publicar inmueble/i }).click();
await p.waitForURL(/\/inmuebles\/publicar$/, { timeout: 20000 });
await settled(p);
ok("publicar se alcanza desde la lista");
await menu.click();
await drawer.waitFor({ state: "visible" });
const publishing = await drawer.locator('[aria-current="page"]').textContent();
if (publishing.trim() !== "Mis inmuebles") throw new Error("publicando, la marca activa es: " + publishing);
ok("publicando, sigue marcada 'Mis inmuebles'");
await p.keyboard.press("Escape");
await drawer.waitFor({ state: "hidden" });

// El foco vuelve a la hamburguesa al cerrar.
await menu.click();
await drawer.waitFor({ state: "visible" });
await p.keyboard.press("Escape");
await drawer.waitFor({ state: "hidden" });
const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (focused !== "Abrir menú") throw new Error("el foco quedó en " + focused);
ok("el foco vuelve a la hamburguesa");

// Móvil.
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await menu.isVisible())) throw new Error("no hay hamburguesa en móvil");
await p.screenshot({ path: `${SHOT_DIR}/drawer-movil-cerrado.png`, fullPage: true });
await menu.click();
await drawer.waitFor({ state: "visible" });
await p.waitForFunction(() => {
  const d = document.querySelector('[role="dialog"]');
  return d && getComputedStyle(d).opacity === "1";
}, null, { timeout: 5000 });
await p.screenshot({ path: `${SHOT_DIR}/drawer-movil-abierto.png` });
ok("la hamburguesa y el drawer funcionan a 390px");
await p.keyboard.press("Escape");
await drawer.waitFor({ state: "hidden" });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

// Cerrar sesión desde el drawer.
await menu.click();
await drawer.waitFor({ state: "visible" });
await drawer.getByRole("button", { name: /Cerrar sesión/i }).click();
await p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 25000 });
await settled(p);
ok("cerrar sesión sigue disponible dentro del drawer");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
