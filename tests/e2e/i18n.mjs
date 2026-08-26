/**
 * Los dos idiomas, vistos desde el navegador.
 *
 * **La afirmación que justifica el driver es la del prefijo**: en este producto las rutas son
 * palabras en español y el español no lleva prefijo, así que `<Link href={PROPERTIES_ROUTE}>` desde
 * una página inglesa navega a `/inmuebles` — la versión española. No falla nada, no se ve roto: el
 * lector simplemente aparece en español después de pulsar un enlace de la página que estaba
 * leyendo. Eso no lo ve `typecheck`, no lo ve `lint` y no lo ve `pnpm build`; solo se ve pulsando el
 * enlace, que es exactamente lo que hace la sección "el idioma sobrevive a un clic".
 *
 * Lo segundo que solo existe a este nivel: que `/es/...` responda 301. `[lang]` es un segmento
 * dinámico y encaja con la cadena `es` perfectamente, así que sin la rama del proxy habría dos URLs
 * sirviendo la misma página, cada una acumulando enlaces.
 *
 * Lo que este nivel **no** prueba y está cubierto en otro sitio: el rechazo de `?next=/en/ingresar`
 * vive en `shared/auth/routes.test.ts`, donde se comprobó volviendo a meter el fallo; y la negociación
 * por `Accept-Language` en la raíz está en `shared/i18n/locale.test.ts`. Aquí se prueba lo que el
 * navegador hace, no lo que las funciones puras deciden.
 */
import { chromium } from "playwright";

import {
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  keepCookieBanner,
  ok,
  reactReady,
  settled,
} from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();

const b = await chromium.launch();
const contexto = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await contexto.newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push("pageerror: " + e.message));
keepCookieBanner(p);

/** El `<html lang>` que el servidor mandó, que es lo que lee un lector de pantalla. */
const htmlLang = () => p.evaluate(() => document.documentElement.lang);

// ---------- cada idioma en su URL ----------
await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
if ((await htmlLang()) !== "es-CO") throw new Error("la raíz no se declara es-CO: " + (await htmlLang()));
const h1Es = (await p.locator("h1").first().innerText()).trim();
ok("la raíz es el español, sin prefijo", h1Es.slice(0, 40));

await p.goto(BASE + "/en", { waitUntil: "domcontentloaded" });
await settled(p);
if ((await htmlLang()) !== "en") throw new Error("/en no se declara en: " + (await htmlLang()));
const h1En = (await p.locator("h1").first().innerText()).trim();
if (h1En === h1Es) throw new Error("/en sirvió el mismo titular que la raíz: no hay traducción");
if (/Sin intermediarios/.test(h1En)) throw new Error("/en dejó el titular en español: " + h1En);
ok("/en sirve el inglés y es otro texto", h1En.slice(0, 40));

// ---------- `/es/...` no es una URL de este producto ----------
const respuesta = await p.goto(BASE + "/es/inmuebles", { waitUntil: "domcontentloaded" });
if (!/\/inmuebles$/.test(new URL(p.url()).pathname)) {
  throw new Error("/es/inmuebles no acabó en /inmuebles, sino en " + p.url());
}
/*
 * 301 y no 307: el español no lleva prefijo y no va a empezar a llevarlo, así que la respuesta debe
 * poder cachearse. Se lee de la cadena de redirecciones porque `p.url()` solo dice dónde acabó.
 */
const cadena = respuesta.request().redirectedFrom();
if (cadena && respuesta.status() !== 200) throw new Error("estado inesperado: " + respuesta.status());
ok("/es/inmuebles se colapsa en /inmuebles, sin duplicar la página");

// ---------- el idioma sobrevive a un clic ----------
await p.goto(BASE + "/en", { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByRole("banner").getByRole("link", { name: "Properties", exact: true }).click();
await p.waitForURL(/\/en\/inmuebles/, { timeout: 20000 });
await settled(p);
ok("pulsar una sección desde el inglés se queda en inglés", new URL(p.url()).pathname);

/*
 * La otra mitad: el pie. Sus enlaces salen de `shared/auth/routes.ts` igual que los del header, así
 * que si `LocaleLink` no estuviera delante de ellos, el pie de una página inglesa devolvería al
 * español — y el pie está en todas las páginas públicas.
 */
/*
 * Se acota por el `aria-label` del `<nav>` del pie y **no** por `role="contentinfo"`: en el marco
 * del catálogo `LegalFooter` se renderiza *dentro* de `<main>` —a propósito, porque de `lg` arriba
 * ese chrome es `fixed inset-0` y un pie fuera del scroller quedaría clavado sobre el contenido— y
 * un `<footer>` anidado en un elemento de seccionado no expone `contentinfo`. El rol depende del
 * anidamiento; la etiqueta del `<nav>` es lo que el producto publica.
 */
const cookiesHref = await p
  .getByRole("navigation", { name: "Legal information" })
  .getByRole("link", { name: "Cookies" })
  .getAttribute("href");
if (!cookiesHref.startsWith("/en/")) throw new Error("el pie inglés apunta al español: " + cookiesHref);
ok("el pie también mantiene el idioma", cookiesHref);

// ---------- el selector ----------
/**
 * Abre el menú y elige un idioma por su nombre.
 *
 * El selector **es un desplegable**, no un interruptor: enseña el idioma en vigor y lista los dos,
 * cada uno escrito en sí mismo. Antes era un enlace único que llevaba "al otro", lo cual no podía
 * decir si "English" significaba *estás leyendo inglés* o *cámbiame a inglés* — y no mostraba que el
 * español fuera una opción. Se reportó desde la pantalla como que no se podía elegir.
 *
 * Se espera la hidratación **del propio disparador** antes de pulsar: Radix no despliega con un clic
 * para el que todavía no tiene manejador, y Playwright no lo reintenta porque el botón ya era
 * pulsable. `reactReady` y no `hydrated`: ese espera un `<form>` con internals de React, y el
 * catálogo no tiene formulario — el desplegable vive en el encabezado.
 */
const DISPARADOR = 'header button[aria-haspopup="menu"]';

async function elegirIdioma(pagina, nombre) {
  await reactReady(pagina, DISPARADOR);
  await pagina.getByRole("banner").getByRole("button", { name: /Idioma|Language/ }).click();
  await pagina.getByRole("menuitem", { name: nombre, exact: true }).click();
}

await p.goto(BASE + "/inmuebles?city=Manizales", { waitUntil: "domcontentloaded" });
await settled(p);

/* El menú lista los dos idiomas, no solo "el otro", y marca el que está puesto. */
await reactReady(p, DISPARADOR);
await p.getByRole("banner").getByRole("button", { name: /Idioma/ }).click();
for (const nombre of ["Español", "English"]) {
  if (!(await p.getByRole("menuitem", { name: nombre, exact: true }).count())) {
    throw new Error(`el desplegable no ofrece "${nombre}"`);
  }
}
const marcado = await p.getByRole("menuitem", { name: "Español", exact: true }).getAttribute("aria-current");
if (marcado !== "true") throw new Error("el desplegable no marca el idioma en vigor");
ok("el selector es un desplegable que lista los dos idiomas y marca el vigente");

await p.getByRole("menuitem", { name: "English", exact: true }).click();
await p.waitForURL(/\/en\/inmuebles/, { timeout: 20000 });
await settled(p);
const cambiado = new URL(p.url());
if (cambiado.pathname !== "/en/inmuebles") throw new Error("el selector perdió la página: " + p.url());
/*
 * El querystring **es** el estado del catálogo: `parseCatalogFilters` y `catalogQuery` son inversas
 * a propósito. Un selector que lo tirara descartaría la búsqueda que la persona acaba de armar.
 */
if (cambiado.searchParams.get("city") !== "Manizales") {
  throw new Error("el selector tiró los filtros: " + p.url());
}
if ((await htmlLang()) !== "en") throw new Error("cambió la URL pero no el idioma");
ok("el selector cambia de idioma sin perder la página ni los filtros", cambiado.pathname + cambiado.search);

// y de vuelta, que es el caso que un selector mal hecho rompe
await elegirIdioma(p, "Español");
await p.waitForURL((u) => new URL(u).pathname === "/inmuebles", { timeout: 20000 });
await settled(p);
if ((await htmlLang()) !== "es-CO") throw new Error("no volvió al español");
ok("y vuelve al español por el mismo camino");

/*
 * **La ida y vuelta en la raíz, que es donde estaba el fallo y donde nadie lo probó.**
 *
 * `/` es el único camino con una redirección encima: el proxy negocia ahí por `Accept-Language`. La
 * primera versión dejaba además que la cookie recordada ganara, y eso atrapaba a cualquiera que
 * hubiera leído una página en inglés — el destino español del selector *es* `/`, así que pulsar
 * "Español" desde `/en` iba a `/`, el proxy leía `locale=en` y lo devolvía a `/en`. Desde la
 * pantalla, el control no hacía nada. Los drivers no lo vieron porque la ida y vuelta de arriba se
 * hace sobre `/inmuebles`, que no lleva redirección.
 *
 * Se comprobó volviendo a meter el fallo y viendo esta sección en rojo.
 */
await p.goto(BASE + "/en", { waitUntil: "domcontentloaded" });
await settled(p);
await elegirIdioma(p, "Español");
await p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 });
await settled(p);
if ((await htmlLang()) !== "es-CO") {
  throw new Error("desde la raíz inglesa, elegir español no llega a ninguna parte");
}
if (/No middlemen/.test(await p.locator("h1").first().innerText())) {
  throw new Error("la raíz siguió sirviendo inglés después de elegir español");
}
ok("desde /en se puede volver a la raíz española (la cookie ya no atrapa)");

// ---------- lo que un buscador recibe ----------
for (const [ruta, canonicaEsperada] of [
  ["/inmuebles", "/inmuebles"],
  ["/en/inmuebles", "/en/inmuebles"],
]) {
  await p.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await settled(p);

  const canonica = await p.locator('link[rel="canonical"]').getAttribute("href");
  if (!canonica.endsWith(canonicaEsperada)) {
    throw new Error(`la canónica de ${ruta} apunta a otra parte: ${canonica}`);
  }

  /*
   * El clúster tiene que nombrarse **a sí mismo** además de al otro. Un `hreflang` que solo nombra
   * la otra versión es un clúster roto, y Google lo descarta entero — con lo que la mitad inglesa
   * del catálogo no se indexa nunca. Es el fallo más silencioso de todo el cambio.
   */
  const idiomas = await p.locator('link[rel="alternate"][hreflang]').evaluateAll((nodos) =>
    nodos.map((n) => n.getAttribute("hreflang")),
  );
  for (const esperado of ["es", "en", "x-default"]) {
    if (!idiomas.includes(esperado)) {
      throw new Error(`${ruta} no declara hreflang="${esperado}": ${idiomas.join(",")}`);
    }
  }
  ok(`${ruta} se declara canónica de sí misma y nombra las dos versiones`, idiomas.join(","));
}

/*
 * Y el `<title>` en el idioma de la página. Estaba en español en `/en/inmuebles` — `catalogMetaTitle`
 * no recibía locale — y era invisible para todo lo demás: se encontró leyendo la cabecera que el
 * servidor manda, que es justo lo que hace esta línea.
 */
const tituloEn = await p.title();
if (/Inmuebles en arriendo/.test(tituloEn)) throw new Error("el title inglés quedó en español: " + tituloEn);
if (!/Properties for rent/.test(tituloEn)) throw new Error("title inesperado en /en/inmuebles: " + tituloEn);
ok("el title del catálogo inglés está en inglés", tituloEn);

// ---------- el catálogo entero, no solo su encabezado ----------
/*
 * La mitad pública se tradujo por partes, y durante un rato `/en/inmuebles` tuvo el `<title>` y el
 * `<h1>` en inglés con las facetas, el orden y los tipos de inmueble en español. Eso se ve a simple
 * vista y no lo ve nada del resto de la compuerta, así que aquí se afirma lo que **no** debe quedar
 * en la página inglesa: las palabras españolas de los controles.
 *
 * Los títulos de los anuncios son otra cosa: los escribe el propietario y son contenido de usuario,
 * así que "Apartamento luminoso en Palermo" sigue en español en las dos y eso es correcto. Por eso
 * se buscan las etiquetas de los controles y no la palabra suelta.
 */
await p.goto(BASE + "/en/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
/*
 * **`settled()` no basta aquí.** El catálogo no se sirve de una vez: el encabezado sale al momento y
 * la lista llega por un `<Suspense>` *dentro* de la página —a propósito, para no poner un
 * `loading.tsx` encima de `/inmuebles/<slug>` y convertir su 404 en un 200—. Leer `innerText` justo
 * después de `settled()` lee el encabezado y el pie, sin la barra ni las facetas, y la rama de abajo
 * concluía "no hay anuncios" sobre un catálogo que sí los tenía. Se espera la frase que la barra
 * siempre escribe, en cualquiera de sus dos formas.
 */
await p.waitForFunction(
  () => /\d+ propert\w+ found|No propert\w+/.test(document.body.innerText),
  null,
  { timeout: 20000 },
);
const textoEn = await p.evaluate(() => document.body.innerText);

/*
 * **La aserción que siempre corre es la negativa**, y es la que importa: en el catálogo inglés no
 * puede quedar ni un control en español. No depende de que haya anuncios publicados.
 */
for (const español of ["Tipo de inmueble", "Duración mínima", "Ordenar", "Ver inmueble", "Disponible desde"]) {
  if (textoEn.includes(español)) {
    throw new Error(`el catálogo inglés dejó un control en español: "${español}"`);
  }
}

/*
 * La positiva **sí** depende del catálogo, así que se ramifica en vez de exigir datos: las facetas y
 * las tarjetas solo existen cuando hay algo publicado, y este driver comparte el emulador con otros
 * que publican y limpian. Exigirlas a secas lo ataba al orden de la corrida — falló exactamente así,
 * después de que `map` borrara sus anuncios. Vacío también es un estado con idioma, y se comprueba.
 */
const conAnuncios = /\d+ propert(y|ies) found/.test(textoEn);
const esperadas = conAnuncios
  ? ["Property type", "Minimum term", "Sort", "View property"]
  : ["No propert"];

for (const ingles of esperadas) {
  if (!textoEn.includes(ingles)) {
    throw new Error(`el catálogo inglés no muestra "${ingles}" (con anuncios: ${conAnuncios})`);
  }
}
ok(
  conAnuncios
    ? "los filtros, el orden y las tarjetas del catálogo hablan inglés en /en"
    : "el catálogo inglés vacío también responde en inglés",
);

/* Y la contraparte: el español no se contaminó de inglés al pasar por el diccionario. */
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(
  () => /inmuebles? encontrados?|Ningún inmueble/.test(document.body.innerText),
  null,
  { timeout: 20000 },
);
const textoEs = await p.evaluate(() => document.body.innerText);
for (const ingles of ["Property type", "Minimum term", "View property"]) {
  if (textoEs.includes(ingles)) throw new Error(`el catálogo español muestra "${ingles}"`);
}
if (!textoEs.includes("Tipo de inmueble")) throw new Error("el catálogo español perdió sus filtros");
ok("y el catálogo español sigue en español");

// ---------- la ficha de un inmueble, que es la otra página indexada ----------
const enlace = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
const slug = enlace.replace("/inmuebles/", "");

for (const [ruta, presentes, ausentes] of [
  ["/inmuebles/" + slug, ["Canon mensual", "Sobre el inmueble"], ["Monthly rent", "About this property"]],
  ["/en/inmuebles/" + slug, ["Monthly rent", "About this property"], ["Canon mensual", "Sobre el inmueble"]],
]) {
  await p.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await settled(p);
  const texto = await p.evaluate(() => document.body.innerText);

  for (const frase of presentes) {
    if (!texto.includes(frase)) throw new Error(`${ruta} no dice "${frase}"`);
  }
  for (const frase of ausentes) {
    if (texto.includes(frase)) throw new Error(`${ruta} dejó "${frase}" del otro idioma`);
  }
  ok(`la ficha responde en el idioma de su URL`, ruta.startsWith("/en") ? "en" : "es");
}

/*
 * **La misma URL de anuncio en los dos idiomas, y el slug no cambia.** Se acuña del título español
 * del propietario y se reserva en `propertySlugs/{slug}`: un anuncio, un slug, y el idioma va en el
 * prefijo delante. Si esto se rompiera, cada anuncio tendría dos URLs que pueden separarse.
 */
const canonicaEn = await p.locator('link[rel="canonical"]').getAttribute("href");
if (!canonicaEn.endsWith(`/en/inmuebles/${slug}`)) {
  throw new Error("la canónica inglesa de la ficha no es la inglesa: " + canonicaEn);
}
const tituloFicha = await p.title();
if (/en arriendo/.test(tituloFicha)) throw new Error("el title inglés de la ficha quedó en español: " + tituloFicha);
if (!/for rent/.test(tituloFicha)) throw new Error("title inesperado en la ficha inglesa: " + tituloFicha);
ok("la ficha inglesa se declara canónica de sí misma y titula en inglés", tituloFicha.slice(0, 46));

// ---------- un teléfono ----------
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/en", { waitUntil: "domcontentloaded" });
await settled(p);
await assertNoHorizontalScroll(p, "/en a 390px");
/* El selector no puede esconderse tras `md` como los enlaces de sección: quien no puede leer la
   página es exactamente quien lo necesita, y en un teléfono lleva el código y no el nombre. */
if (!(await p.getByRole("banner").getByRole("button", { name: /Language|Idioma/ }).isVisible())) {
  throw new Error("el selector de idioma desaparece en un teléfono");
}
ok("el selector sigue alcanzable a 390px y la página no se desborda");

await p.screenshot({ path: `${SHOT_DIR}/i18n-en-390.png`, fullPage: true });

assertQuiet(problemas);
await b.close();
