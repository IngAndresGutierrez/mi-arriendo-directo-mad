/**
 * El catálogo se desplaza como una página, no por dentro.
 *
 * **Este driver afirmaba lo contrario hasta hoy**, y no porque estuviera mal: `PublicChrome` era
 * `lg:fixed lg:inset-0`, el `main` se llevaba el scroll y el listado tenía el suyo propio, para que
 * el encabezado y los filtros no se movieran nunca. Un filtro que no se ve es un filtro que se
 * olvida, y ese argumento sigue siendo cierto. Lo que lo tumbó fue el precio: la tarjeta que quedaba
 * a medias contra el borde inferior de un panel sin página debajo, y un pie de página que estaba al
 * final de una región y no al final del documento.
 *
 * Así que lo que se comprueba ahora es lo simétrico —la ventana se mueve, nada de dentro tiene
 * barra— más la mitad que sustituye a lo que se perdió: el encabezado se queda pegado arriba y la
 * columna de filtros debajo de él.
 */
import { chromium } from "playwright";
import { BASE, config, ok, settled } from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 800 } })).newPage();
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("ul li a[href^='/inmuebles/']", { timeout: 15000 });

// Comportamiento, no `scrollHeight`: lo que importa es si la ventana se mueve.
const medidas = await p.evaluate(() => {
  // Acotado a la lista de resultados: los filtros también son listas, y `main ul` toma la primera.
  const lista = document.querySelector("main ul:has(> li a[href^='/inmuebles/'])");
  const main = document.querySelector("main");
  window.scrollTo(0, 500);
  const ventanaSeMovio = window.scrollY > 0;
  window.scrollTo(0, 0);
  return {
    ventanaSeMovio,
    listaConBarra: lista.scrollHeight > lista.clientHeight + 1,
    mainConBarra: main.scrollHeight > main.clientHeight + 1,
  };
});
if (!medidas.ventanaSeMovio) throw new Error("la página no se desplaza: " + JSON.stringify(medidas));
if (medidas.listaConBarra) throw new Error("el listado sigue teniendo scroll propio: " + JSON.stringify(medidas));
if (medidas.mainConBarra) throw new Error("el main sigue teniendo scroll propio: " + JSON.stringify(medidas));
ok("se desplaza la página y nada de dentro", JSON.stringify(medidas));

/*
 * Ninguna tarjeta puede quedar cortada por el borde de un contenedor: con `overflow-hidden` en la
 * tarjeta, una rejilla a la que le repartan la altura recorta el contenido y no se nota desde
 * fuera. Se compara el alto de la tarjeta con el de lo que lleva dentro.
 */
const recorte = await p.evaluate(() => {
  const li = document.querySelector("main ul > li:has(a[href^='/inmuebles/'])");
  const dentro = [...li.children].reduce((suma, hijo) => suma + hijo.getBoundingClientRect().height, 0);
  return { tarjeta: Math.round(li.getBoundingClientRect().height), contenido: Math.round(dentro) };
});
if (recorte.tarjeta + 2 < recorte.contenido) {
  throw new Error("la tarjeta está recortando su contenido: " + JSON.stringify(recorte));
}
ok("ninguna tarjeta recorta lo que lleva dentro", JSON.stringify(recorte));

// El encabezado se queda pegado y los filtros debajo de él
await p.evaluate(() => window.scrollTo(0, 700));
await p.waitForTimeout(200);
const pegados = await p.evaluate(() => ({
  header: Math.round(document.querySelector("header").getBoundingClientRect().top),
  filtros: Math.round(document.querySelector('aside[aria-label="Filtros"]').getBoundingClientRect().top),
  scrollY: Math.round(window.scrollY),
}));
if (pegados.scrollY < 300) throw new Error("la página no llegó a desplazarse: " + JSON.stringify(pegados));
if (Math.abs(pegados.header) > 1) throw new Error("el encabezado no se quedó arriba: " + JSON.stringify(pegados));
if (pegados.filtros < 0 || pegados.filtros > 200) {
  throw new Error("los filtros no se quedaron a la vista: " + JSON.stringify(pegados));
}
ok("encabezado y filtros se quedan a la vista al bajar", JSON.stringify(pegados));

/*
 * Y el pie está al final del documento, no dentro de un marco. Se comprueba contra el alto del
 * documento y no contra la ventana: pegado al fondo de un marco fijo, el pie se veía sin haber
 * bajado nada, que es justo el síntoma que se quería quitar.
 */
const pie = await p.evaluate(() => {
  const footer = document.querySelector("footer") ?? document.querySelector("main > :last-child");
  const r = footer.getBoundingClientRect();
  return {
    finDelPie: Math.round(r.bottom + window.scrollY),
    altoDocumento: Math.round(document.documentElement.scrollHeight),
  };
});
if (Math.abs(pie.finDelPie - pie.altoDocumento) > 40) {
  throw new Error("el pie no está al final del documento: " + JSON.stringify(pie));
}
ok("el pie cierra el documento", JSON.stringify(pie));
await p.screenshot({ path: `${SHOT_DIR}/scroll-listado.png`, fullPage: false });

// El detalle de un inmueble se desplaza igual: como una página
const href = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
await p.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(p);
const detalle = await p.evaluate(() => {
  window.scrollTo(0, 400);
  const movio = window.scrollY > 0;
  window.scrollTo(0, 0);
  return { movio, mainConBarra: document.querySelector("main").scrollHeight > document.querySelector("main").clientHeight + 1 };
});
if (!detalle.movio) throw new Error("el detalle no se desplaza: " + JSON.stringify(detalle));
if (detalle.mainConBarra) throw new Error("el detalle sigue desplazándose por dentro: " + JSON.stringify(detalle));
ok("el detalle de un inmueble se desplaza como página");

// Móvil: igual, y sin desplazamiento horizontal
await p.setViewportSize({ width: 390, height: 780 });
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("ul li a[href^='/inmuebles/']", { timeout: 15000 });
const movil = await p.evaluate(() => {
  window.scrollTo(0, 400);
  const pagina = window.scrollY > 0;
  window.scrollTo(0, 0);
  const l = document.querySelector("main ul:has(> li a[href^='/inmuebles/'])");
  return {
    lista: l.scrollHeight > l.clientHeight + 1,
    pagina,
    horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});
if (movil.lista) throw new Error("en móvil la lista tiene scroll propio");
if (!movil.pagina) throw new Error("en móvil la página no se desplaza");
if (movil.horizontal) throw new Error("scroll horizontal en 390px");
ok("en 390px se desplaza la página y no hay scroll horizontal");
await b.close();
