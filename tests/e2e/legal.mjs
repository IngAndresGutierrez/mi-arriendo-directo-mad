/**
 * Lo legal, visto desde el navegador: las tres páginas, el pie que las alcanza y el banner de
 * cookies.
 *
 * **La afirmación que justifica todo el driver es la primera**: `/terminos` y `/privacidad`
 * estaban enlazadas desde el registro y desde el onboarding, y respondían 404 desde el día en que
 * esos enlaces existen. Eso no lo atrapa `pnpm build` —un `<Link>` a una ruta inexistente compila
 * perfecto— ni `pnpm test`. Solo se ve pidiendo la página.
 *
 * Lo demás son consecuencias, no `<meta>`: que el pie exista donde de verdad está la gente (el
 * catálogo, la ficha de un inmueble) y **no rompa el marco fijo** del catálogo, que el banner
 * aparezca una vez y no vuelva, y que la decisión quede escrita en la cookie con el valor que le
 * corresponde.
 *
 * Lo que este nivel **no** puede probar y por qué: que Analytics quede efectivamente bloqueado. En
 * el entorno emulado `measurementId` no existe, así que Firebase Analytics no arranca en ninguno de
 * los dos casos y contar peticiones a `googletagmanager.com` daría cero siempre. El gateo está
 * cubierto por `features/legal/domain/cookies.test.ts`; aquí se prueba la decisión y la cookie.
 */
import { chromium } from "playwright";

import {
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  keepCookieBanner,
  ok,
  settled,
  stubTiles,
} from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();

/** Lo que el módulo del Responsable publica. Si esto cambia, el pie y las páginas cambian con él. */
const RESPONSABLE = "Mi Arriendo Directo S.A.S.";
const DOMICILIO = "Manizales, Caldas, Colombia";
const CONSENT_COOKIE = "cookie-consent";

const PAGINAS = [
  { ruta: "/terminos", titulo: "Términos y condiciones" },
  { ruta: "/privacidad", titulo: "Política de tratamiento de datos personales" },
  { ruta: "/cookies", titulo: "Cookies y datos de navegación" },
];

const b = await chromium.launch();
const contexto = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await contexto.newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push("pageerror: " + e.message));

/** El valor de una cookie de este contexto, o `undefined`. */
async function cookie(ctx, nombre) {
  const todas = await ctx.cookies();

  return todas.find((c) => c.name === nombre)?.value;
}

// ---------- las tres páginas responden, y dicen quién responde ----------
for (const { ruta, titulo } of PAGINAS) {
  const respuesta = await p.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  if (!respuesta || respuesta.status() !== 200) {
    throw new Error(`${ruta} respondió ${respuesta?.status() ?? "nada"} — este era el 404`);
  }
  await settled(p);

  const h1 = await p.locator("h1").first().innerText();
  if (!h1.includes(titulo)) throw new Error(`${ruta} no se titula "${titulo}", dice "${h1}"`);

  /*
   * El contenido mínimo del artículo 2.2.2.25.3.3 del Decreto 1074: identidad y datos de contacto
   * del Responsable. Se afirma sobre el texto que recibe un desconocido, no sobre la constante.
   */
  const texto = await p.locator("body").innerText();
  if (!texto.includes(RESPONSABLE)) throw new Error(`${ruta} no identifica al Responsable`);
  if (!texto.includes(DOMICILIO)) throw new Error(`${ruta} no dice el domicilio`);
  if (!/Versión \d+ · Vigente desde/.test(texto)) {
    throw new Error(`${ruta} no dice qué versión es ni desde cuándo`);
  }

  /*
   * El NIT no existe todavía y la línea **no debe pintarse a medias**: un "NIT" suelto es peor que
   * omitirlo. Cuando exista, esta afirmación sigue siendo cierta con el número al lado.
   */
  if (/NIT\s*(<|$|\n)/m.test(texto)) throw new Error(`${ruta} pinta un NIT vacío`);

  ok(`${ruta} responde 200 e identifica al Responsable`);
}

// ---------- una obligación del artículo 14 y 15: los plazos, por escrito ----------
{
  await p.goto(BASE + "/privacidad", { waitUntil: "domcontentloaded" });
  await settled(p);
  const texto = await p.locator("body").innerText();

  for (const plazo of ["diez días hábiles", "quince días hábiles"]) {
    if (!texto.includes(plazo)) throw new Error(`la política no dice el plazo: ${plazo}`);
  }
  /* Y el ancla que el aviso de privacidad y el perfil enlazan tiene que existir de verdad. */
  if ((await p.locator("#derechos").count()) === 0) {
    throw new Error("#derechos no existe: los enlaces al procedimiento no llegan a ningún lado");
  }
  ok("la política publica el procedimiento, sus plazos y el ancla que todos enlazan");
}

// ---------- el pie, desde donde de verdad está la gente ----------
{
  await stubTiles(p);

  for (const ruta of ["/inmuebles", "/soporte"]) {
    await p.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
    await settled(p);

    const pie = p.locator("footer");
    if ((await pie.count()) === 0) throw new Error(`${ruta} no trae pie de página`);

    const nav = p.getByRole("navigation", { name: "Información legal" });
    for (const nombre of ["Términos y condiciones", "Tratamiento de datos", "Cookies"]) {
      const enlace = nav.getByRole("link", { name: nombre });
      if ((await enlace.count()) === 0) {
        throw new Error(`el pie de ${ruta} no enlaza "${nombre}"`);
      }
      /*
       * **En pestaña nueva.** Estos enlaces se pulsan desde el pie de una búsqueda que costó un
       * minuto armar, desde una casilla en medio de un formulario a medio llenar y desde un banner
       * sobre algo que se estaba leyendo: navegar fuera pierde las tres cosas. Es una decisión que
       * un rediseño puede tirar sin que nada se queje, y `LegalLink` existe para que no se pierda
       * en el siguiente enlace que alguien añada.
       */
      if ((await enlace.getAttribute("target")) !== "_blank") {
        throw new Error(`"${nombre}" en el pie de ${ruta} no abre en pestaña nueva`);
      }
      if (!((await enlace.getAttribute("rel")) ?? "").includes("noopener")) {
        throw new Error(`"${nombre}" en el pie de ${ruta} abre en pestaña nueva sin noopener`);
      }
    }
    ok(`${ruta} alcanza las tres políticas desde el pie, en pestaña nueva`);
  }
}

/*
 * ---------- y el pie no rompe el marco fijo del catálogo ----------
 *
 * Desde `lg` el chrome público es `fixed inset-0` y `main` es el que scrollea, precisamente para
 * que el encabezado y las facetas no se muevan. Un pie metido dentro de `main` sin más habría hecho
 * scrolleable a `main`, y entonces las facetas se van de pantalla — que es el problema que el marco
 * fijo existe para evitar. Se afirma sobre la consecuencia: `main` no desborda.
 */
{
  await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
  await settled(p);

  const desborde = await p.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;

    return { scroll: main.scrollHeight, visible: main.clientHeight };
  });
  if (!desborde) throw new Error("el catálogo no tiene main");
  if (desborde.scroll > desborde.visible + 2) {
    throw new Error(
      `main del catálogo desborda ${desborde.scroll - desborde.visible}px: las facetas se pueden ir de pantalla`,
    );
  }
  ok("el catálogo sigue siendo un marco fijo con el pie dentro");
}

// ---------- el banner: aparece una vez, y su decisión se escribe ----------
{
  const limpio = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await limpio.newPage();
  q.on("pageerror", (e) => problemas.push("pageerror (banner): " + e.message));
  // `settled()` le quita la intercepción al banner en todos los demás drivers; aquí hay que pulsarlo.
  keepCookieBanner(q);
  await stubTiles(q);

  await q.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
  await settled(q);

  const banner = q.getByRole("region", { name: "Uso de cookies" });
  await banner.waitFor({ state: "visible", timeout: 15000 });

  /*
   * Dos botones reales. Un banner cuyo único control acepta no recoge una autorización libre, y esa
   * es justo la afirmación que un rediseño podría romper sin que nada más se dé cuenta.
   */
  for (const nombre of ["Aceptar", "Solo las necesarias"]) {
    if ((await banner.getByRole("button", { name: nombre }).count()) === 0) {
      throw new Error(`el banner no ofrece "${nombre}"`);
    }
  }
  if (await cookie(limpio, CONSENT_COOKIE)) {
    throw new Error("hay decisión guardada antes de que nadie decida");
  }
  ok("el banner aparece en un contexto limpio y ofrece las dos respuestas");

  await banner.getByRole("button", { name: "Solo las necesarias" }).click();
  await banner.waitFor({ state: "detached", timeout: 10000 });

  /*
   * El valor, no solo que exista. `1` es "decidido, nada opcional concedido"; `1-analytics` es lo
   * contrario, y confundirlos es exactamente el bug que dejaría a Analytics corriendo sin permiso.
   */
  const rechazo = await cookie(limpio, CONSENT_COOKIE);
  if (rechazo !== "1") throw new Error(`rechazar escribió "${rechazo}", esperaba "1"`);
  ok("rechazar escribe la decisión sin conceder nada", rechazo);

  // Y no vuelve a preguntar: una decisión que se olvida no es una decisión.
  await q.reload({ waitUntil: "domcontentloaded" });
  await settled(q);
  await q.waitForTimeout(600);
  if (await banner.isVisible().catch(() => false)) {
    throw new Error("el banner volvió después de decidir");
  }
  ok("y no vuelve tras recargar");

  // ---------- el interruptor de /cookies es lo que hace revocable la autorización ----------
  await q.goto(BASE + "/cookies", { waitUntil: "domcontentloaded" });
  await settled(q);

  const interruptor = q.getByRole("switch", { name: "Cookies de analítica" });
  await interruptor.waitFor({ state: "visible", timeout: 15000 });
  if ((await interruptor.getAttribute("aria-checked")) !== "false") {
    throw new Error("el interruptor no refleja la decisión que se acaba de tomar");
  }

  await interruptor.click();
  await q.waitForFunction(
    () => document.cookie.includes("cookie-consent=1-analytics"),
    null,
    { timeout: 10000 },
  );
  const concedido = await cookie(limpio, CONSENT_COOKIE);
  if (concedido !== "1-analytics") {
    throw new Error(`conceder escribió "${concedido}", esperaba "1-analytics"`);
  }
  ok("conceder desde /cookies reescribe la decisión", concedido);

  // Revocar otra vez: el derecho del artículo 8, literal e, tiene que funcionar en los dos sentidos.
  await interruptor.click();
  await q.waitForFunction(
    () => /(^|; )cookie-consent=1(;|$)/.test(document.cookie),
    null,
    { timeout: 10000 },
  );
  ok("y revocarla también");

  await q.screenshot({ path: `${SHOT_DIR}/legal-cookies.png`, fullPage: true });
  await limpio.close();
}

// ---------- 390px ----------
{
  const movil = await b.newContext({ viewport: { width: 390, height: 844 } });
  const m = await movil.newPage();
  m.on("pageerror", (e) => problemas.push("pageerror (390): " + e.message));

  for (const { ruta } of PAGINAS) {
    await m.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
    await settled(m);
    await assertNoHorizontalScroll(m, ruta);
  }
  await m.screenshot({ path: `${SHOT_DIR}/legal-390.png`, fullPage: true });
  ok("las tres páginas caben en 390px sin scroll horizontal");
  await movil.close();
}

assertQuiet(problemas);
await b.close();
