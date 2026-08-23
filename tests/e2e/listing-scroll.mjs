/** En el catálogo se desplaza el listado, no la página. En móvil, al contrario. */
import { chromium } from "playwright";
import { BASE, config, ok, settled } from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 800 } })).newPage();
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("ul li a[href^='/inmuebles/']", { timeout: 15000 });

const medidas = await p.evaluate(() => {
  const lista = document.querySelector("main ul");
  // Comportamiento, no `scrollHeight`: el contenido de un panel con scroll propio sobresale de
  // su caja y hace que `scrollHeight` mienta. Lo que importa es si la ventana se mueve.
  window.scrollTo(0, 500);
  const ventanaSeMovio = window.scrollY > 0;
  window.scrollTo(0, 0);
  return {
    listaDesborda: lista.scrollHeight > lista.clientHeight + 1,
    ventanaSeMovio,
    listaAlto: Math.round(lista.clientHeight),
    ventana: window.innerHeight,
  };
});
if (!medidas.listaDesborda) throw new Error("la lista no tiene desplazamiento propio: " + JSON.stringify(medidas));
if (medidas.ventanaSeMovio) throw new Error("la página sigue desplazándose: " + JSON.stringify(medidas));
ok("el listado se desplaza por dentro y la página no", JSON.stringify(medidas));

// El encabezado, los filtros y la paginación se quedan quietos al desplazar la lista
const antes = await p.evaluate(() => ({
  h1: Math.round(document.querySelector("h1").getBoundingClientRect().top),
  filtros: Math.round(document.querySelector('aside[aria-label="Filtros"]').getBoundingClientRect().top),
  pager: Math.round(document.querySelector('nav[aria-label="Paginación"]').getBoundingClientRect().top),
}));
await p.evaluate(() => { document.querySelector("main ul").scrollTop = 400; });
const despues = await p.evaluate(() => ({
  h1: Math.round(document.querySelector("h1").getBoundingClientRect().top),
  filtros: Math.round(document.querySelector('aside[aria-label="Filtros"]').getBoundingClientRect().top),
  pager: Math.round(document.querySelector('nav[aria-label="Paginación"]').getBoundingClientRect().top),
  scroll: document.querySelector("main ul").scrollTop,
}));
if (despues.scroll < 300) throw new Error("la lista no se movió");
for (const clave of ["h1", "filtros", "pager"]) {
  if (Math.abs(antes[clave] - despues[clave]) > 1) throw new Error(`${clave} se movió con el scroll de la lista`);
}
ok("encabezado, filtros y paginación se quedan quietos", `lista en ${despues.scroll}px`);
await p.screenshot({ path: `${SHOT_DIR}/scroll-listado.png`, fullPage: false });

// El detalle sigue desplazándose como una página normal
const href = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
await p.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(p);
const detalle = await p.evaluate(() => {
  const main = document.querySelector("main");
  return { mainDesborda: main.scrollHeight > main.clientHeight + 1 };
});
if (!detalle.mainDesborda) throw new Error("el detalle no se desplaza");
ok("el detalle de un inmueble se desplaza normal");

// Móvil: la página vuelve a ser la que se desplaza
await p.setViewportSize({ width: 390, height: 780 });
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("ul li a[href^='/inmuebles/']", { timeout: 15000 });
const movil = await p.evaluate(() => {
  window.scrollTo(0, 400);
  const pagina = window.scrollY > 0;
  window.scrollTo(0, 0);
  const l = document.querySelector("main ul");
  return {
    lista: l.scrollHeight > l.clientHeight + 1,
    pagina,
    horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});
if (movil.lista) throw new Error("en móvil la lista tiene scroll propio");
if (!movil.pagina) throw new Error("en móvil la página no se desplaza");
if (movil.horizontal) throw new Error("scroll horizontal en 390px");
ok("en 390px se desplaza la página, como antes");
await b.close();
