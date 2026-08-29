/**
 * El aviso de arriendo: el inmueble en una hoja para la pared y en un cuadrado para redes.
 *
 * **La afirmación que solo se puede hacer aquí es la del código.** Un aviso es un PNG generado por
 * satori en el servidor: ni un test unitario ni `pnpm build` pueden mirar dentro de él, así que
 * "el QR lleva al anuncio" no es comprobable en ningún otro nivel de la barra. Este driver baja el
 * PNG que de verdad sale de la ruta, lo dibuja en un canvas y lo **decodifica con jsQR** — la misma
 * librería que `shared/qr/qr.test.ts` usa contra la matriz, aquí contra los píxeles. Si el código
 * se dibuja del tamaño equivocado, sin zona de silencio, sobre el panel morado o con la URL de
 * otro anuncio, esto se pone rojo; cualquier otra comprobación del repositorio sigue verde.
 *
 * Lo que el aviso **no** lleva —la dirección, el teléfono del propietario— se afirma en
 * `features/property/domain/poster.test.ts`, sobre el contenido resuelto: de un PNG no se puede
 * leer texto, y una aserción que no puede fallar es peor que ninguna.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  adminDb,
  adminFieldValue,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  ok,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const db = adminDb();
const FieldValue = adminFieldValue();

/* El UMD de jsQR, inyectado en la página: decodificar dentro del navegador evita mover 8,7 M de
   componentes RGBA por el puente de Playwright, que es lo que cuesta un A4 a 150 dpi. */
const JSQR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "node_modules",
  "jsqr",
  "dist",
  "jsQR.js",
);
createRequire(import.meta.url).resolve("jsqr"); // falla aquí, y no dentro del navegador, si falta

const SLUG = `apartamento-del-aviso-${STAMP}-manizales`;
const TITULO = `Apartamento del aviso ${STAMP}`;
const CALLE = `Carrera 23 # 62-${STAMP.slice(-2)}`;

const base = (landlordUid, extra) => ({
  title: TITULO,
  slug: SLUG,
  description: "Apartamento remodelado con vista a la montaña y cocina integral.",
  type: "apartment",
  rent: 1_300_000,
  adminFee: 100_000,
  areaM2: 68,
  bedrooms: 2,
  bathrooms: 1,
  parking: "private",
  stratum: 4,
  furnished: false,
  petsAllowed: true,
  minLeaseMonths: 12,
  availableFrom: "2026-11-01",
  /* Una imagen de verdad servida por el propio servidor: `embedRemoteImage` la baja como lo haría
     con una foto de Cloud Storage, así que la mitad "con foto" de la composición sí se ejerce. */
  photos: [{ path: `properties/${landlordUid}/a.png`, url: `${BASE}/icon.png` }],
  area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
  landlordUid,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  ...extra,
});

const email = `aviso-${STAMP}@miarriendodirecto.test`;
const stranger = `aviso-ajeno-${STAMP}@miarriendodirecto.test`;
const yo = await createAccount(API_KEY, email);
const otro = await createAccount(API_KEY, stranger);

const publicado = await db.collection("properties").add(base(yo.localId, { status: "available" }));
const borrador = await db
  .collection("properties")
  .add(base(yo.localId, { status: "draft", slug: `${SLUG}-borrador`, title: `${TITULO} (borrador)` }));
await db.collection("propertySlugs").doc(SLUG).set({ propertyId: publicado.id });
await db
  .collection("properties")
  .doc(publicado.id)
  .collection("private")
  .doc("location")
  .set({ line: CALLE, registryNumber: "050-123456" });
ok("sembrados un anuncio publicado y un borrador", `${publicado.id} / ${borrador.id}`);

const b = await chromium.launch();
const problemas = [];
/*
 * Permiso de portapapeles: la mitad de redes se comprueba leyendo lo que el botón "Copiar el texto"
 * dejó ahí, igual que `manage-properties` con "Copiar enlace".
 */
const p = await openSession(b, { email, name: "Ana Propietaria Pérez", problems: problemas });
await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });

/** Lo que dice el código de la imagen que hay en `url`, leído de sus píxeles. */
async function decodeQr(page, url) {
  await page.addScriptTag({ path: JSQR });

  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

    return {
      width: canvas.width,
      height: canvas.height,
      text: window.jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null,
    };
  }, url);
}

// ---------- la tarjeta ofrece el aviso, y solo del anuncio publicado ----------
await p.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);

const tarjetaPublicada = p.locator("li", { hasText: TITULO }).filter({ hasNotText: "(borrador)" });
const tarjetaBorrador = p.locator("li", { hasText: `${TITULO} (borrador)` });

/*
 * `exact: true`, y no es cosmético: sin él `name: "Aviso"` es una subcadena sin distinguir
 * mayúsculas, así que el enlace del **título** —"Apartamento del aviso …"— también entraba y la
 * cuenta daba 2. Es el mismo tropiezo que `pagination` con un anuncio cuyo nombre llevaba un "2".
 */
const avisoDe = (tarjeta) => tarjeta.getByRole("link", { name: "Aviso", exact: true });

if ((await avisoDe(tarjetaPublicada).count()) !== 1) {
  console.log("DEBUG body:", (await p.evaluate(() => document.body.innerText)).slice(0, 800));
  console.log("DEBUG links:", await p.getByRole("link").allInnerTexts());
  console.log("DEBUG count aviso:", await tarjetaPublicada.getByRole("link", { name: "Aviso" }).count());
  console.log("DEBUG count text:", await tarjetaPublicada.locator("a", { hasText: "Aviso" }).count());
  console.log("DEBUG names:", await tarjetaPublicada.getByRole("link").evaluateAll((els) => els.map((e) => [e.tagName, e.getAttribute("aria-label"), e.textContent])));
  throw new Error("el anuncio publicado no ofrece el aviso");
}
/*
 * Las dos caras, y la segunda es la que importa: la primera pasaría igual con el botón siempre
 * visible. Un QR impreso desde un borrador abre un 404 para todo el que lo escanee y sigue
 * funcionando para su dueño, que es justo por lo que no puede ofrecerse.
 */
if ((await avisoDe(tarjetaBorrador).count()) !== 0) {
  throw new Error("un borrador está ofreciendo un aviso cuyo código no lleva a ninguna parte");
}
ok("la tarjeta ofrece el aviso del publicado y no el del borrador");

// ---------- la pantalla ----------
await avisoDe(tarjetaPublicada).click();
await p.waitForURL(/\/aviso$/, { timeout: 20000 });
await settled(p);
if (!(await p.textContent("body")).includes("no lleva la dirección")) {
  throw new Error("falta la frase que dice qué NO lleva el aviso");
}
await p.waitForSelector('img[alt="Vista previa del aviso"]', { timeout: 30000 });
ok("la pantalla del aviso abre con la vista previa", p.url().replace(BASE, ""));

// ---------- mientras se genera ----------
/*
 * Cada aviso es una lectura de Firestore, la descarga de una foto y un PNG compuesto por satori: no
 * es instantáneo, y sin estado de carga la caja se queda vacía sin decir nada. Se comprueba
 * frenando la respuesta a propósito, que es la única forma de que un estado transitorio esté el
 * tiempo suficiente para afirmar algo sobre él.
 *
 * Y la mitad que de verdad importa es el botón: `window.print()` imprime el documento tal como está,
 * así que pulsarlo un segundo antes de tiempo manda **una hoja en blanco** a la impresora. Es el
 * mismo folio vacío que producía el `[hidden]`, llegando por otro camino — y este no lo ve nadie
 * hasta la bandeja.
 */
const LENTO = "**/aviso/pared";
await p.route(LENTO, async (route) => {
  await new Promise((listo) => setTimeout(listo, 2500));
  await route.continue();
});
await p.reload({ waitUntil: "domcontentloaded" });
await settled(p);

if (!(await p.getByText("Preparando el aviso").isVisible())) {
  throw new Error("la caja del aviso se queda vacía mientras se genera");
}
const esperando = p.getByRole("button", { name: /Preparando/ });
if (!(await esperando.isDisabled())) {
  throw new Error("se puede imprimir antes de que exista la hoja: saldría en blanco");
}
if ((await p.getByRole("button", { name: /^Imprimir$/ }).count()) !== 0) {
  throw new Error("ofrece Imprimir mientras el aviso todavía se está generando");
}
ok("mientras se genera: esqueleto en la caja e Imprimir bloqueado");

await p.getByRole("button", { name: /^Imprimir$/ }).waitFor({ timeout: 30000 });
if (await p.getByText("Preparando el aviso").isVisible()) {
  throw new Error("el esqueleto se queda puesto sobre un aviso que ya llegó");
}
ok("y cuando llega, el esqueleto se va e Imprimir se habilita");

// ---------- y si no se puede generar, lo dice ----------
/*
 * Un marcador que no se resuelve nunca no se distingue de una página rota. La ruta se corta a
 * propósito, que es lo que hace una foto borrada o un Cloud Storage caído.
 */
await p.unroute(LENTO);
/*
 * Cortar la petición hace que el navegador escriba `net::ERR_FAILED` en la consola, y eso lo provoca
 * este driver, no el producto. Se quitan **solo esas** líneas y solo las de esta ventana: dejar
 * `assertQuiet` mirando para otro lado durante medio driver es cómo se cuela un error de verdad.
 */
const antesDelCorte = problemas.length;
await p.route(LENTO, (route) => route.abort());
await p.reload({ waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("text=No pudimos generar el aviso", { timeout: 20000 });
ok("un aviso que no se pudo generar lo dice, en vez de quedarse en esqueleto");
await p.unroute(LENTO);

const delCorte = problemas.splice(antesDelCorte);
const inesperados = delCorte.filter((linea) => !/Failed to load resource: net::ERR_FAILED/.test(linea));
if (inesperados.length > 0) {
  throw new Error("errores de consola que no son el corte deliberado: " + JSON.stringify(inesperados));
}
if (delCorte.length === 0) {
  throw new Error("el corte no llegó al navegador: la aserción del fallo no probó nada");
}
ok("y el único ruido en consola es el corte que provocó esta prueba", `${delCorte.length} línea(s)`);
await p.reload({ waitUntil: "domcontentloaded" });
await settled(p);
await p.getByRole("button", { name: /^Imprimir$/ }).waitFor({ timeout: 30000 });

// ---------- el PNG que se imprime ----------
const wallUrl = `${BASE}/mis-inmuebles/${publicado.id}/aviso/pared`;
const socialUrl = `${BASE}/mis-inmuebles/${publicado.id}/aviso/redes`;

const wall = await p.request.get(wallUrl);
if (wall.status() !== 200) throw new Error(`el aviso para la pared respondió ${wall.status()}`);
if (!(wall.headers()["content-type"] ?? "").startsWith("image/png")) {
  throw new Error(`el aviso no es un PNG: ${wall.headers()["content-type"]}`);
}
/* Se pide explícitamente que no se guarde: la respuesta depende de quién pregunta. */
if (!(wall.headers()["cache-control"] ?? "").includes("no-store")) {
  throw new Error(`el aviso es cacheable: ${wall.headers()["cache-control"]}`);
}
/* Los dos avisos quedan guardados al lado de las capturas: es la única forma de *mirar* lo que
   este driver comprueba, y una composición de satori no se revisa en un diff. */
writeFileSync(`${SHOT_DIR}/aviso-pared.png`, await wall.body());
writeFileSync(`${SHOT_DIR}/aviso-redes.png`, await (await p.request.get(socialUrl)).body());
ok("la ruta de la pared devuelve un PNG privado", `${(await wall.body()).byteLength} bytes`);

// ---------- y su código lleva al anuncio ----------
const impreso = await decodeQr(p, wallUrl);
if (impreso.width !== 1240 || impreso.height !== 1754) {
  throw new Error(`el aviso para la pared mide ${impreso.width}×${impreso.height}, no A4 a 150 dpi`);
}
if (!impreso.text) throw new Error("el código del aviso impreso no se pudo leer");

/* El slug lo puso este driver al sembrar, así que compararlo no duplica ninguna regla del
   producto: es exactamente el anuncio que se pidió que el código abriera. */
const rutaPublica = `/inmuebles/${SLUG}`;
const leida = new URL(impreso.text);
if (leida.pathname !== rutaPublica) {
  throw new Error(`el código lleva a ${leida.pathname}, y el anuncio está en ${rutaPublica}`);
}
/*
 * **Y a la dirección canónica, no a la del servidor que lo generó.** Un enlace de un correo tiene
 * que llegar a donde está la persona ahora; uno impreso en papel tiene que funcionar dentro de
 * ocho meses, desde el teléfono de un desconocido, cuando el despliegue que lo generó ya no existe.
 * Esta aserción se pone roja el día que alguien cambie `metadataOrigin()` por `resolveSiteUrl()`.
 */
if (leida.origin === BASE || leida.hostname === "localhost") {
  throw new Error(`el código impreso apunta al servidor que lo generó (${leida.origin})`);
}
ok("el QR del aviso impreso decodifica al anuncio", impreso.text);

// ---------- y el cuadrado NO lleva código ----------
/*
 * **La afirmación al revés, y es la que sostiene la decisión.** Un cuadrado se mira en el mismo
 * celular que tendría que escanearlo, y un celular no se escanea a sí mismo: el código ahí era un
 * cuarto de la composición sin hacer nada. Se comprueba sobre los píxeles, con el mismo lector que
 * acaba de leer el del papel — así que un `null` aquí significa "no hay código", no "el lector no
 * funciona en este driver".
 */
const cuadrado = await decodeQr(p, socialUrl);
if (cuadrado.width !== 1080 || cuadrado.height !== 1080) {
  throw new Error(`el aviso de redes mide ${cuadrado.width}×${cuadrado.height}`);
}
if (cuadrado.text !== null) {
  throw new Error(`el aviso de redes lleva un código QR que nadie puede escanear: ${cuadrado.text}`);
}
ok("el aviso de redes no lleva código, que es de lo que se trata");

// ---------- lo que sí lleva al anuncio en redes es el texto ----------
/*
 * Y tiene que llevar **al mismo sitio** que el código del papel. Son los dos únicos caminos que
 * este producto imprime hacia un anuncio, y que se separaran sería la clase de fallo que solo se
 * nota cuando alguien no llega.
 */
await p.getByRole("radio", { name: /Para redes/ }).check();
/*
 * **Esperar el cuadrado, no el `<img>`.** El elemento no se desmonta al cambiar de formato, solo le
 * cambia el `src`, así que un `waitForSelector` sobre él resuelve al instante y deja al driver
 * mirando la pantalla anterior a medio transicionar. Esto costó dos capturas engañosas y un rato
 * persiguiendo un bug de estilos que no existía. Lo que sí dice que el cambio ocurrió es el tamaño
 * natural de la imagen que llegó — y de paso afirma que el selector y la vista previa hablan del
 * mismo formato, que es lo único que un radio marcado tiene que garantizar.
 */
await p.waitForFunction(() => {
  const img = document.querySelector('img[alt="Vista previa del aviso"]');
  return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalWidth === img.naturalHeight);
}, null, { timeout: 30000 });
ok("elegir «Para redes» cambia la vista previa al cuadrado");
await p.screenshot({ path: `${SHOT_DIR}/aviso-redes-pantalla.png`, fullPage: true });
await p.getByRole("button", { name: /Copiar el texto/i }).click();
await p.waitForSelector("text=Texto copiado", { timeout: 5000 });
const leyenda = await p.evaluate(() => navigator.clipboard.readText());
if (!leyenda.includes(impreso.text)) {
  throw new Error(`el texto para redes no lleva el enlace del anuncio: ${JSON.stringify(leyenda)}`);
}
if (!leyenda.includes("Palermo, Manizales")) {
  throw new Error(`el texto para redes no dice dónde está: ${JSON.stringify(leyenda)}`);
}
/* Y no lleva la calle, que es la mitad del motivo por el que el aviso está hecho así. */
if (leyenda.includes(CALLE)) throw new Error("¡FUGA! el texto para redes lleva la dirección");
ok("el texto de redes lleva el mismo enlace que el código impreso", leyenda.split("\n").pop());

await p.screenshot({ path: `${SHOT_DIR}/aviso.png`, fullPage: true });

// ---------- lo que sale por la impresora ----------
/*
 * `page.pdf()` es el mismo pipeline que el diálogo de impresión de Chromium, así que es la única
 * forma de comprobar la regla de `@media print` — y la que importa es que salga **una** hoja. El
 * modo obvio de fallar aquí no es que la hoja salga mal: es que salga bien y detrás vayan tres
 * páginas en blanco con el hueco que dejó el resto de la pantalla, que es exactamente lo que pasa
 * si se oculta con `visibility` en vez de con `display`. Nadie mira eso hasta que hay papel de por
 * medio.
 */
await p.waitForFunction(() => {
  const sheet = document.querySelector("[data-print-sheet] img");
  return Boolean(sheet && sheet.complete && sheet.naturalWidth > 0);
}, null, { timeout: 30000 });
const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
writeFileSync(`${SHOT_DIR}/aviso-impreso.pdf`, pdf);
const crudo = pdf.toString("latin1");
const paginas = (crudo.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
if (paginas !== 1) throw new Error(`el aviso se imprime en ${paginas} páginas, no en una`);
/*
 * **Y que en esa hoja haya algo.** Contar páginas sola es una aserción que pasa sobre una hoja en
 * blanco, y eso es exactamente lo que estuvo saliendo por la impresora: el `hidden` del portal lo
 * ganaba el `[hidden]{display:none!important}` de Tailwind, porque para las declaraciones
 * `!important` el orden de capas se invierte. El PDF medía 1.112 bytes, tenía su A4 correcto y no
 * llevaba nada dentro. Un XObject de imagen es lo que distingue las dos cosas.
 */
if (!/\/Subtype\s*\/Image/.test(crudo)) {
  throw new Error(`el aviso se imprime en una hoja en blanco: ${pdf.byteLength} bytes, sin imagen`);
}
ok("se imprime en una sola hoja A4, con el aviso dentro", `${pdf.byteLength} bytes`);

// ---------- un borrador se explica, y su PNG no existe ----------
await p.goto(`${BASE}/mis-inmuebles/${borrador.id}/aviso`, { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.textContent("body")).includes("Publica el inmueble primero")) {
  throw new Error("el borrador no explica por qué no hay aviso");
}
const borradorPng = await p.request.get(`${BASE}/mis-inmuebles/${borrador.id}/aviso/pared`);
if (borradorPng.status() !== 404) {
  throw new Error(`el PNG de un borrador respondió ${borradorPng.status()}, y una pantalla no protege un endpoint`);
}
ok("un borrador se explica en pantalla y no tiene PNG");

// ---------- un formato inventado no existe ----------
const formatoRaro = await p.request.get(`${BASE}/mis-inmuebles/${publicado.id}/aviso/historia`);
if (formatoRaro.status() !== 404) throw new Error(`un formato inventado respondió ${formatoRaro.status()}`);
ok("un formato que no existe responde 404");

// ---------- 390 px ----------
await p.setViewportSize({ width: 390, height: 780 });
await p.goto(`${BASE}/mis-inmuebles/${publicado.id}/aviso`, { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector('img[alt="Vista previa del aviso"]', { timeout: 30000 });
await assertNoHorizontalScroll(p, "el aviso en 390px");
await p.screenshot({ path: `${SHOT_DIR}/aviso-movil.png`, fullPage: true });
ok("cabe en 390px sin scroll horizontal");

// ---------- otro propietario no ve nada de esto ----------
const ajeno = await openSession(b, {
  email: stranger,
  name: "Beto Ajeno Gómez",
  problems: problemas,
  viewport: { width: 1280, height: 900 },
});
await ajeno.goto(`${BASE}/mis-inmuebles/${publicado.id}/aviso`, { waitUntil: "domcontentloaded" });
await settled(ajeno);
const recibido = (await ajeno.evaluate(() => document.body.innerText)).trim();
await ajeno.goto(`${BASE}/mis-inmuebles/estoNoExisteJamas/aviso`, { waitUntil: "domcontentloaded" });
await settled(ajeno);
const inventado = (await ajeno.evaluate(() => document.body.innerText)).trim();
if (recibido.includes(TITULO)) throw new Error("¡FUGA! otro propietario ve el anuncio ajeno");
/*
 * La propiedad que importa no es "sale un 404": es que un inmueble ajeno y uno que no existe den
 * **la misma** respuesta, que es lo que hace `getOwnedProperty` al contestar `null` a los dos.
 */
if (recibido !== inventado) {
  throw new Error("un inmueble ajeno se distingue de uno inexistente");
}
const robado = await ajeno.request.get(wallUrl);
if (robado.status() !== 404) {
  throw new Error(`otro propietario descargó el PNG ajeno con ${robado.status()}`);
}
ok("un propietario ajeno recibe 404 en la pantalla y en el PNG", `uid ${otro.localId.slice(0, 6)}…`);

assertQuiet(problemas);
await b.close();

// ---------- limpieza ----------
await db.collection("properties").doc(publicado.id).collection("private").doc("location").delete();
await db.collection("properties").doc(publicado.id).delete();
await db.collection("properties").doc(borrador.id).delete();
await db.collection("propertySlugs").doc(SLUG).delete();
ok("datos de prueba borrados");
