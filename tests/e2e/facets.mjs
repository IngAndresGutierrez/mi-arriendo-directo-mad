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
const email = `facets-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 140)); });
const cards = p.locator("ul li h2 a");
const seen = async () => cards.allTextContents();
/**
 * Lo que publicó *esta* corrida, y sólo eso. El catálogo es estado compartido: ahí siguen los
 * inmuebles de las demás corridas, así que contar sobre `seen()` sólo daba el número esperado
 * contra una base vacía. El stamp va en el título, así que filtrar por él aísla lo propio sin
 * depender de en qué orden corran los drivers ni de borrar nada.
 */
const mine = async () => (await seen()).filter((t) => t.includes(STAMP));
/**
 * Los precios de la página, en orden de aparición. `formatCOP` da "$ 1.800.000", así que
 * el separador de miles se quita antes de comparar.
 */
const pricesOnPage = async () =>
  (await p.locator("ul li").allTextContents())
    .map((text) => text.match(/\$\s?([\d.]+)/))
    .filter(Boolean)
    .map((m) => Number(m[1].replace(/\./g, "")));

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

async function publish({ title, type, department, city, neighborhood, rent, adminFee, bedrooms, furnished, pets, parking, lease }) {
  await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Título del anuncio").fill(title);
  await p.getByLabel("Descripción").fill("Inmueble con cocina integral, zona de ropas y buena iluminación natural todo el día.");
  await p.getByLabel("Tipo de inmueble").click(); await p.getByRole("option", { name: type, exact: true }).click();
  await p.getByLabel("Área (m²)").fill("70");
  await p.getByLabel("Habitaciones").fill(String(bedrooms));
  await p.getByLabel("Baños").fill("2");
  await p.getByLabel("Estrato").click(); await p.getByRole("option", { name: "Estrato 4" }).click();
  await p.getByLabel("Parqueadero").click(); await p.getByRole("option", { name: parking, exact: true }).click();
  if (furnished) await p.getByLabel("Amoblado").click();
  if (pets) await p.getByLabel("Acepta mascotas").click();
  await p.getByLabel("Duración mínima").click(); await p.getByRole("option", { name: lease, exact: true }).click();
  await p.getByLabel("Departamento").click(); await p.getByRole("option", { name: department, exact: true }).click();
  await p.getByLabel("Ciudad").click(); await p.getByRole("option", { name: city, exact: true }).click();
  await p.getByLabel("Barrio").fill(neighborhood);
  await p.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
  await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
  await p.getByLabel("Canon mensual (COP)").click(); await p.keyboard.type(rent);
  if (adminFee) { await p.getByLabel(/Administración/).click(); await p.keyboard.type(adminFee); }
  await p.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
  await p.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
  await p.getByRole("button", { name: /Publicar inmueble/i }).click();
  await p.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
  await settled(p);
}

await publish({ title: `Casa amplia en Laureles ${STAMP}`, type: "Casa", department: "Antioquia", city: "Medellín", neighborhood: "Laureles", rent: "3000000", bedrooms: 4, furnished: false, pets: true, parking: "Tiene parqueadero", lease: "1 año" });
await publish({ title: `Apartaestudio amoblado en Palermo ${STAMP}`, type: "Apartaestudio", department: "Caldas", city: "Manizales", neighborhood: "Palermo", rent: "1200000", adminFee: "300000", bedrooms: 1, furnished: true, pets: false, parking: "No tiene parqueadero", lease: "6 meses" });
ok("publicados dos inmuebles distintos para probar las facetas");

// ---------- la vista ----------
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const heading = await p.locator("h1").textContent();
if (!heading.includes("Encuentra tu próximo hogar")) throw new Error("título: " + heading);
ok("la vista abre con el título y los filtros a la izquierda", heading.trim());

const aside = p.locator('aside[aria-label="Filtros"]');
if (!(await aside.isVisible())) throw new Error("no hay columna de filtros en escritorio");
const groups = await aside.locator("h2").allTextContents();
if (!groups.includes("Tipo de inmueble") || !groups.includes("Habitaciones") || !groups.includes("Duración mínima")) throw new Error("faltan grupos: " + JSON.stringify(groups));
ok("los grupos de filtros están", JSON.stringify(groups));

/** El número del encabezado: cuántos hay en total, no cuántos caben en la página. */
const headingTotal = async () =>
  Number((await p.locator("text=/\\d+ inmuebles? encontrados?/").first().textContent()).match(/\d+/)[0]);
const total = await headingTotal();
if (total < 3) throw new Error("el conteo dice " + total);
ok("el conteo de resultados aparece", `${total} encontrados`);

// La tarjeta trae los datos y NO la dirección.
const firstCard = await p.locator("ul > li").first().innerText();
for (const needed of ["m²", "Estrato", "Disponible desde", "Ver inmueble"]) {
  if (!firstCard.includes(needed)) throw new Error(`la tarjeta no trae "${needed}"`);
}
if (firstCard.includes("Calle 60")) throw new Error("¡la tarjeta filtró la dirección exacta!");
ok("la tarjeta trae hechos, precio, disponibilidad y CTA — y no la dirección");
await p.screenshot({ path: `${SHOT_DIR}/facetas.png`, fullPage: true });

// ---------- el desglose del precio ----------
// `Intl` separa el signo con espacio duro (U+00A0); normalizarlo o la comparación miente.
const conAdmin = (await p.locator("ul > li", { hasText: `Apartaestudio amoblado en Palermo ${STAMP}` }).innerText()).replace(/\u00a0/g, " ");
if (!conAdmin.includes("$ 1.500.000")) throw new Error("no suma canon + administración: " + conAdmin.match(/\$[^\n]*/g));
if (!conAdmin.includes("administración")) throw new Error("no muestra el desglose");
ok("el precio es el total y muestra el desglose", "1.200.000 + 300.000 = 1.500.000");

// ---------- filtrar por faceta ----------
await p.getByLabel("Casa").click();
await p.waitForURL(/type=house/, { timeout: 20000 });
await settled(p);
const soloCasas = await seen();
/*
 * Pertenencia, no conteo. El catálogo es estado compartido: lo que publicaron las demás
 * corridas sigue ahí, así que "hay exactamente una casa" sólo era cierto la primera vez que
 * este driver corrió contra una base vacía. Lo que el filtro promete es que aparece la mía y
 * que no se cuela nada que no sea casa.
 */
if (!soloCasas.some((t) => t.includes(`Casa amplia en Laureles ${STAMP}`))) {
  throw new Error("filtro de tipo: no está la casa recién publicada: " + JSON.stringify(soloCasas));
}
const noCasa = soloCasas.filter((t) => !/^Casa/.test(t));
if (noCasa.length) throw new Error("con ?type=house se colaron: " + JSON.stringify(noCasa));
ok("marcar 'Casa' filtra y queda en la URL", `?type=house, ${soloCasas.length} casa(s)`);

// Los conteos de la propia faceta no se anulan al usarla: con "Casa" marcado, "Apartaestudio"
// tiene que seguir diciendo cuántos obtendrías al cambiarte a él.
const conteos = await aside.innerText();
const otro = conteos.match(/Apartaestudio\s+(\d+)/);
if (!otro) throw new Error("'Apartaestudio' desapareció de la faceta:\n" + conteos);
if (Number(otro[1]) < 1) throw new Error("el conteo de la otra opción se anuló: " + otro[1]);
ok("con 'Casa' marcado, 'Apartaestudio' sigue contando", `${otro[1]}, la faceta no se cuenta contra sí misma`);

// Dos facetas que se contradicen: cero resultados, y la casilla marcada tiene que seguir ahí
// o el filtro quedaría puesto sin forma de quitarlo.
await p.goto(BASE + "/inmuebles?type=house&features=furnished", { waitUntil: "domcontentloaded" });
await settled(p);
if ((await mine()).length !== 0) throw new Error("casa+amoblado debería dar cero de los míos");
if (!(await p.evaluate(() => document.body.innerText)).includes("Ningún inmueble coincide")) throw new Error("falta el vacío por filtros");
const stuck = aside.getByLabel("Amoblado");
if (await stuck.getAttribute("aria-checked") !== "true") throw new Error("la casilla en cero desapareció o se desmarcó");
ok("una combinación en cero lo dice y su casilla sigue marcada", "se puede desmarcar, no queda trabada");
await stuck.click();
await p.waitForURL((u) => !new URL(u).search.includes("features"), { timeout: 20000 });
await settled(p);
if ((await mine()).length !== 1) throw new Error("al desmarcar no volvió mi casa");
ok("y al desmarcarla vuelven los resultados");
await p.getByRole("link", { name: /Quitar filtros/i }).first().click();
await p.waitForURL((u) => new URL(u).pathname === "/inmuebles" && !new URL(u).search, { timeout: 20000 });
await settled(p);
ok("'Quitar filtros' vuelve a la vista completa");

// ---------- ordenar ----------
await p.getByLabel("Ordenar").click();
await p.getByRole("option", { name: "Precio (menor a mayor)" }).click();
await p.waitForURL(/sort=price-asc/, { timeout: 20000 });
await settled(p);
const asc = await seen();
const ascPrices = await pricesOnPage();
await p.getByLabel("Ordenar").click();
await p.getByRole("option", { name: "Precio (mayor a menor)" }).click();
await p.waitForURL(/sort=price-desc/, { timeout: 20000 });
await settled(p);
const desc = await seen();
const descPrices = await pricesOnPage();
if (JSON.stringify(asc) === JSON.stringify(desc)) throw new Error("el orden no cambió nada");
/*
 * Lo que se comprueba es que los precios de la página estén ordenados, no que una lista sea
 * la otra al revés: el catálogo pagina de 6 en 6 (`CATALOG_PAGE_SIZE`), así que la primera
 * página ascendente y la primera descendente son conjuntos distintos en cuanto hay más de
 * seis inmuebles. Esa aserción sólo pasaba mientras los datos de prueba cabían en una página.
 */
const ordered = (values, compare) => values.every((v, i) => i === 0 || compare(values[i - 1], v));
if (!ordered(ascPrices, (a, b) => a <= b)) throw new Error(`price-asc no viene ordenado: ${ascPrices.join(" ")}`);
if (!ordered(descPrices, (a, b) => a >= b)) throw new Error(`price-desc no viene ordenado: ${descPrices.join(" ")}`);
if (descPrices[0] < ascPrices[0]) throw new Error(`el más caro (${descPrices[0]}) no supera al más barato (${ascPrices[0]})`);
ok("ordenar por precio ordena de verdad", `asc desde ${ascPrices[0]}, desc desde ${descPrices[0]}`);

// ---------- un enlace compartido llega igual ----------
const shared = BASE + "/inmuebles?city=Manizales&type=studio&features=furnished&sort=price-asc";
await p.goto(shared, { waitUntil: "domcontentloaded" });
await settled(p);
if ((await mine()).length !== 1) throw new Error("el enlace compartido no reproduce la vista");
// El rol, no `data-state`: Radix lo pone también en el indicador interno y contaría doble.
const marcados = await aside.locator('[role="checkbox"][aria-checked="true"]').count();
if (marcados !== 2) throw new Error("el enlace no dejó marcadas las casillas: " + marcados);
if ((await p.getByLabel("Ciudad").textContent()).indexOf("Manizales") === -1) throw new Error("la ciudad no quedó seleccionada");
ok("un enlace con filtros llega con todo marcado", "ciudad, tipo, característica y orden");

// ---------- basura en la URL ----------
await p.goto(BASE + "/inmuebles?city=Narnia&type=castle&bedrooms=99&sort=cheapest&page=-3", { waitUntil: "domcontentloaded" });
await settled(p);
const visible = await p.evaluate(() => document.body.innerText);
if (visible.includes("Narnia") || visible.includes("castle")) throw new Error("la basura se refleja en la página");
/*
 * Contra el encabezado, no contra las tarjetas: el catálogo pagina de 6 en 6
 * (`CATALOG_PAGE_SIZE`), así que comparar `seen().length` con el total sólo coincidía mientras
 * todo cupiera en una página.
 */
const tras = await headingTotal();
if (tras !== total) throw new Error(`la basura no cayó a la vista completa: ${tras} vs ${total}`);
ok("una URL manipulada cae a la vista completa sin reflejar nada");

// ---------- móvil ----------
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
if (await aside.isVisible()) throw new Error("la columna de filtros se cuela en móvil");
await p.getByRole("button", { name: "Filtros" }).click();
const sheet = p.getByRole("dialog");
await sheet.waitFor({ state: "visible", timeout: 5000 });
await sheet.getByLabel("Casa").click();
await p.waitForURL(/type=house/, { timeout: 20000 });
await settled(p);
await p.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 5000 });
ok("en móvil los filtros están tras un botón y se cierran al elegir");
await p.getByRole("button", { name: "Filtros" }).click();
await sheet.waitFor({ state: "visible" });
const dupes = await p.evaluate(() => {
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  return ids.filter((id, i) => ids.indexOf(id) !== i);
});
if (dupes.length) throw new Error("ids duplicados con los dos paneles montados: " + JSON.stringify(dupes));
ok("con los dos paneles montados no hay ids duplicados");
await p.keyboard.press("Escape");
await sheet.waitFor({ state: "hidden" });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await p.screenshot({ path: `${SHOT_DIR}/facetas-movil.png`, fullPage: true });
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
