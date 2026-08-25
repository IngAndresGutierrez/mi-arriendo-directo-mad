import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  MONTHS,
  ok,
  settled,
  LOGIN_PATH,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `nav-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 120)); });

await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
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
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

/*
 * ---------- el atajo al catálogo sale a una pestaña nueva ----------
 *
 * El catálogo es la otra mitad del producto: chrome público, otro contexto. Quien está mirando sus
 * procesos abiertos y se va a ver anuncios no ha terminado con esta página, así que volver debería
 * ser cerrar una pestaña y no rehacer el camino.
 *
 * Se afirma sobre los atributos y no pulsando: un clic abriría una pestaña de verdad y la prueba
 * pasaría a ser sobre el manejo de pestañas de Playwright en vez de sobre esta decisión. Y `rel`
 * aparte de `target`, porque `noopener` es lo que impide que la pestaña nueva toque a la que la abrió.
 */
{
  const atajo = p.getByRole("link", { name: /Buscas un nuevo hogar/ });
  await atajo.waitFor({ state: "visible", timeout: 15000 });

  if ((await atajo.getAttribute("target")) !== "_blank") {
    throw new Error("el atajo al catálogo no abre en pestaña nueva");
  }
  if (!((await atajo.getAttribute("rel")) ?? "").includes("noopener")) {
    throw new Error("el atajo al catálogo abre en pestaña nueva sin noopener");
  }
  ok("el atajo al catálogo abre en pestaña nueva");
}

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
/*
 * Soporte y Arriendos ya están construidos. Arriendos estuvo aquí un tiempo: entró deshabilitado
 * cuando el proceso pasó a llamarse Contratos — la negociación termina en un contrato firmado y el
 * arriendo empieza después — y salió el día que `/arriendos` existió, que es exactamente para lo que
 * estaba la entrada deshabilitada.
 */
/*
 * **Hoy no queda ninguna.** "Facturación" era la última deshabilitada y se retiró: una entrada
 * "Pronto" se gana el sitio mientras es una promesa que alguien espera —"Arriendos" estuvo aquí por
 * eso— y una permanente deja de leerse como hoja de ruta y empieza a leerse como sección
 * abandonada. La afirmación no desaparece, cambia de signo: el menú no ofrece nada que no exista.
 */
if (soon.length !== 0) {
  throw new Error("el menú volvió a ofrecer secciones que no existen: " + JSON.stringify(soon));
}
ok("el menú no ofrece ninguna sección sin construir");

// Y Arriendos es un enlace, no una promesa.
if (!visibles.includes("/arriendos")) {
  throw new Error("Arriendos ya está construido y el menú no lo ofrece: " + JSON.stringify(visibles));
}
ok("Arriendos ya es un enlace del menú");
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
await p.waitForURL((u) => new URL(u).pathname === LOGIN_PATH, { timeout: 25000 });
await settled(p);
ok("cerrar sesión desde el menú fijo");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
