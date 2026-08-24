/**
 * La landing pública: lo que responde `miarriendodirecto.com`.
 *
 * Lo que este driver protege es sobre todo la mudanza. `/` era el login, y el compilador no puede
 * ver ninguna de las tres cosas que se rompen al cambiarlo: que la raíz ahora sirva la landing y no
 * un formulario, que el login siga existiendo en su URL nueva, y que el buscador del hero produzca
 * exactamente la URL que el catálogo sabe leer.
 *
 * La afirmación del buscador **sin JavaScript** es la que no se puede reemplazar por una unitaria:
 * el hero se diseñó como un `<form method="get">` con `<select>` nativos justo para funcionar en la
 * ventana anterior a la hidratación, y un Radix Select puesto ahí por descuido seguiría compilando,
 * seguiría pareciendo correcto en pantalla y no enviaría nada.
 */
import { chromium } from "playwright";
import {
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  LOGIN_PATH,
  ok,
  settled,
  watch,
} from "./lib.mjs";

const problems = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = watch(await ctx.newPage(), "landing", problems);

try {
  // ---------- la raíz es la landing, no el login ----------
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(p);

  if (new URL(p.url()).pathname !== "/") {
    throw new Error("la raíz redirigió a " + p.url());
  }
  if (await p.getByLabel("Contraseña").count()) {
    throw new Error("la raíz sigue sirviendo el formulario de acceso");
  }
  const h1 = (await p.getByRole("heading", { level: 1 }).first().innerText()).trim();
  if (!h1) throw new Error("la landing no tiene h1");
  ok("la raíz sirve la landing y no el login", h1.replace(/\s+/g, " "));

  // El título no puede llevar la marca dos veces: la plantilla del layout raíz la añade sola.
  const title = await p.title();
  if ((title.match(/miarriendoDIRECTO/gi) ?? []).length !== 1) {
    throw new Error("la marca sale repetida en el título: " + title);
  }
  ok("el título nombra la marca una sola vez", title);

  // ---------- el login sigue existiendo, en su URL nueva ----------
  await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Contraseña").waitFor({ timeout: 15000 });
  ok("el login responde en su ruta nueva", LOGIN_PATH);

  // Y la landing ofrece cómo llegar a él, o la mudanza deja a la gente sin puerta de entrada.
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(p);
  const entrar = p.getByRole("link", { name: /Iniciar sesión/i }).first();
  if ((await entrar.getAttribute("href")) !== LOGIN_PATH) {
    throw new Error("la landing no lleva al login: " + (await entrar.getAttribute("href")));
  }
  ok("la landing lleva al login");

  // ---------- el buscador del hero, sin JavaScript ----------
  /*
   * Se afirma sobre el destino, no sobre la forma de la URL: lo que importa es que el catálogo
   * reciba la ciudad, y quien decide cómo se escribe ese parámetro es `parseCatalogFilters`. Si
   * este driver comprobara la cadena entera estaría guardando una segunda copia de esa regla.
   */
  const noJs = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  await noJs.route("**/_next/static/**/*.js", (r) => r.abort());
  /*
   * Sin `watch()` a propósito, y es la misma decisión que toma `prehydration.mjs`. Abortar cada
   * bundle es lo que crea esta ventana, y el navegador anota un error de consola por cada uno: si
   * esta página alimentara `problems`, `assertQuiet` fallaría siempre por cuarenta y ocho fallos
   * que provoca el propio driver. Tampoco se pierde nada — con el JavaScript abortado no queda
   * JavaScript que pueda lanzar un `pageerror`.
   */
  const bare = await noJs.newPage();
  await bare.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(bare);

  const hydratedAlready = await bare.evaluate(() => {
    const f = document.querySelector("form");
    return f ? Object.keys(f).some((k) => k.startsWith("__react")) : false;
  });
  if (hydratedAlready) throw new Error("la página hidrató: la prueba no vale");

  const method = await bare.evaluate(() =>
    document.querySelector("form")?.getAttribute("method")?.toLowerCase(),
  );
  if (method !== "get") {
    throw new Error(`el buscador tiene que ser un GET para funcionar sin JS, es ${method}`);
  }

  await bare.selectOption("#landing-type", "studio");
  await bare.getByRole("button", { name: /Buscar/i }).first().click();
  await bare.waitForURL(/\/inmuebles/, { timeout: 20000 });
  await settled(bare);

  if (bare.url().includes("password") || bare.url().includes("correo")) {
    throw new Error("el buscador filtró algo personal a la URL");
  }
  if (!new URL(bare.url()).searchParams.get("type")) {
    throw new Error("el buscador no pasó el tipo al catálogo: " + bare.url());
  }
  ok("el buscador llega al catálogo sin JavaScript", new URL(bare.url()).search);
  await noJs.close();

  // ---------- la ruta al catálogo y el ancla del proceso ----------
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(p);
  const proceso = p.locator("#como-funciona");
  if (!(await proceso.count())) throw new Error("falta la sección #como-funciona que enlaza el menú");
  ok("la sección del proceso existe con su ancla");

  // ---------- un teléfono ----------
  await p.setViewportSize({ width: 390, height: 844 });
  await settled(p);
  await assertNoHorizontalScroll(p, "landing a 390px");
  ok("no hay desplazamiento horizontal a 390px");

  assertQuiet(problems);
  console.log("\nlanding: OK");
} finally {
  await b.close();
}
