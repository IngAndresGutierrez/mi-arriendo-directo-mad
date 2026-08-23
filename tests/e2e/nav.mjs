import { chromium } from "playwright";
import { BASE, MONTHS, config, fillBirthdate, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `nav-${STAMP}@miarriendodirecto.test`;
await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 120)); });

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
await p.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await p.getByRole("checkbox").click();
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

// ---------- escritorio: el menú está a la vista ----------
const sidebar = p.locator('[data-slot="app-sidebar"]');
const menu = p.getByRole("button", { name: "Abrir menú" });
if (!(await sidebar.isVisible())) throw new Error("no hay menú fijo en escritorio");
if (await menu.isVisible()) throw new Error("la hamburguesa sigue visible en escritorio");
ok("1440px: el menú está fijo, sin hamburguesa");

// Por `href`, no por texto: el rail comprimido usa etiquetas cortas y el drawer las largas,
// así que comparar palabras diría que ofrecen cosas distintas cuando ofrecen las mismas.
const visibles = await sidebar.getByRole("navigation").getByRole("link").evaluateAll((links) =>
  links.map((link) => link.getAttribute("href")),
);
if (!visibles.includes("/mis-inmuebles")) throw new Error("las opciones no se leen: " + JSON.stringify(visibles));
ok("las opciones se leen sin abrir nada", JSON.stringify(visibles));
const soon = (await sidebar.locator('[aria-disabled="true"]').allTextContents())
  .map((t) => t.replace("Pronto", "").trim());
// Soporte ya está construido: las futuras son dos.
if (JSON.stringify(soon) !== JSON.stringify(["Facturación", "Ajustes"])) {
  throw new Error("las secciones futuras cambiaron: " + JSON.stringify(soon));
}
ok("y las futuras se marcan 'Pronto'", JSON.stringify(soon));
if (await sidebar.locator('[aria-current="page"]').textContent() !== "Inicio") throw new Error("marca activa incorrecta");
ok("marca la sección activa");
await p.screenshot({ path: `${SHOT_DIR}/nav-escritorio.png` });

// Un clic, no dos.
await sidebar.getByRole("link", { name: "Mis inmuebles" }).click();
await p.waitForURL(/\/mis-inmuebles$/, { timeout: 20000 });
await settled(p);
ok("se navega con un solo clic");
if ((await sidebar.locator('[aria-current="page"]').textContent()) !== "Mis inmuebles") throw new Error("no siguió la sección");
await p.getByRole("link", { name: /Publicar inmueble/i }).click();
await p.waitForURL(/\/inmuebles\/publicar$/, { timeout: 20000 });
await settled(p);
if ((await sidebar.locator('[aria-current="page"]').textContent()) !== "Mis inmuebles") throw new Error("publicando pierde la marca");
ok("publicando, sigue marcada 'Mis inmuebles'");

// El menú acompaña el scroll de una página larga.
await p.evaluate(() => window.scrollTo(0, 1200));
await p.waitForFunction(() => window.scrollY > 200, null, { timeout: 3000 }).catch(() => {});
const box = await sidebar.boundingBox();
if (!box || box.y > 1) throw new Error("el menú se fue con el scroll: y=" + box?.y);
ok("se queda fijo al bajar en una página larga", `scrollY=${await p.evaluate(() => Math.round(window.scrollY))}`);
await p.screenshot({ path: `${SHOT_DIR}/nav-escritorio-scroll.png` });

// ---------- móvil: como estaba ----------
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
if (await sidebar.isVisible()) throw new Error("el menú fijo se cuela en móvil");
if (!(await menu.isVisible())) throw new Error("no hay hamburguesa en móvil");
ok("390px: hamburguesa, sin menú fijo");
await menu.click();
const drawer = p.getByRole("dialog");
await drawer.waitFor({ state: "visible", timeout: 5000 });
const enDrawer = await drawer.getByRole("link").evaluateAll((links) =>
  links.map((link) => link.getAttribute("href")),
);
if (JSON.stringify(enDrawer) !== JSON.stringify(visibles)) throw new Error(`el drawer y el menú fijo no dicen lo mismo: ${JSON.stringify(enDrawer)}`);
ok("el drawer ofrece exactamente las mismas opciones");
await drawer.getByRole("link", { name: "Mis inmuebles" }).click();
await p.waitForURL(/\/mis-inmuebles$/, { timeout: 20000 });
await settled(p);
await p.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 5000 });
ok("al navegar se cierra solo");
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

// ---------- tablet ----------
await p.setViewportSize({ width: 900, height: 800 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
const tabletSidebar = await sidebar.isVisible();
const tabletMenu = await menu.isVisible();
if (tabletSidebar === tabletMenu) throw new Error(`a 900px hay ${tabletSidebar ? "los dos" : "ninguno"}`);
ok("900px: exactamente una de las dos formas", tabletSidebar ? "menú fijo" : "hamburguesa");

// Cerrar sesión sigue alcanzable en ambas.
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
await sidebar.getByRole("button", { name: /Cerrar sesión/i }).click();
await p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 25000 });
await settled(p);
ok("cerrar sesión desde el menú fijo");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
