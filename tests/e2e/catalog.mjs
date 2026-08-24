import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  fixtures,
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
// Publicar termina en el listado: el enlace del anuncio sale de la tarjeta que acaba de aparecer.
async function listingPathOf(page, title) {
  const href = await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: title })
    .first()
    .getAttribute("href");
  if (!href) throw new Error(`no encontré el anuncio de "${title}" en el listado`);
  return href;
}
const email = `catalog-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 140)); });

// ---------- catálogo vacío, sin sesión ----------
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if ((await p.title()).includes("Iniciar")) throw new Error("el catálogo pidió sesión");
ok("el catálogo abre sin sesión", await p.title());

/*
 * La marca del header lleva al listado, no al login. Quien está mirando inmuebles y pulsa el logo
 * está pidiendo volver a los resultados; mandarlo a `/` es dejarlo en una pantalla de acceso, que
 * para un visitante es un callejón sin salida y para alguien con sesión es sacarlo de lo que
 * estaba viendo. Se comprueba el destino y no solo que el enlace exista.
 */
{
  const marca = p.getByRole("link", { name: /miarriendoDIRECTO\.com/i }).first();
  if ((await marca.getAttribute("href")) !== "/inmuebles") {
    throw new Error("el logo del listado no lleva al listado: " + (await marca.getAttribute("href")));
  }
  ok("en el listado, el logo lleva al listado");
}
// Cuántos hay ya publicados (el inmueble real del dueño de la cuenta cuenta como uno).
// El total, no las tarjetas de la primera página: con más de 12 publicados las dos cifras
// dejan de coincidir y la resta de después mide otra cosa.
await p.waitForFunction(() => /\d+ inmuebles? encontrados?/.test(document.body.innerText), null, { timeout: 25000 });
const before = Number(
  (await p.evaluate(() => document.body.innerText)).match(/(\d+) inmuebles? encontrados?/)?.[1] ?? "0",
);
ok("arranca con lo que ya estaba publicado", `${before}`);

// ---------- publicar dos, en ciudades distintas ----------
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
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

async function publish({ title, department, city, neighborhood, rent }) {
  await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Título del anuncio").fill(title);
  await p.getByLabel("Descripción").fill("Casa de tres habitaciones con patio interior, cocina integral y zona de ropas independiente.");
  await p.getByLabel("Área (m²)").fill("120");
  await p.getByLabel("Habitaciones").fill("3");
  await p.getByLabel("Baños").fill("2");
  await p.getByLabel("Estrato").click(); await p.getByRole("option", { name: "Estrato 4" }).click();
  await p.getByLabel("Parqueadero").click(); await p.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
  await p.getByLabel("Departamento").click(); await p.getByRole("option", { name: department, exact: true }).click();
  await p.getByLabel("Ciudad").click(); await p.getByRole("option", { name: city, exact: true }).click();
  await p.getByLabel("Barrio").fill(neighborhood);
  await p.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
  await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
  await p.getByLabel("Canon mensual (COP)").click(); await p.keyboard.type(rent);
  await p.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
  await p.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
  await p.getByRole("button", { name: /Publicar inmueble/i }).click();
  await p.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
  await settled(p);
  return await listingPathOf(p, title);
}

const uno = await publish({ title: `Casa con patio en Palermo ${STAMP}`, department: "Caldas", city: "Manizales", neighborhood: "Palermo", rent: "2500000" });
const dos = await publish({ title: `Apartamento en Laureles ${STAMP}`, department: "Antioquia", city: "Medellín", neighborhood: "Laureles", rent: "3200000" });
ok("publicados dos, en ciudades distintas", `${uno} · ${dos}`);

// ---------- el catálogo los muestra ----------
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
// Tarjetas, no enlaces: cada una lleva tres al mismo inmueble (foto, título y "Ver inmueble").
await p.waitForFunction(() => /\d+ inmuebles? encontrados?/.test(document.body.innerText), null, { timeout: 25000 });
const cards = p.locator("ul li:has(a[href^='/inmuebles/'])");
// El catálogo pagina de 12 en 12 (CATALOG_PAGE_SIZE), así que lo que se ve en la primera página
// no es el total: el total lo dice la barra, y es contra eso que se compara.
const PAGINA = 6;
const total = before + 2;
const enPagina = (cuantos) => Math.min(cuantos, PAGINA);
if (await cards.count() !== enPagina(total)) throw new Error(`la página muestra ${await cards.count()}, esperaba ${enPagina(total)}`);
{
  const texto = await p.evaluate(() => document.body.innerText);
  const dice = texto.match(/\d+ inmuebles? encontrados?/)?.[0] ?? "(no dice nada)";
  if (dice !== `${total} inmuebles encontrados`) throw new Error(`la barra dice "${dice}" y el total debería ser ${total}`);
}
ok("sin filtro muestra los dos nuevos", `${total} en total, ${enPagina(total)} en la primera página`);
const card = await cards.first().textContent();
if (!card.includes("$")) throw new Error("la tarjeta no muestra precio");
if (card.includes("Calle 60")) throw new Error("¡la tarjeta filtró la dirección exacta!");
ok("la tarjeta lleva precio y NO la dirección exacta");
await p.screenshot({ path: `${SHOT_DIR}/catalogo.png`, fullPage: true });

// ---------- filtrar por ciudad con el parámetro ----------
await p.goto(BASE + "/inmuebles?city=Manizales", { waitUntil: "domcontentloaded" });
await settled(p);
// Manizales ya tenía el inmueble real, así que aquí van ese y el nuevo.
const enManizales = await cards.count();
if (enManizales < 1 || enManizales > enPagina(total)) throw new Error("?city=Manizales devolvió " + enManizales);
if (!(await p.evaluate(() => document.body.innerText)).includes("Arriendos en Manizales")) throw new Error("el título no nombra la ciudad");
ok("?city=Manizales filtra", `${enManizales} y el título nombra la ciudad`);

// Escrito a mano: sin mayúscula ni tilde. La cuenta se compara con la forma canónica, no
// con un número fijo, para no depender de qué más haya publicado.
await p.goto(BASE + "/inmuebles?city=" + encodeURIComponent("Medellín"), { waitUntil: "domcontentloaded" });
await settled(p);
const enMedellin = await cards.count();
if (enMedellin < 1) throw new Error("?city=Medellín no encontró el que acabamos de publicar");
await p.goto(BASE + "/inmuebles?city=medellin", { waitUntil: "domcontentloaded" });
await settled(p);
if (await cards.count() !== enMedellin) throw new Error(`?city=medellin devolvió ${await cards.count()} y la canónica ${enMedellin}`);
if (!(await p.evaluate(() => document.body.innerText)).includes("Arriendos en Medellín")) throw new Error("no resolvió a Medellín");
ok("?city=medellin funciona igual que ?city=Medellín", `${enMedellin} en ambas, sin tilde ni mayúscula`);

// Basura en el parámetro: se ignora, no se consulta.
await p.goto(BASE + "/inmuebles?city=Narnia", { waitUntil: "domcontentloaded" });
await settled(p);
if (await cards.count() !== enPagina(total)) throw new Error("?city=Narnia devolvió " + (await cards.count()));
// `innerText`, no `textContent`: el payload RSC va en <script> y ahí la URL aparece siempre.
const visible = await p.evaluate(() => document.body.innerText);
if (visible.includes("Narnia")) throw new Error("el parámetro basura se refleja en lo que se ve");
// El encabezado sin ciudad. "Inmuebles en arriendo" quedó solo en el <title> cuando el catálogo
// pasó a facetas, y comprobarlo ahí no distinguía una ciudad de otra.
if (!visible.includes("Encuentra tu próximo hogar")) throw new Error("no cayó al encabezado sin ciudad");
ok("?city=Narnia se ignora y no se refleja en lo que se ve");

// Una ciudad real sin inmuebles: estado vacío con salida.
await p.goto(BASE + "/inmuebles?city=Pereira", { waitUntil: "domcontentloaded" });
await settled(p);
// Con el catálogo facetado, una ciudad vacía es un filtro que no coincide, y la salida es
// quitarlo: la frase por ciudad y el enlace "Ver todas las ciudades" son de la versión anterior.
if (!(await p.evaluate(() => document.body.innerText)).includes("Ningún inmueble coincide con lo que buscas")) throw new Error("falta el vacío con filtros");
// El del estado vacío, no el de la barra de facetas: los dos existen y dicen lo mismo.
await p.locator("div.border-dashed").getByRole("link", { name: /Quitar filtros/i }).click();
await p.waitForURL((u) => new URL(u).pathname === "/inmuebles" && !new URL(u).search, { timeout: 20000 });
await settled(p);
ok("una ciudad sin inmuebles explica y ofrece salida");

// ---------- el selector cambia la URL ----------
await p.getByLabel("Ciudad").click();
const opciones = await p.getByRole("option").allTextContents();
// Cada opción lleva su cuenta desde que el catálogo es facetado: "Manizales (14)".
const nombra = (ciudad) => opciones.some((o) => o.startsWith(ciudad));
if (!nombra("Manizales") || !nombra("Medellín")) throw new Error("el selector no ofrece las ciudades con inmuebles: " + JSON.stringify(opciones));
if (nombra("Pereira")) throw new Error("el selector ofrece ciudades sin inmuebles");
ok("el selector solo ofrece ciudades con inmuebles", JSON.stringify(opciones));
// El nombre lleva la cuenta pegada, así que se busca por prefijo.
await p.getByRole("option", { name: /^Medellín/ }).first().click();
await p.waitForURL(/city=Medell/, { timeout: 20000 });
await settled(p);
{
  // Cuántos hay depende de lo que quede publicado de otras corridas; lo que se comprueba es que
  // filtra y cabe en una página.
  const visibles = await cards.count();
  if (visibles < 1 || visibles > PAGINA) throw new Error("tras elegir, muestra " + visibles);
}
ok("elegir en el selector cambia la URL y filtra", new URL(p.url()).search);

// ---------- del catálogo al detalle y de vuelta ----------
// El que acabamos de publicar, no "el primero": con varios en Medellín el primero es otro.
await p.locator(`a[href="${dos}"]`).first().click();
await p.waitForURL(new RegExp(dos.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 20000 });
await settled(p);
ok("del catálogo al detalle");

/*
 * Y desde el detalle se puede deshacer ese paso: una flecha de volver, arriba del todo. Es un
 * enlace de verdad y no el gesto del navegador porque a este anuncio también se llega desde un
 * enlace pegado en WhatsApp, donde no hay a dónde volver.
 */
{
  const marca = p.getByRole("link", { name: /miarriendoDIRECTO\.com/i }).first();
  if ((await marca.getAttribute("href")) !== "/inmuebles") {
    throw new Error("el logo del detalle no lleva al listado: " + (await marca.getAttribute("href")));
  }
  ok("en el detalle, el logo también lleva al listado");

  /*
   * Acotado al contenido: el logo del header también se anuncia "…, volver a los inmuebles" —
   * dice a dónde lleva, que es lo que un lector de pantalla necesita— y sin acotar el selector
   * encuentra los dos y falla por ambigüedad.
   */
  const volver = p.locator("article").getByRole("link", { name: /Volver a los inmuebles/i });
  if ((await volver.count()) !== 1) throw new Error("el detalle no ofrece la flecha de volver");
  await volver.click();
  await p.waitForURL(/\/inmuebles$/, { timeout: 20000 });
  await settled(p);
  ok("la flecha del detalle vuelve al listado", new URL(p.url()).pathname);

  // Y de vuelta al detalle, que es donde sigue el resto de este bloque.
  await p.goto(BASE + dos, { waitUntil: "domcontentloaded" });
  await settled(p);
}

await p.getByRole("link", { name: /Ver más arriendos en Medellín/i }).click();
await p.waitForURL(/city=Medell/, { timeout: 20000 });
await settled(p);
ok("y del detalle al catálogo de su ciudad");

// ---------- móvil ----------
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await p.screenshot({ path: `${SHOT_DIR}/catalogo-movil.png`, fullPage: true });
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
