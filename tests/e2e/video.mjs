/**
 * El video del inmueble: subirlo, verlo en el anuncio público, y quitarlo.
 *
 * Lo que este driver afirma y no puede afirmar ningún test unitario:
 *
 * - que el control **está en el formulario** (se reportó desde la pantalla que no aparecía);
 * - que el `<video>` de la página pública sale con `preload="none"` y con la foto de portada como
 *   `poster` — la decisión de rendimiento entera del reproductor, invisible para `typecheck`,
 *   `lint`, `build` y cualquier prueba de esquema;
 * - que **no lleva `autoplay`**, que es lo que haría que un anuncio empiece a sonar solo y a
 *   gastarle los datos a quien lo abre;
 * - que la tarjeta del catálogo anuncia el video sin reproducirlo ahí;
 * - y que quitarlo lo quita **de verdad**: `batch.update` sin `FieldValue.delete()` conserva el
 *   campo, así que el video seguiría en la página pública después de guardar el formulario. Es el
 *   fallo más fácil de escribir en toda la feature y el único sitio donde se ve.
 *
 * El tamaño máximo no se maneja aquí a propósito: escribir 51 MB en disco por cada corrida cuesta
 * más que lo que prueba, y el límite ya tiene su caso en `property.test.ts`, en los dos lados de
 * la frontera. Lo que sí se maneja es el **tipo**, que es barato: `setInputFiles` no respeta el
 * `accept` del input, así que se le puede meter un PNG y comprobar el mensaje.
 */
import { readFileSync } from "node:fs";
import {
  assertNoHorizontalScroll,
  assertQuiet,
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
  TEST_DOMAIN,
  VIDEO_INPUT,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2, video: VIDEO } = fixtures();

const email = `video-${STAMP}${TEST_DOMAIN}`;
const TITLE = `Casa con recorrido en video ${STAMP}`;

await createAccount(API_KEY, email);

const { browser, problems } = await launch();
let detailUrl = "";

try {
  const page = await openSession(browser, { email, name: "Ana Propietaria Pérez", problems });
  // El formulario monta un mapa: las teselas se responden aquí, no en los servidores de OSM.
  await stubTiles(page, readFileSync(PHOTO_1));

  await page.goto(new URL("/inmuebles/publicar", page.url()).toString(), {
    waitUntil: "domcontentloaded",
  });
  await settled(page);
  await hydrated(page);

  // ── el control existe ──────────────────────────────────────────────────────────────────────
  {
    const label = await page.getByText("Video del inmueble").first().isVisible();
    if (!label) throw new Error("el formulario no ofrece la sección del video");
    if ((await page.locator(VIDEO_INPUT).count()) !== 1) {
      throw new Error("no hay exactamente un input de video en el formulario");
    }
    // Opcional, y tiene que decirlo: publicar no lo exige y un asterisco implícito haría que
    // alguien sin video creyera que le falta algo.
    const optional = await page.getByText("Opcional").first().isVisible();
    if (!optional) throw new Error("el video no se anuncia como opcional");
    ok("el formulario ofrece subir un video, marcado como opcional");
  }

  // ── el tipo se rechaza en el navegador, con el motivo que dice qué hacer ───────────────────
  {
    await page.setInputFiles(VIDEO_INPUT, [PHOTO_1]);
    // El mensaje nombra los tres contenedores: "no pudimos subir el video" no diría qué hacer.
    await page.waitForSelector("text=Solo MP4, MOV o WEBM.", { timeout: 15000 });
    if ((await page.locator("video").count()) !== 0) {
      throw new Error("un archivo rechazado dejó una vista previa");
    }
    ok("un PNG en el campo del video se rechaza nombrando los formatos");
  }

  // ── se llena el formulario y se suben las fotos y el video ─────────────────────────────────
  {
    await page.getByLabel("Título del anuncio").fill(TITLE);
    await page.getByLabel("Descripción").fill(
      "Casa de dos pisos con patio, cocina integral y zona de ropas independiente. " +
        "El recorrido en video muestra cómo se conectan los espacios.",
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

    await page.setInputFiles(VIDEO_INPUT, [VIDEO]);
    // La vista previa es un `<video>` de verdad, no una miniatura: sin transcodificación no hay
    // fotograma que sacar, y lo único que responde "¿es este el archivo?" es poder reproducirlo.
    await page.waitForSelector("video", { timeout: 40000 });
    ok("el video sube y deja una vista previa reproducible");
  }

  // ── publica ────────────────────────────────────────────────────────────────────────────────
  {
    await page.getByRole("button", { name: /^Publicar inmueble$/ }).click();
    try {
      await page.waitForURL(/\/mis-inmuebles$/, { timeout: 45000 });
    } catch (cause) {
      const shown = await page
        .locator('form [role="alert"], form p.text-destructive')
        .allInnerTexts();
      console.log("   errores en pantalla: " + JSON.stringify(shown));
      await page.screenshot({ path: `${SHOT_DIR}/video-publica-falla.png`, fullPage: true });
      throw cause;
    }
    await settled(page);

    const href = await page
      .locator("li", { hasText: TITLE })
      .getByRole("link")
      .first()
      .getAttribute("href");
    detailUrl = new URL(href, page.url()).toString();
    ok("publica con el video", detailUrl);
  }

  // ── la página pública: el reproductor y sus tres decisiones ────────────────────────────────
  {
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(detailUrl, { waitUntil: "domcontentloaded" });
    await settled(anonPage);

    await anonPage.waitForSelector("text=Video del inmueble", { timeout: 15000 });
    const player = anonPage.locator("video").first();

    /*
     * Se le pregunta al producto, no se recalcula la regla. `preload` y `poster` son la razón de
     * ser del componente: sin ellos, cada visitante del anuncio más compartido del sitio se trae
     * hasta 50 MB sin haber pedido ver nada.
     */
    const preload = await player.getAttribute("preload");
    if (preload !== "none") throw new Error(`preload es "${preload}", no "none"`);

    const poster = await player.getAttribute("poster");
    if (!poster) throw new Error("el reproductor no tiene poster: sale un rectángulo gris");
    /*
     * El poster **es** la portada del anuncio, y se comprueba por igualdad contra el `src` de esa
     * imagen — no derivando un trozo de la URL, que era mantener por segunda vez cómo compone
     * Storage sus enlaces.
     *
     * Se acota por el nombre accesible que el producto ya publica ("… — foto 1 de N"). La primera
     * versión miraba `header img` a secas y `.first()` le daba **el logo del sitio**, que también
     * vive en el `<header>`: una suposición sobre el orden del documento, no una afirmación sobre
     * qué imagen se quiere.
     */
    const cover = await anonPage
      .getByRole("img", { name: /— foto 1 de/ })
      .first()
      .getAttribute("src");
    if (!cover) throw new Error("no se encontró la foto de portada en la galería");
    if (poster !== cover) {
      throw new Error(`el poster no es la portada:\n  poster=${poster}\n  portada=${cover}`);
    }

    // `autoplay` y `muted`: un anuncio que arranca solo es un anuncio que se cierra.
    if ((await player.getAttribute("autoplay")) !== null) {
      throw new Error("el video arranca solo");
    }
    if ((await player.getAttribute("controls")) === null) {
      throw new Error("el video no trae controles: no hay manera de reproducirlo");
    }

    // El `<source type>` sale del contentType guardado, y es lo que deja a un navegador decidir
    // si vale la pena traerse el archivo.
    const type = await anonPage.locator("video source").first().getAttribute("type");
    if (type !== "video/mp4") throw new Error(`el source declara "${type}"`);

    // La salida para un navegador que no sabe decodificar el archivo (un .mov de iPhone en
    // Chrome): siempre visible, porque ese fallo no avisa de nada por su cuenta.
    const fallback = await anonPage.getByRole("link", { name: "Abrir el archivo" }).count();
    if (fallback !== 1) throw new Error("no está el enlace para abrir el archivo");

    await assertNoHorizontalScroll(anonPage, "el detalle con video a 1280px");
    await anonPage.setViewportSize({ width: 390, height: 844 });
    await anonPage.waitForTimeout(400);
    await assertNoHorizontalScroll(anonPage, "el detalle con video a 390px");
    await anonPage.screenshot({ path: `${SHOT_DIR}/video-detalle-390.png`, fullPage: true });

    ok("el reproductor público: preload=none, poster de portada, sin autoplay, con salida");
    await anon.close();
  }

  // ── el catálogo lo anuncia y no lo reproduce ────────────────────────────────────────────────
  {
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(new URL("/inmuebles", detailUrl).toString(), {
      waitUntil: "domcontentloaded",
    });
    await settled(anonPage);

    const card = anonPage.locator("li", { hasText: TITLE }).first();
    if (!(await card.getByText("Con video").count())) {
      throw new Error("la tarjeta no dice que el anuncio tiene video");
    }
    /*
     * Y la otra mitad, que es la que importa para el rendimiento: seis tarjetas con seis
     * recorridos son seis peticiones pesadas en la página donde alguien compara seis anuncios.
     * El video vive a un clic, en el detalle.
     */
    if (await anonPage.locator("video").count()) {
      throw new Error("el catálogo está montando un reproductor por tarjeta");
    }
    ok("el catálogo anuncia el video con una insignia y no lo reproduce");
    await anon.close();
  }

  // ── quitarlo lo quita: el caso del FieldValue.delete() ─────────────────────────────────────
  {
    await page.goto(new URL("/mis-inmuebles", page.url()).toString(), {
      waitUntil: "domcontentloaded",
    });
    await settled(page);
    await page.locator("li", { hasText: TITLE }).getByRole("link", { name: /Editar/i }).first().click();
    await page.waitForURL(/\/editar$/, { timeout: 25000 });
    await settled(page);
    await hydrated(page);

    // Editando, quitar un archivo que ya está publicado pregunta primero — como con las fotos.
    await page.getByRole("button", { name: "Quitar video" }).first().click();
    /*
     * El botón del diálogo lleva las **mismas palabras** que el que lo abrió, así que `.last()`
     * era una suposición sobre el orden del documento. Se acota al diálogo, que es lo que de
     * verdad se quiere decir.
     */
    await page.getByRole("dialog").getByRole("button", { name: "Quitar video" }).click();
    await page.waitForSelector("text=Agregar video", { timeout: 15000 });

    await page.getByRole("button", { name: /Guardar cambios/i }).click();
    await page.waitForURL(/\/mis-inmuebles$/, { timeout: 45000 });
    await settled(page);

    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(detailUrl, { waitUntil: "domcontentloaded" });
    await settled(anonPage);

    /*
     * La afirmación que paga este bloque entero. `batch.update` deja intacta la clave que no se
     * nombra, así que sin `FieldValue.delete()` el anuncio guardaría bien, la lista se vería
     * bien, y el video seguiría reproduciéndose en la página pública para siempre.
     */
    if (await anonPage.locator("video").count()) {
      throw new Error("¡el video sigue en la página pública después de quitarlo!");
    }
    const body = await anonPage.textContent("body");
    if (body.includes("Video del inmueble")) {
      throw new Error("queda la sección del video sin video dentro");
    }
    ok("quitar el video lo quita de la página pública");
    await anon.close();
  }

  assertQuiet(problems);
} finally {
  console.log("URL=" + detailUrl);
  await browser.close();
}
