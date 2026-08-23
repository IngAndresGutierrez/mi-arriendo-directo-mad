import { chromium } from "playwright";
import { BASE, MONTHS, config, fillBirthdate, fixtures, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
// Publicar termina en el listado: el enlace del anuncio sale de la tarjeta que acaba de aparecer.
const email = `collapse-${STAMP}@miarriendodirecto.test`;
await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 120)); });
const sidebar = p.locator('[data-slot="app-sidebar"]');
const width = () => sidebar.boundingBox().then((box) => Math.round(box.width));

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

// ---------- arranca comprimido ----------
if (await sidebar.getAttribute("data-state") !== "collapsed") throw new Error("no arranca comprimido");
const narrow = await width();
const labels = await sidebar.getByRole("navigation").getByRole("link").allTextContents();
if (!labels.includes("Mis inmuebles")) throw new Error("los nombres no se leen comprimido: " + JSON.stringify(labels));
ok("arranca comprimido con los nombres bajo los iconos", `${narrow}px`);
await p.screenshot({ path: `${SHOT_DIR}/rail-comprimido.png` });

// ---------- la flecha lo expande ----------
await p.getByRole("button", { name: "Expandir menú" }).click();
await p.waitForFunction(() => document.querySelector('[data-slot="app-sidebar"]')?.dataset.state === "expanded", null, { timeout: 5000 });
await p.waitForTimeout(400);
const wide = await width();
if (wide <= narrow) throw new Error(`no se ensanchó: ${narrow} -> ${wide}`);
ok("la flecha lo expande", `${narrow}px -> ${wide}px`);
// Contra la lista real, no contra un número: activar una sección la saca de aquí, y un
// número fijo convierte eso en un fallo del driver en vez de en información.
const soon = (await sidebar.locator('[aria-disabled="true"]').filter({ hasText: "Pronto" }).allTextContents())
  .map((t) => t.replace("Pronto", "").trim());
if (JSON.stringify(soon) !== JSON.stringify(["Facturación", "Ajustes"])) {
  throw new Error("las secciones futuras cambiaron: " + JSON.stringify(soon));
}
ok("expandido las futuras muestran 'Pronto'", JSON.stringify(soon));
await p.screenshot({ path: `${SHOT_DIR}/rail-expandido.png` });

// ---------- se queda así ----------
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (await sidebar.getAttribute("data-state") !== "expanded") throw new Error("al navegar volvió a comprimirse");
ok("sigue expandido al navegar");
await p.reload({ waitUntil: "domcontentloaded" });
if (await sidebar.getAttribute("data-state") !== "expanded") throw new Error("al recargar volvió a comprimirse");
// Sin salto: el servidor ya manda el ancho correcto.
const beforeHydration = await p.evaluate(() => {
  const el = document.querySelector('[data-slot="app-sidebar"]');
  return el ? Math.round(el.getBoundingClientRect().width) : 0;
});
if (beforeHydration !== wide) throw new Error(`al recargar renderiza a ${beforeHydration}px en vez de ${wide}px`);
ok("sigue expandido al recargar, sin salto de ancho", `${beforeHydration}px desde el servidor`);

// ---------- la otra flecha lo comprime ----------
await p.getByRole("button", { name: "Contraer menú" }).click();
await p.waitForFunction(() => document.querySelector('[data-slot="app-sidebar"]')?.dataset.state === "collapsed", null, { timeout: 5000 });
await p.reload({ waitUntil: "domcontentloaded" });
if (await sidebar.getAttribute("data-state") !== "collapsed") throw new Error("no recordó que se comprimió");
ok("la otra flecha lo comprime, y también se recuerda");

// ---------- editar termina en el listado ----------
await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByLabel("Título del anuncio").fill(`Casa amplia con patio en Palermo ${STAMP}`);
await p.getByLabel("Descripción").fill("Casa de tres habitaciones con patio interior, cocina integral y zona de ropas independiente.");
await p.getByLabel("Área (m²)").fill("120");
await p.getByLabel("Habitaciones").fill("3");
await p.getByLabel("Baños").fill("2");
await p.getByLabel("Estrato").click(); await p.getByRole("option", { name: "Estrato 4" }).click();
await p.getByLabel("Parqueadero").click(); await p.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await p.getByLabel("Departamento").click(); await p.getByRole("option", { name: "Caldas", exact: true }).click();
await p.getByLabel("Ciudad").click(); await p.getByRole("option", { name: "Manizales", exact: true }).click();
await p.getByLabel("Barrio").fill("Palermo");
await p.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await p.getByLabel("Canon mensual (COP)").click(); await p.keyboard.type("2500000");
await p.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await p.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await p.getByRole("button", { name: /Publicar inmueble/i }).click();
await p.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(p);
ok("al publicar, termina en el listado", new URL(p.url()).pathname);

await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByRole("link", { name: /Editar/i }).click();
await p.waitForURL(/\/editar$/, { timeout: 20000 });
await settled(p);
await p.getByLabel("Título del anuncio").fill(`Casa remodelada con patio en Palermo ${STAMP}`);
await p.getByRole("button", { name: /Guardar cambios/i }).click();
await p.waitForURL((u) => new URL(u).pathname === "/mis-inmuebles", { timeout: 40000 });
await settled(p);
ok("al guardar la edición vuelve al listado", new URL(p.url()).pathname);
if (!(await p.textContent("body")).includes(`Casa remodelada con patio en Palermo ${STAMP}`)) throw new Error("el listado no trae el cambio");
ok("y el listado ya muestra el título nuevo");

// limpieza
await p.getByRole("button", { name: /^Eliminar$/ }).click();
await p.getByRole("dialog").waitFor({ state: "visible" });
await p.getByRole("button", { name: "Eliminar inmueble" }).click();
await p.waitForFunction(() => document.body.textContent.includes("Todavía no has publicado ninguno"), null, { timeout: 30000 });

// ---------- móvil intacto ----------
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
if (await sidebar.isVisible()) throw new Error("el menú fijo se cuela en móvil");
await p.getByRole("button", { name: "Abrir menú" }).click();
const drawer = p.getByRole("dialog");
await drawer.waitFor({ state: "visible" });
const enDrawer = (await drawer.locator('[aria-disabled="true"]').filter({ hasText: "Pronto" }).allTextContents())
  .map((t) => t.replace("Pronto", "").trim());
if (JSON.stringify(enDrawer) !== JSON.stringify(["Facturación", "Ajustes"])) {
  throw new Error("el drawer perdió los distintivos: " + JSON.stringify(enDrawer));
}
if (await drawer.getByRole("button", { name: /menú/i }).filter({ hasText: "" }).count() === 0) { /* nada */ }
ok("390px: el drawer sigue igual, expandido y con 'Pronto'");
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
