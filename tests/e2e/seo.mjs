/**
 * Lo que este producto le dice a un buscador y a quien pega un enlace en un chat.
 *
 * Las dos mitades del sitio tienen respuestas opuestas y las dos se manejan aquí: el catálogo y el
 * detalle de un inmueble existen para encontrarse y compartirse; el portal de gestión es el espacio
 * privado de dos personas con nombre y no lleva SEO ninguno.
 *
 * Lo que se afirma es la **consecuencia**, no que un `<meta>` esté puesto: que `/robots.txt` y
 * `/sitemap.xml` respondan y digan cosas coherentes entre sí, que el JSON-LD *parsee* y describa el
 * anuncio que se está mirando, que la tarjeta de Open Graph de un anuncio sea distinta de la
 * genérica —o sea, que de verdad se generó con sus datos— y que una página del portal se anuncie
 * `noindex` estando dentro, que es el único momento en que se puede leer.
 */
import { chromium } from "playwright";

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

const TITULO = `Apartamento con vista SEO ${STAMP}`;
const SLUG = `apartamento-con-vista-seo-${STAMP}-manizales`;
const CIUDAD = "Manizales";
const BARRIO = "Palermo";
const CALLE = `Calle 55 # 23-${STAMP.slice(-2)}`;

// ---------- un anuncio publicado, con su dirección privada ----------
const anuncio = await db.collection("properties").add({
  title: TITULO,
  slug: SLUG,
  description: "Hola, les presento este hermoso apartamento remodelado con vista a la montaña.",
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
  status: "available",
  photos: [],
  area: { neighborhood: BARRIO, city: CIUDAD, department: "Caldas" },
  landlordUid: `seo-landlord-${STAMP}`,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
await db.collection("propertySlugs").doc(SLUG).set({ propertyId: anuncio.id });
// La calle vive fuera del documento público, que es de lo que depende media afirmación de aquí.
await db
  .collection("properties")
  .doc(anuncio.id)
  .collection("private")
  .doc("location")
  .set({ line: CALLE, registryNumber: "050-123456" });
ok("anuncio publicado para la prueba", SLUG);

const b = await chromium.launch();
const contexto = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await contexto.newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push("pageerror: " + e.message));

/** Todo el JSON-LD de la página, ya parseado. Si uno no parsea, no sirve para nada. */
async function structuredData(page) {
  const bloques = await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((node) => node.textContent ?? ""),
  );
  if (bloques.length === 0) throw new Error("la página no trae ningún bloque de datos estructurados");

  return bloques.map((raw, index) => {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`el bloque ${index} de JSON-LD no parsea: ${String(error)}`);
    }
  });
}

const meta = (page, selector) =>
  page.$eval(selector, (node) => node.getAttribute("content") ?? "").catch(() => null);

// ---------- robots.txt ----------
{
  const respuesta = await p.request.get(`${BASE}/robots.txt`);
  if (respuesta.status() !== 200) throw new Error(`robots.txt respondió ${respuesta.status()}`);
  const texto = await respuesta.text();

  if (!/Allow: \//.test(texto)) throw new Error("robots.txt no permite nada");
  for (const privado of ["/contratos", "/arriendos", "/mis-inmuebles", "/inicio", "/api/"]) {
    if (!texto.includes(`Disallow: ${privado}`)) {
      throw new Error(`robots.txt no aparta el portal: falta ${privado}`);
    }
  }
  /* Y no aparta lo que existe para encontrarse: un `Disallow: /inmuebles` sería el catálogo entero. */
  if (/Disallow: \/inmuebles\s*$/m.test(texto)) throw new Error("robots.txt aparta el catálogo");
  if (!/Sitemap: https?:\/\/\S+\/sitemap\.xml/.test(texto)) {
    throw new Error("robots.txt no dice dónde está el sitemap");
  }
  ok("robots.txt abre lo público, aparta el portal y nombra el sitemap");
}

// ---------- sitemap.xml ----------
{
  const respuesta = await p.request.get(`${BASE}/sitemap.xml`);
  if (respuesta.status() !== 200) throw new Error(`sitemap.xml respondió ${respuesta.status()}`);
  const xml = await respuesta.text();

  if (!xml.includes("/inmuebles</loc>")) throw new Error("el sitemap no lista el catálogo");
  /*
   * El anuncio que **esta corrida** acaba de publicar. Contar URLs no diría nada sobre un catálogo
   * en el que otros drivers también escriben; que esté este sí.
   */
  if (!xml.includes(`/inmuebles/${SLUG}</loc>`)) {
    throw new Error("el sitemap no lista el anuncio recién publicado");
  }
  if (!xml.includes(`city=${encodeURIComponent(CIUDAD)}`)) {
    throw new Error("el sitemap no lista la ciudad que sí tiene inmuebles");
  }
  /* Un sitemap es una lista de páginas que se piden indexar: el portal no puede estar en ella. */
  for (const privado of ["/contratos", "/arriendos", "/mis-inmuebles", "/inicio", "/perfil-inquilino"]) {
    if (xml.includes(`${privado}<`) || xml.includes(`${privado}/`)) {
      throw new Error(`el sitemap pide indexar el portal: ${privado}`);
    }
  }
  ok("el sitemap lista lo público, el anuncio nuevo y su ciudad, y nada del portal");
}

// ---------- el detalle de un anuncio ----------
await p.goto(`${BASE}/inmuebles/${SLUG}`, { waitUntil: "domcontentloaded" });
await settled(p);

{
  const titulo = await p.title();
  /*
   * **El título es la ficha, no el titular del propietario.** Lo que se comparte en un grupo de
   * WhatsApp tiene que poder compararse con los otros cinco enlaces del grupo, y "hermoso
   * apartamento remodelado" no se compara con nada.
   */
  if (!titulo.includes("Apartamento en arriendo")) throw new Error(`el título no es la ficha: ${titulo}`);
  if (!titulo.includes(CIUDAD)) throw new Error(`el título no dice la ciudad: ${titulo}`);
  if (!/1\.400\.000/.test(titulo)) throw new Error(`el título no dice el precio total: ${titulo}`);
  // El canon es arriendo + administración: publicar solo el arriendo es la sorpresa del final.
  if (titulo.includes("1.300.000")) throw new Error("el título publica el arriendo sin administración");
  ok("el título del anuncio es la ficha: qué, dónde y cuánto", titulo);

  const descripcion = await meta(p, 'meta[name="description"]');
  if (!descripcion) throw new Error("el anuncio no trae descripción");
  if (descripcion.length > 165) throw new Error(`la descripción no cabe: ${descripcion.length}`);
  if (descripcion.startsWith("Hola")) throw new Error("la descripción es el texto del propietario");
  for (const dato of ["68 m²", "2 habitaciones", "1 baño"]) {
    if (!descripcion.includes(dato)) throw new Error(`la descripción no dice "${dato}"`);
  }
  ok("y la descripción trae los datos con los que se compara", `${descripcion.length} caracteres`);

  const canonical = await p.$eval('link[rel="canonical"]', (n) => n.getAttribute("href") ?? "");
  if (!canonical.endsWith(`/inmuebles/${SLUG}`)) throw new Error(`canonical raro: ${canonical}`);
  if (!canonical.startsWith("http")) throw new Error("el canonical no es absoluto");
  ok("el canonical es absoluto y apunta a su propia URL");
}

{
  const bloques = await structuredData(p);
  const anunciado = bloques.find((bloque) => bloque["@type"] === "RealEstateListing");
  if (!anunciado) throw new Error("el anuncio no se describe como RealEstateListing");

  if (anunciado.about?.["@type"] !== "Apartment") throw new Error("no dice que sea un apartamento");
  if (anunciado.about?.numberOfRooms !== 2) throw new Error("no dice cuántas habitaciones tiene");
  if (anunciado.offers?.price !== 1_400_000) throw new Error("el precio estructurado no es el canon");
  if (anunciado.offers?.priceCurrency !== "COP") throw new Error("el precio no está en pesos");
  // Arrendar, no vender: sin esto se lee como el precio de compra del inmueble.
  if (anunciado.offers?.businessFunction !== "https://schema.org/LeaseOut") {
    throw new Error("la oferta no dice que es un arriendo");
  }
  if (anunciado.about?.address?.addressLocality !== CIUDAD) throw new Error("no publica la ciudad");
  ok("el JSON-LD del anuncio parsea y describe un arriendo, no una venta");

  const rastro = bloques.find((bloque) => bloque["@type"] === "BreadcrumbList");
  if (!rastro) throw new Error("el anuncio no trae rastro de migas");
  if (rastro.itemListElement?.length !== 3) throw new Error("el rastro no tiene tres pasos");
  if (!String(rastro.itemListElement[1]?.item).includes(`city=${CIUDAD}`)) {
    throw new Error("el segundo paso del rastro no es la ciudad");
  }
  ok("y el rastro de migas es el mismo camino que la página ofrece");
}

{
  /*
   * **La afirmación de privacidad, en el HTML que recibe un desconocido.** `map.mjs` prueba que la
   * coordenada exacta no sale; esto prueba lo otro que vive en `private/location`: la calle. Los
   * datos estructurados son el sitio más fácil por donde se escapa, porque un `<script>` no se
   * revisa mirando una página.
   */
  const html = await p.content();
  if (html.includes(CALLE)) throw new Error("la calle del inmueble está en el HTML público");
  if (html.includes("050-123456")) throw new Error("la matrícula inmobiliaria está en el HTML público");
  if (/"geo"|latitude/.test(html)) throw new Error("el HTML público trae una coordenada estructurada");
  ok("ni la calle, ni la matrícula, ni una coordenada en lo que ve un desconocido");
}

// ---------- la tarjeta que se comparte ----------
{
  const imagen = await meta(p, 'meta[property="og:image"]');
  if (!imagen) throw new Error("el anuncio no ofrece imagen para compartir");

  const respuesta = await p.request.get(imagen);
  if (respuesta.status() !== 200) throw new Error(`la tarjeta respondió ${respuesta.status()}`);
  if (!(respuesta.headers()["content-type"] ?? "").includes("image/png")) {
    throw new Error("la tarjeta no es un PNG");
  }
  const bytes = (await respuesta.body()).length;
  if (bytes < 5_000) throw new Error(`la tarjeta pesa ${bytes} bytes: está vacía`);

  const alto = await meta(p, 'meta[property="og:image:height"]');
  const ancho = await meta(p, 'meta[property="og:image:width"]');
  if (ancho !== "1200" || alto !== "630") throw new Error(`la tarjeta mide ${ancho}×${alto}`);
  /*
   * Y **es la de este anuncio**, no la genérica de la marca. Se compara con la del sitio: si un día
   * la ruta dejara de resolver el inmueble y cayera al respaldo, los dos PNG serían idénticos y
   * todo lo de arriba seguiría pasando.
   */
  const generica = await p.request.get(`${BASE}/opengraph-image`);
  const mismos = (await generica.body()).equals(await respuesta.body());
  if (mismos) throw new Error("la tarjeta del anuncio es la genérica del sitio");
  ok("la tarjeta del anuncio es un PNG de 1200×630 propio", `${Math.round(bytes / 1024)} KB`);

  const alt = await meta(p, 'meta[property="og:image:alt"]');
  if (!alt || !alt.includes(CIUDAD)) throw new Error(`la tarjeta no se describe: ${alt}`);
  ok("y se describe para quien no puede verla", alt);
}

// ---------- el catálogo ----------
await p.goto(`${BASE}/inmuebles?city=${encodeURIComponent(CIUDAD)}`, { waitUntil: "domcontentloaded" });
await settled(p);

{
  const titulo = await p.title();
  if (!titulo.includes(`Arriendos en ${CIUDAD}`)) throw new Error(`el catálogo no nombra la ciudad: ${titulo}`);

  const canonical = await p.$eval('link[rel="canonical"]', (n) => n.getAttribute("href") ?? "");
  if (!canonical.includes(`city=${encodeURIComponent(CIUDAD)}`)) {
    throw new Error(`el canonical del catálogo pierde la ciudad: ${canonical}`);
  }
  ok("el catálogo filtrado se titula y se canoniza por su ciudad", titulo);

  const [coleccion] = await structuredData(p);
  if (coleccion["@type"] !== "CollectionPage") throw new Error("el catálogo no se describe como colección");
  const lista = coleccion.mainEntity;
  if (lista?.["@type"] !== "ItemList") throw new Error("la colección no trae una lista");
  if (!Array.isArray(lista.itemListElement) || lista.itemListElement.length === 0) {
    throw new Error("la lista viene vacía en una ciudad con inmuebles");
  }
  const mio = lista.itemListElement.find((entrada) => String(entrada.url).endsWith(SLUG));
  if (!mio) throw new Error("la lista no incluye el anuncio de esta corrida");
  if (mio.position < 1) throw new Error("las posiciones no cuentan desde uno");
  ok("y su JSON-LD lista los anuncios de la página con enlaces absolutos", `posición ${mio.position}`);
}

{
  /* Los filtros que no son la ciudad se acreditan a la ciudad: no son páginas aparte. */
  await p.goto(`${BASE}/inmuebles?city=${encodeURIComponent(CIUDAD)}&bedrooms=2&sort=price-asc`, {
    waitUntil: "domcontentloaded",
  });
  await settled(p);
  const canonical = await p.$eval('link[rel="canonical"]', (n) => n.getAttribute("href") ?? "");
  if (canonical.includes("bedrooms") || canonical.includes("sort")) {
    throw new Error(`una faceta se canoniza como página propia: ${canonical}`);
  }
  /*
   * Y **no lleva `noindex`**: un `noindex` junto a un canonical que apunta a otra URL son dos
   * instrucciones que se contradicen, y la respuesta documentada de Google al par es no hacer caso
   * de ninguna. El canonical solo es la instrucción entera.
   */
  const robots = await meta(p, 'meta[name="robots"]');
  if (robots && /noindex/.test(robots)) throw new Error("la faceta se marca noindex junto a un canonical");
  ok("una faceta se acredita a la ciudad, sin contradecirse con un noindex");
}

await p.screenshot({ path: `${SHOT_DIR}/seo-catalogo.png`, fullPage: false }).catch(() => undefined);
await p.setViewportSize({ width: 390, height: 844 });
await settled(p);
await assertNoHorizontalScroll(p, "el catálogo a 390px");
ok("390px sin scroll horizontal");

// ---------- el portal no lleva SEO ----------
{
  /*
   * Solo se puede leer estando dentro: sin sesión estas páginas responden una redirección al login,
   * así que un rastreador nunca ve su contenido — que es la otra mitad de la respuesta. El `noindex`
   * es lo que cubre el caso de que alguna llegue a ser alcanzable sin ella.
   */
  const email = `seo-${STAMP}@miarriendodirecto.test`;
  await createAccount(API_KEY, email);
  const dentro = await openSession(b, { email, name: "Ana Propietaria Pérez", problems: problemas });

  for (const ruta of ["/inicio", "/contratos", "/arriendos", "/mis-inmuebles", "/perfil-inquilino"]) {
    await dentro.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
    await settled(dentro);
    const robots = await meta(dentro, 'meta[name="robots"]');
    if (!robots || !/noindex/.test(robots)) {
      throw new Error(`${ruta} no se anuncia noindex: ${robots}`);
    }
    if (!/nofollow/.test(robots)) throw new Error(`${ruta} deja seguir sus enlaces: ${robots}`);
  }
  ok("cada pantalla del portal se anuncia noindex, nofollow");

  /* Y el catálogo sigue abierto para quien tiene sesión: no es lo mismo privado que oculto. */
  await dentro.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
  await settled(dentro);
  const robots = await meta(dentro, 'meta[name="robots"]');
  if (robots && /noindex/.test(robots)) throw new Error("el catálogo se marca noindex");
  ok("y el catálogo no hereda nada de eso");
}

// ---------- limpieza ----------
await db.collection("properties").doc(anuncio.id).collection("private").doc("location").delete();
await db.collection("properties").doc(anuncio.id).delete();
await db.collection("propertySlugs").doc(SLUG).delete();
ok("datos de prueba borrados");

assertQuiet(problemas);
await b.close();
