/**
 * La ubicación en el mapa: el propietario la marca al publicar y el inquilino ve una zona.
 *
 * Lo que este driver maneja y ningún otro puede: que **el punto exacto no sale del producto**. Un
 * test unitario prueba que `approximateLocation` desafila una coordenada, y las reglas prueban que
 * el documento público no puede llevar `point` — pero solo un navegador puede decir que la página
 * que ve un desconocido no trae, en ninguna parte de su HTML, la coordenada que el propietario
 * marcó. Eso es lo que se afirma abajo, más el ida y vuelta completo: se marca en el mapa, se
 * publica, se lee de Firestore separada en dos documentos y se vuelve a abrir el formulario con el
 * punto donde se dejó.
 *
 * Las teselas se responden desde el propio driver — ver `stubTiles` en `lib.mjs` para el motivo.
 */
import { readFileSync } from "node:fs";

import {
  adminDb,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fixtures,
  hydrated,
  launch,
  ok,
  openSession,
  PHOTOS_INPUT,
  settled,
  stubTiles,
  watch,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

/** Cualquier PNG sirve: lo que se afirma aquí son coordenadas, no dibujos. */
const TILE = readFileSync(PHOTO_1);

/**
 * La coordenada que el formulario dice tener, leída de la propia pantalla.
 *
 * Se lee del producto en lugar de calcularse: una afirmación que recalcula lo que el producto
 * computa es una segunda copia de la regla, y la copia que nadie mira es la del test. Viene en
 * es-CO, con coma decimal, porque así se le muestra a una persona.
 */
async function readoutPoint(page) {
  const text = await page.locator("text=Punto marcado:").first().innerText();
  const [lat, lng] = text
    .replace(/^.*Punto marcado:\s*/s, "")
    .split("·")
    .map((part) => Number(part.trim().replace(",", ".")));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`no se pudo leer el punto de "${text}"`);
  }
  return { lat, lng };
}

/** Metros entre dos puntos. Fórmula geográfica, no una regla del producto. */
function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const email = `map-check-${STAMP}@miarriendodirecto.test`;
const title = `Casa con patio y mapa ${STAMP}`;

const su = await createAccount(API_KEY, email);
if (!su.localId) throw new Error("signUp: " + JSON.stringify(su).slice(0, 200));

const { browser, problems } = await launch();
const step = async (label, fn) => {
  try {
    const extra = await fn();
    ok(label, extra ?? "");
  } catch (e) {
    console.log(`  FALLA ${label}: ${String(e).split("\n")[0].slice(0, 220)}`);
    throw e;
  }
};

let placed = null;
let propertyUrl = "";

try {
  const page = await openSession(browser, { email, name: "Ana Propietaria Pérez", problems });
  await stubTiles(page, TILE);

  await step("el formulario de publicar trae el mapa, sin punto", async () => {
    await page.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
    await settled(page);
    await hydrated(page);

    // El mapa entra por `next/dynamic`: primero el esqueleto, después Leaflet.
    await page.waitForSelector(".leaflet-container", { timeout: 30000 });
    const readout = await page.locator("text=Sin punto en el mapa").count();
    if (readout !== 1) throw new Error(`esperaba un aviso de "sin punto", había ${readout}`);
    return "Leaflet montado y sin punto";
  });

  await step("se llena el anuncio", async () => {
    await page.getByLabel("Título del anuncio").fill(title);
    await page.getByLabel("Descripción").fill(
      "Casa de tres habitaciones con patio, cocina integral y zona de ropas independiente. " +
        "A dos cuadras del parque principal.",
    );
    await page.getByLabel("Área (m²)").fill("120");
    await page.getByLabel("Habitaciones").fill("3");
    await page.getByLabel("Baños").fill("2");
    await page.getByLabel("Parqueadero").click();
    await page.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
    await page.getByLabel("Estrato").click();
    await page.getByRole("option", { name: "Estrato 4" }).click();
    await page.getByLabel("Departamento").click();
    await page.getByRole("option", { name: "Caldas", exact: true }).click();
    await page.getByLabel("Ciudad").click();
    await page.getByRole("option", { name: "Manizales", exact: true }).click();
    await page.getByLabel("Barrio").fill("Palermo");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
    await page.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
    await page.getByLabel("Canon mensual (COP)").fill("2400000");
    await page.getByLabel("Administración (COP)").fill("0");
    await page.setInputFiles(PHOTOS_INPUT, [PHOTO_1, PHOTO_2]);
    await page.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
  });

  await step("por debajo del zoom mínimo el mapa no marca nada", async () => {
    /*
     * El mapa abre en el país. Un paneo ahí no es una ubicación — es un departamento — así que el
     * producto no lo registra y lo dice. Sin esta regla, un propietario que arrastra el mapa sin
     * mirar publica una zona a cien kilómetros de su casa.
     */
    /*
     * Un arrastre corto y relativo al propio mapa. A zoom 6 un pixel son dos kilómetros y medio,
     * así que un arrastre a coordenadas absolutas de la página se lleva la cruz al Pacífico — y
     * entonces lo que falla al publicar es la validación de que el punto esté en Colombia, que es
     * correcta y no es lo que este paso maneja.
     */
    const map = page.locator(".leaflet-container");
    const box = await map.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 8 });
    await page.mouse.up();

    await page.waitForSelector("text=Acerca más el mapa para marcar el inmueble", { timeout: 15000 });
    const marked = await page.locator("text=Punto marcado:").count();
    if (marked !== 0) throw new Error("marcó un punto a zoom de país");
    return "paneo a zoom 6 ignorado, con el motivo en pantalla";
  });

  await step("acercando el mapa se marca el punto", async () => {
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    for (let i = 0; i < 12; i += 1) {
      if ((await page.locator("text=Punto marcado:").count()) > 0) break;
      await zoomIn.click();
      // Se espera la consecuencia, no un tiempo: el zoom de Leaflet está animado y lo que
      // importa es que el producto haya recalculado la lectura.
      await page
        .waitForFunction(
          () => document.body.innerText.includes("Punto marcado:"),
          undefined,
          { timeout: 2000 },
        )
        .catch(() => {});
    }
    placed = await readoutPoint(page);
    return `punto marcado en ${placed.lat}, ${placed.lng}`;
  });

  await step("el teclado mueve el punto: el mapa no necesita ratón", async () => {
    /*
     * Es la única forma de operar un mapa sin ratón, y por eso el punto es el centro con una cruz
     * fija en vez de un marcador arrastrable: un marcador no se puede mover con el teclado y esta
     * es la pantalla donde eso significaría no poder publicar.
     */
    const before = await readoutPoint(page);
    await page.locator(".leaflet-container").focus();
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (previous) => {
        const node = [...document.querySelectorAll("p")].find((p) =>
          p.innerText.includes("Punto marcado:"),
        );
        return Boolean(node) && !node.innerText.includes(previous);
      },
      String(before.lng).replace(".", ","),
      { timeout: 15000 },
    );
    placed = await readoutPoint(page);
    if (placed.lng === before.lng) throw new Error("la longitud no cambió con las flechas");
    return `movido con flechas a ${placed.lat}, ${placed.lng}`;
  });

  await step("publica y el detalle del propietario muestra la zona", async () => {
    await page.getByRole("button", { name: /^Publicar inmueble$/ }).click();
    try {
      await page.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
    } catch (e) {
      const shown = await page.locator('form [role="alert"], form p.text-destructive').allInnerTexts();
      console.log("   errores en pantalla: " + JSON.stringify(shown));
      await page.screenshot({ path: `${SHOT_DIR}/map-publish-falla.png`, fullPage: true });
      throw e;
    }
    await settled(page);

    const href = await page
      .locator("li", { hasText: title })
      .getByRole("link")
      .first()
      .getAttribute("href");
    propertyUrl = new URL(href, page.url()).toString();
    await page.goto(propertyUrl, { waitUntil: "domcontentloaded" });
    await settled(page);

    /*
     * `[data-zone]` es el envoltorio y `.leaflet-container` es el mapa. Esperar solo el primero
     * dejaba pasar un detalle sin mapa: el pie ("El círculo cubre unos 400 metros…") se pinta en
     * el mismo componente, así que la sección se ve completa aunque Leaflet no haya montado.
     */
    await page.waitForSelector("[data-zone] .leaflet-container", { timeout: 30000 });
    // El círculo, que es lo único que se publica de la ubicación.
    await page.waitForSelector("[data-zone] path.stroke-brand-panel", { timeout: 15000 });
    // Al dueño sí se le pinta su punto, y se le dice que es solo suyo.
    await page.waitForSelector("text=El punto que marcaste solo lo ves tú", { timeout: 15000 });
    return propertyUrl.split("/").pop();
  });

  await step("Firestore guarda la coordenada exacta aparte de la publicada", async () => {
    const db = adminDb();
    const snapshot = await db.collection("properties").where("title", "==", title).get();
    if (snapshot.size !== 1) throw new Error(`esperaba un inmueble, hay ${snapshot.size}`);

    const property = snapshot.docs[0];
    const area = property.data().area ?? {};
    if (!area.approx) throw new Error("el documento público no tiene la zona");
    if ("point" in area) throw new Error("el documento público lleva la coordenada exacta");

    const location = (
      await property.ref.collection("private").doc("location").get()
    ).data();
    if (!location?.point) throw new Error("la coordenada exacta no se guardó en private/location");

    // Lo que la pantalla mostró es lo que se guardó: sin esto, el formulario podría estar
    // enseñando una coordenada y enviando otra.
    // Tres metros de tolerancia, y no es holgura: la lectura en pantalla trae cinco decimales
    // (`formatPoint`) y lo guardado seis, así que la diferencia de redondeo llega a ~0,8 m. Sigue
    // atrapando cualquier desajuste real — un par invertido, un valor viejo — que es de lo que va.
    if (metres(location.point, placed) > 3) {
      throw new Error(
        `guardó ${JSON.stringify(location.point)} pero la pantalla decía ${JSON.stringify(placed)}`,
      );
    }
    // Y la publicada es otra, cerca. El radio exacto lo prueba el test unitario del dominio;
    // aquí lo que se afirma es que son dos coordenadas distintas y no una copiada.
    const blur = metres(area.approx, location.point);
    if (blur === 0) throw new Error("la zona publicada es la coordenada exacta");
    if (blur > 1_000) throw new Error(`la zona quedó a ${Math.round(blur)} m del inmueble`);
    return `exacta en private/location, zona a ${Math.round(blur)} m`;
  });

  await step("un desconocido ve la zona y NO la coordenada exacta", async () => {
    const stranger = watch(await (await browser.newContext()).newPage(), "anónimo", problems);
    await stubTiles(stranger, TILE);
    await stranger.goto(propertyUrl, { waitUntil: "domcontentloaded" });
    await settled(stranger);

    await stranger.waitForSelector("[data-zone] .leaflet-container", { timeout: 30000 });
    const zone = await stranger.locator("[data-zone]").first().getAttribute("data-zone");
    const [zoneLat, zoneLng] = zone.split(",").map(Number);
    if (metres({ lat: zoneLat, lng: zoneLng }, placed) === 0) {
      throw new Error("la zona pública es el punto exacto");
    }

    /*
     * La afirmación que solo un navegador puede hacer: el HTML que sale de aquí no contiene la
     * coordenada del inmueble en ninguna forma — ni en el mapa, ni en un `data-`, ni en el
     * payload de RSC que viaja al final del documento.
     */
    const html = await stranger.content();
    for (const value of [placed.lat, placed.lng]) {
      if (html.includes(String(value))) {
        throw new Error(`la página pública contiene la coordenada exacta ${value}`);
      }
    }
    if (await stranger.locator("text=El punto que marcaste solo lo ves tú").count()) {
      throw new Error("a un desconocido se le ofrece el punto del propietario");
    }

    await stranger.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalScroll(stranger, "detalle con mapa a 390px");
    return "sin la coordenada exacta en el HTML, y sin scroll horizontal";
  });

  await step("al editar, el punto vuelve donde se dejó", async () => {
    await page.goto(BASE + "/mis-inmuebles", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.locator("li", { hasText: title }).getByRole("link", { name: /Editar/i }).first().click();
    await page.waitForURL(/\/editar$/, { timeout: 20000 });
    await settled(page);
    await page.waitForSelector(".leaflet-container", { timeout: 30000 });

    const again = await readoutPoint(page);
    if (metres(again, placed) > 3) {
      throw new Error(`el formulario abrió en ${JSON.stringify(again)}, no en ${JSON.stringify(placed)}`);
    }
    return `${again.lat}, ${again.lng}`;
  });

  await step("se puede quitar el punto y el anuncio deja de tener zona", async () => {
    // Quitarlo tiene que limpiar los dos documentos: `area` se reescribe entera y
    // `private/location` se reemplaza, no se fusiona.
    await page.getByRole("button", { name: /Quitar del mapa/i }).click();
    await page.waitForSelector("text=Sin punto en el mapa", { timeout: 15000 });
    await page.getByRole("button", { name: /^Guardar cambios$/ }).click();
    await page.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });

    const db = adminDb();
    const property = (await db.collection("properties").where("title", "==", title).get()).docs[0];
    if (property.data().area?.approx) throw new Error("la zona publicada quedó ahí");
    const location = (await property.ref.collection("private").doc("location").get()).data();
    if (location?.point) throw new Error("la coordenada exacta quedó en private/location");

    await page.goto(propertyUrl, { waitUntil: "domcontentloaded" });
    await settled(page);
    if (await page.locator("[data-zone]").count()) throw new Error("el detalle sigue mostrando mapa");
    // Y la ubicación sigue descrita en palabras, que es lo que había antes del mapa.
    await page.waitForSelector("text=Palermo, Manizales", { timeout: 15000 });
    return "los dos documentos quedaron limpios";
  });

  assertQuiet(problems);
  console.log("map: OK");
} finally {
  await browser.close();
}
