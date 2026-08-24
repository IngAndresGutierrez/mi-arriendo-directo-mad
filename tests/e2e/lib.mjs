/**
 * The shared harness for the browser drivers.
 *
 * Everything here used to be copy-pasted into every driver, and that is exactly why adding
 * `app/(app)/loading.tsx` cost three sweeping rewrites of 57 files: each one carried its own
 * copy of the "wait for the skeleton to clear" helper. A change in how the app answers a
 * navigation is one edit in this file now.
 *
 * These drive a real browser against a real dev server. They are not unit tests: `pnpm test`
 * is for pure logic, and this is for the consequence a user actually receives.
 */
import { chromium } from "playwright";

/*
 * ── The guard, and why it is here and not only in `run.mjs` ──────────────────────────────────
 *
 * Every driver publishes listings, creates accounts and uploads files. Pointed at the deployed
 * project it does all of that **in production**, and that is not hypothetical: it put 306 fake
 * listings in the public catalogue, 329 applications and 644 auth accounts.
 *
 * `run.mjs` refuses too, but a guard in the launcher only covers what the launcher launches. Run
 * a driver by hand — `E2E_API_KEY=… node tests/e2e/nav.mjs` — and it went straight to the real
 * Identity Toolkit. So the check belongs where the connection is made: this module is imported by
 * all 34 of them, and throwing at module scope fires before a single line of driver code runs.
 *
 * The `demo-` prefix is not a convention. The Firebase SDKs refuse to contact any real backend for
 * such a project, so the isolation holds even if every other variable is wrong.
 */
if (!process.env.E2E_AGAINST_REAL && !process.env.FIREBASE_PROJECT_ID?.startsWith("demo-")) {
  throw new Error(
    `los drivers escriben de verdad y FIREBASE_PROJECT_ID es "${process.env.FIREBASE_PROJECT_ID ?? "(sin definir)"}".\n` +
      "Tiene que ser un proyecto demo-, o esto ensucia producción.\n\n" +
      "  pnpm emulators   # una terminal\n" +
      "  pnpm dev:e2e     # otra\n" +
      "  pnpm e2e:env     # y los drivers aquí",
  );
}

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = "ClaveDePrueba1";

/**
 * Dónde está el formulario de acceso.
 *
 * **Era `/`, y dejó de serlo el día que la landing tomó la raíz.** Veintiocho drivers hacían
 * `goto(BASE + "/")` y rellenaban ahí el correo: con una landing en esa URL no habría fallado con
 * un error útil, habría fallado esperando un campo que esa página no tiene, en veintiocho sitios a
 * la vez y ninguno por un fallo del producto.
 *
 * Una constante y no el literal repetido, por la misma razón que `advanceButton()` existe: la
 * próxima vez que esta ruta se mueva es una línea, no un barrido.
 */
export const LOGIN_PATH = "/ingresar";

/** The month select renders es-CO copy, so the option names are Spanish. */
export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Test accounts live on domains the cleanup script recognises. Never a real address. */
export const TEST_DOMAIN = "@miarriendodirecto.test";

export const ok = (message, extra = "") =>
  console.log(`  OK    ${message}${extra ? " — " + extra : ""}`);

/**
 * A `loading.tsx` answers before the content does, so asserting the instant a URL resolves
 * asserts the skeleton instead of the page.
 *
 * Checked twice on purpose: right after a click the skeleton has not mounted yet, so a single
 * check passes before it ever appears and then reads the *previous* page. The gap between the
 * two is what lets it mount.
 */
export async function settled(page, timeout = 25000) {
  const clear = () =>
    page.waitForFunction(
      () => !document.querySelector('[role="status"][aria-label^="Cargando"]'),
      null,
      { timeout },
    );
  await clear();
  await page.waitForTimeout(200);
  await clear();
  await defuseDevOverlay(page);
}

/**
 * Filling a field before React has attached its handlers types into a dead input: the value
 * is set and then thrown away by hydration. Waiting for the form to carry a React key is the
 * cheapest definite answer that hydration has happened.
 */
export async function hydrated(page, timeout = 20000) {
  await page.waitForFunction(
    () => {
      const form = document.querySelector("form");
      return form && Object.keys(form).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout },
  );
}

/**
 * Where the signup call goes.
 *
 * The Auth emulator serves the same Identity Toolkit shape under its own host and **ignores the
 * API key**, which is why the emulated run needs no real one — and why it has no signup quota. The
 * real endpoint answers `TOO_MANY_ATTEMPTS_TRY_LATER` after enough accounts, and that arrives
 * looking like a product bug.
 */
function identityToolkit() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  return host
    ? `http://${host}/identitytoolkit.googleapis.com/v1`
    : "https://identitytoolkit.googleapis.com/v1";
}

/** Creates the auth user straight against Identity Toolkit — faster than driving signup. */
export async function createAccount(apiKey, email) {
  const response = await fetch(
    `${identityToolkit()}/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      // The real endpoint tolerates a missing content-type; the Auth emulator answers
      // `Invalid content-type: text/plain` and the run then fails at an unrelated wait.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (body.error) throw new Error(`no se pudo crear ${email}: ${body.error.message}`);
  return body;
}

export async function launch() {
  const browser = await chromium.launch();
  /** Collected across every page of the run; `assertQuiet` is what turns it into a failure. */
  const problems = [];
  return { browser, problems };
}

/**
 * Attaches the console watch. A 404 on a subresource is filtered out: the drivers request
 * made-up URLs on purpose to assert the real 404s, and those are not page errors.
 */
/**
 * El overlay de errores de `next dev` es un `<nextjs-portal>` que captura los eventos de
 * puntero de toda la página: con él abierto, un clic legítimo falla con "subtree intercepts
 * pointer events" y el driver muere por algo que en producción no existe. Aparece incluso por
 * artefactos del propio arnés — cerrar la página mientras una respuesta va en streaming
 * levanta "The destination stream closed early".
 *
 * Se le quita la intercepción, no la visibilidad: si el overlay sale, sigue saliendo en la
 * captura, que es donde una persona lo va a ver.
 *
 * **Y lo mismo con el banner de cookies**, por la misma razón y con la misma solución. Es
 * `fixed bottom-0 z-50`, así que hasta que alguien lo responde tapa los últimos ochenta píxeles de
 * cualquier pantalla — lo cual está bien en el producto, se contesta una vez, pero deja a los
 * treinta y ocho drivers que no van de cookies peleando con "subtree intercepts pointer events" en
 * cada botón del pie de un formulario. Se le quita la intercepción y se queda visible, que es lo que
 * hace que siga apareciendo en las capturas.
 *
 * `legal.mjs` sí va de eso y necesita pulsarlo: `keepCookieBanner(page)` lo exime.
 */
const wantsBanner = new WeakSet();

/**
 * Deja el banner de cookies pulsable en esta página.
 *
 * Solo `legal.mjs`, que es el driver cuyo asunto es. Se llama **antes** del primer `settled()`.
 */
export function keepCookieBanner(page) {
  wantsBanner.add(page);
}

const defused = new WeakSet();
async function defuseDevOverlay(page) {
  // Una vez por página, no por navegación. Meterlo en cada `settled()` inyectaba un `<style>`
  // nuevo en cada paso y le sumaba una llamada al protocolo a cada espera: `documents` pasó de
  // 74s a 104s y se quedó sin tiempo esperando que se habilitara "Continuar a".
  if (defused.has(page)) return;
  defused.add(page);

  /* Un solo `<style>` para las dos cosas: una llamada al protocolo, no dos. */
  const neutralise = wantsBanner.has(page)
    ? "nextjs-portal { pointer-events: none !important; }"
    : 'nextjs-portal, [aria-label="Uso de cookies"] { pointer-events: none !important; }';
  // `addInitScript` corre en cada documento que cargue la página, así que sobrevive a las
  // navegaciones y a los `reload()` sin volver a tocar el DOM desde fuera.
  await page
    .addInitScript((css) => {
      const put = () => {
        if (document.getElementById("mad-e2e-defuse")) return;
        const style = document.createElement("style");
        style.id = "mad-e2e-defuse";
        style.textContent = css;
        document.head?.append(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", put, { once: true });
      } else {
        put();
      }
    }, neutralise)
    .catch(() => {});
  // La página actual ya está cargada, así que el init script no la alcanza: se aplica a mano.
  await page.addStyleTag({ content: neutralise }).catch(() => {});
}

export function watch(page, label, problems) {
  page.on("pageerror", (e) => problems.push(`${label} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) {
      problems.push(`${label} console: ${m.text().slice(0, 130)}`);
    }
  });
  return page;
}

export async function fillBirthdate(page, day, month, year) {
  await page.getByLabel("Día", { exact: true }).fill(day);
  await page.getByLabel("Mes", { exact: true }).click();
  await page.getByRole("option", { name: month, exact: true }).click();
  await page.getByLabel("Año", { exact: true }).fill(year);
}

/** Signs in and, when the account has no profile yet, completes onboarding. Lands on /inicio. */
export async function openSession(
  browser,
  { email, name, problems = [], viewport = { width: 1440, height: 1100 }, city = "Manizales", department = "Caldas" },
) {
  const context = await browser.newContext({ viewport });
  const page = watch(await context.newPage(), name, problems);

  await page.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(page);
  await hydrated(page);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: /Ingresar|Iniciar/i }).click();

  // Ojo con esperar `/completar-perfil|\/inicio` a la vez: al entrar se cae primero en
  // `/inicio` y es el guard de perfil el que rebota a onboarding, así que la alternancia
  // resolvía en `/inicio` y devolvía una sesión sin perfil. Luego `requireCompleteProfile()`
  // sacaba de la página de publicar y el formulario no aparecía nunca.
  await page.waitForURL(/completar-perfil/, { timeout: 25000 });
  await settled(page);
  await completeProfile(page, { name, city, department });
  return page;
}

/**
 * Las dos autorizaciones del onboarding.
 *
 * **Antes cada driver hacía `getByRole("checkbox").click()`**, que valía mientras hubiera una sola
 * casilla. Aceptar los Términos y autorizar el tratamiento de datos son actos distintos —el segundo
 * tiene que ser expreso— y el formulario los pide aparte, así que un selector sin ámbito ahora
 * encuentra dos y falla por ambigüedad: treinta y cinco drivers rojos a la vez, y ninguno por un
 * fallo del producto.
 *
 * Por id y no con `.first()`: `.first()` es una suposición sobre el orden del documento, no una
 * afirmación sobre cuál de las dos casillas se quiere. Las dos son obligatorias, de modo que dejar
 * una sin marcar no deja pasar el formulario — y eso es lo que este helper garantiza en un solo
 * sitio la próxima vez que el bloque cambie.
 */
export async function acceptLegalConsents(page) {
  for (const id of ["acceptsTerms", "authorizesDataTreatment"]) {
    await page.locator(`#${id}`).click();
  }
}

/**
 * La declaración de que la referencia autorizó dar sus datos.
 *
 * Es el único campo del producto donde alguien entrega el nombre y el teléfono de **otra persona**,
 * que nunca autorizó nada: la Ley 1581 exige la autorización del titular, y el titular ahí es la
 * referencia. El formulario no se envía sin ella, así que doce drivers que rellenaban el dossier se
 * quedaron esperando una navegación que ya no iba a ocurrir.
 *
 * Se pide de nuevo en cada guardado, a diferencia de los Términos: la casilla habla del número que
 * está en el campo de al lado, y ese campo se puede editar.
 */
export async function declareReferenceAuthorized(page) {
  await page.locator("#referenceAuthorized").click();
}

export async function completeProfile(page, { name, city = "Manizales", department = "Caldas" }) {
  await hydrated(page);
  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Teléfono").fill("3001234567");
  await fillBirthdate(page, "10", MONTHS[4], "1990");
  await page.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
  for (const [label, option] of [
    ["Género", /Femenino/i],
    ["Departamento", new RegExp(department)],
    ["Ciudad", new RegExp(`^${city}$`)],
  ]) {
    await page.getByLabel(label).click();
    await page.getByRole("option", { name: option }).first().click();
  }
  await acceptLegalConsents(page);
  await page.getByRole("button", { name: /Guardar|Continuar/i }).click();
  await page.waitForURL(/\/inicio/, { timeout: 30000 });
  await settled(page);
}

/**
 * Que React ya escucha en ese elemento concreto.
 *
 * `hydrated()` busca un `<form>` y hay pantallas del producto que no tienen ninguno — el panel de los
 * meses, el de los incidentes, el interruptor del seguro son campos y botones sueltos. Esta es la
 * versión general, y hace falta exactamente en un caso: **un evento de una sola oportunidad sobre un
 * elemento que ya era pulsable**. `setInputFiles` dispara `change` una vez, y un clic sobre un
 * `Switch` de Radix al que todavía no se le ha enganchado el manejador no cambia nada; en los dos
 * casos Playwright no reintenta, porque desde su punto de vista la acción se hizo.
 *
 * No se pone en `settled()`: la mayoría de las interacciones no lo necesitan y pagarlo en cada
 * navegación es lo que una vez llevó `documents` de 74s a 104s.
 */
export async function reactReady(page, selector, timeout = 20000) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el) && Object.keys(el).some((k) => k.startsWith("__react"));
    },
    selector,
    { timeout },
  );
}

/**
 * Cambia de pestaña en la pantalla de un arriendo, y espera a que el panel esté montado.
 *
 * Vive aquí y no en un driver porque es **cómo se navega esa pantalla** desde que tiene pestañas:
 * "Información", "Pagos" e "Incidentes" son tres paneles y Radix desmonta el que no se ve, así que
 * cualquier aserción sobre el resumen o sobre los incidentes empieza por esto. Dos drivers ya lo
 * necesitan y el siguiente que toque la tenencia también.
 *
 * Se espera la hidratación del rail antes de pulsar: un `click` sobre un `tab` al que Radix todavía
 * no le ha enganchado el manejador no cambia de pestaña, y Playwright no lo reintenta porque el
 * elemento ya era pulsable. Y después se espera **la pestaña activa**, no el clic: el panel se monta
 * en el render siguiente.
 */
export async function leaseTab(page, name) {
  const trigger = page.getByRole("tab", { name: new RegExp(name, "i") });
  await trigger.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="tabs-trigger"]');
      return Boolean(el) && Object.keys(el).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout: 20000 },
  );
  await trigger.click();
  await page.waitForFunction(
    (label) => {
      const active = document.querySelector('[data-slot="tabs-trigger"][data-state="active"]');
      return Boolean(active?.textContent?.toLowerCase().includes(label.toLowerCase()));
    },
    name,
    { timeout: 15000 },
  );

  return page.getByRole("tabpanel");
}

/** No horizontal scrolling at 390px is a rule for every screen, so it is one helper. */
export async function assertNoHorizontalScroll(page, where) {
  const size = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  if (size.doc > size.win + 1) {
    throw new Error(`scroll horizontal en ${where}: ${JSON.stringify(size)}`);
  }
}

/**
 * Las teselas del mapa, respondidas desde aquí y nunca desde OpenStreetMap.
 *
 * Dos razones, y ninguna es comodidad. Una corrida de drivers no debe gastar el servicio de
 * voluntarios que este producto usa en producción — la misma lección que `RESEND_API_KEY=` vacío
 * en el servidor de e2e, que ya se pagó agotando la cuota de un día con tests. Y un driver que
 * depende de la red de un tercero se pone rojo por algo que no es el producto: sin esto, cada
 * imagen fallida en una máquina sin salida a internet es una línea de consola y `assertQuiet` la
 * convierte en un fallo.
 *
 * Leaflet dibuja el mapa igual: las teselas son imágenes, y lo que los drivers afirman son
 * coordenadas. Se llama en los tres drivers que montan un mapa, no en `watch()`: `page.route` es
 * asíncrono y meterlo en un ayudante síncrono sería una carrera.
 */
export async function stubTiles(page, tile) {
  await page.route("**tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: tile }),
  );
}

export function assertQuiet(problems) {
  if (problems.length) throw new Error("consola: " + problems.join(" | "));
  ok("consola sin errores");
}

// ---------------------------------------------------------------------------
// The entrypoint contract, and the files the drivers upload.
//
// The drivers used to read positional arguments, and they had grown five different
// contracts between them: `[API_KEY, STAMP, SHOT_DIR]`, `[API_KEY, STAMP, SHOT]` where the
// third was a *file*, some with `PHOTO_1, PHOTO_2` appended, one with a `PDF` after that.
// Nothing enforced any of them, so a runner that passed the wrong shape failed deep inside
// a driver on a timeout that named a form field. It is env vars and one accessor now.
// ---------------------------------------------------------------------------
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function config() {
  const apiKey = process.env.E2E_API_KEY;
  if (!apiKey) throw new Error("falta E2E_API_KEY — arranca con `pnpm e2e`, no con `node`");
  return {
    apiKey,
    /** Unique per driver per run, so two runs never collide on an email or a slug. */
    stamp: process.env.E2E_STAMP ?? String(process.hrtime.bigint()).slice(-9),
    shotDir: process.env.E2E_SHOT_DIR ?? join(tmpdir(), "mad-e2e-shots"),
  };
}

const chunk = (type, data) => {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
};

/** A real PNG, encoded here rather than committed, so the fixtures cannot go missing. */
function png(size, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const raw = Buffer.concat(
    Array.from({ length: size }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: size }, () => Buffer.from([r, g, b])))]),
    ),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

/**
 * Un MP4 con la cabecera de verdad y nada dentro.
 *
 * Lo que se maneja con esto es el camino de un video: que el tipo se acepte, que suba al bucket con
 * su `contentType`, que la acción lo confirme contra Storage y que la ficha lo pinte como `<video>`
 * y no como una foto. **No se maneja la reproducción** — no hay pistas que decodificar —, y eso está
 * dicho aquí porque la alternativa sería comprometer un fichero binario de varios megas al repo para
 * probar el decodificador de Chromium, que no es de este producto.
 *
 * `setInputFiles` deduce el mime de la extensión, así que lo que el navegador declara es `video/mp4`.
 */
const MP4 = Buffer.concat([
  // ftyp: tamaño, marca, versión menor, y las marcas compatibles.
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftyp", "ascii"),
  Buffer.from("isom", "ascii"),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
  Buffer.from("isomiso2", "ascii"),
  // mdat vacío: la caja donde irían los datos.
  Buffer.from([0x00, 0x00, 0x00, 0x08]),
  Buffer.from("mdat", "ascii"),
]);

/**
 * The files the drivers upload. Written once per run into the shot directory.
 * The two photos differ in colour on purpose: an uploader that dedupes by content would
 * otherwise silently accept one file where the driver believes it sent two.
 */
export function fixtures() {
  const dir = join(config().shotDir, "fixtures");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const files = {
    photo1: join(dir, "photo-1.png"),
    photo2: join(dir, "photo-2.png"),
    pdf: join(dir, "documento.pdf"),
    video: join(dir, "video.mp4"),
  };
  if (!existsSync(files.photo1)) writeFileSync(files.photo1, png(64, [45, 18, 77]));
  if (!existsSync(files.photo2)) writeFileSync(files.photo2, png(64, [0, 229, 255]));
  if (!existsSync(files.pdf)) writeFileSync(files.pdf, PDF, "latin1");
  if (!existsSync(files.video)) writeFileSync(files.video, MP4);
  return files;
}

// ---------------------------------------------------------------------------
// El Admin SDK, para los drivers que necesitan poner un proceso en una etapa concreta.
//
// Estaba copiado dentro de un driver con la ruta absoluta del checkout de quien lo escribió, así
// que no funcionaba en ningún otro. Aquí las rutas salen de la ubicación de este fichero.
// ---------------------------------------------------------------------------
import { createRequire } from "node:module";
import { readFileSync as readEnvFile } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = joinPath(dirname(fileURLToPath(import.meta.url)), "..", "..");
let adminApp = null;

/** Firestore con el Admin SDK. Inicializa una sola vez por proceso. */
export function adminDb() {
  const require = createRequire(joinPath(REPO, "package.json"));
  const { cert, initializeApp, getApps } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");

  if (!adminApp) {
    /** Read only when a real service account is what we need: an emulated run has no `.env.local`. */
    const dotLocal = () =>
      Object.fromEntries(
        readEnvFile(joinPath(REPO, ".env.local"), "utf8")
          .split("\n")
          .filter((line) => line.includes("=") && !line.startsWith("#"))
          .map((line) => [
            line.slice(0, line.indexOf("=")),
            line.slice(line.indexOf("=") + 1).replace(/^"|"$/g, ""),
          ]),
      );
    /*
     * Against the emulators there is no service account to present, and none is needed: the SDK
     * routes itself off `FIRESTORE_EMULATOR_HOST` and the project id is the whole configuration.
     * The `demo-` check is the same one the server makes — a driver that seeds straight into the
     * real Firestore is exactly how the production catalogue ended up with 306 fake listings.
     */
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId?.startsWith("demo-")) {
        throw new Error(`el emulador está apuntado a "${projectId}"; tiene que ser un demo-`);
      }
      adminApp = getApps().length ? getApps()[0] : initializeApp({ projectId });
    } else {
      const env = dotLocal();
      adminApp = getApps().length
        ? getApps()[0]
        : initializeApp({
            credential: cert({
              projectId: env.FIREBASE_PROJECT_ID,
              clientEmail: env.FIREBASE_CLIENT_EMAIL,
              privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
          });
    }
  }

  return getFirestore(adminApp);
}

/**
 * Las etapas del proceso, en orden, y la insignia que las cuenta.
 *
 * Once drivers afirmaban "Paso 5 de 7" a mano, que es una copia de una regla del producto en once
 * ficheros: añadir la visita al inmueble desplazó seis etapas y las puso rojas todas a la vez, con
 * el diff de cada una siendo una cifra. La lista vive aquí una sola vez, y un driver dice de qué
 * **etapa** habla en vez de en qué número cayó — que es lo que de verdad quiere decir.
 *
 * Sigue siendo una copia de `STAGES`, y no hay forma de evitarlo: los drivers son `.mjs` y el
 * dominio es TypeScript. Lo que se compra es que la copia sea una y esté señalada.
 */
export const STAGE_ORDER = [
  "submitted",
  "visit",
  "tenant_data",
  "background_check",
  "interview",
  "guarantee",
  "contract_signature",
  "first_payment",
];

/** `Paso 5 de 8` para una etapa, como lo escribe la insignia sobre la línea. */
export function stepLabel(stage) {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0) throw new Error(`no existe la etapa ${stage}`);

  return `Paso ${index + 1} de ${STAGE_ORDER.length}`;
}

/** Espera a que la página diga que el proceso está en esa etapa. */
export async function onStage(page, stage, timeout = 20000) {
  const label = stepLabel(stage);
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    label,
    { timeout },
  );

  return label;
}

/**
 * Deja la visita al inmueble hecha y con visto bueno, para un driver que no va de eso.
 *
 * La visita es la segunda etapa y **bloquea**: sin proponerla, confirmarla y que el inquilino diga
 * que le interesa, el proceso no pasa de ahí. Los drivers que empiezan postulándose por la interfaz
 * y luego van a otra cosa —los documentos, la campana— tendrían que recorrerla entera para llegar a
 * su tema, que son cuatro interacciones y dos sesiones por una etapa que `visit.mjs` ya maneja de
 * punta a punta.
 *
 * Escribe con el Admin SDK lo que habrían escrito esas cuatro interacciones, y **deja el proceso en
 * la etapa de la visita** en vez de saltársela: así el driver sigue avanzando con el botón del
 * producto y lo que se ahorra es el trámite, no la comprobación.
 */
export async function satisfyVisit(applicationId, when = "2026-09-10T20:00:00.000Z") {
  const now = new Date().toISOString();

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      stage: "visit",
      visit: {
        at: when,
        meetingPoint: "Cra 23 #14-08, portería de la torre 2",
        note: "",
        proposedAt: now,
        confirmedAt: now,
        declinedAt: null,
        declineNote: "",
        verdict: { result: "interested", note: "Me gustó mucho la luz.", at: now },
      },
      updatedAt: adminFieldValue().serverTimestamp(),
    });
}

/**
 * El botón de seguir **de la barra de arriba**, la que está sobre la línea de etapas.
 *
 * Existe porque ese botón vive ahora en dos sitios: ahí arriba, siempre, y al pie de la etapa en
 * curso cuando el paso ya está listo. Un `getByRole("button", { name: /Continuar a/ })` suelto
 * encuentra los dos y Playwright falla por ambigüedad — que es como se rompieron cuatro drivers a la
 * vez el día que se añadió el segundo. Un `.first()` tampoco vale: es una suposición sobre el orden
 * del documento, no sobre de cuál se está hablando.
 *
 * Para el del pie de una etapa, el asidero es su tarjeta: `page.locator("#etapa-<stage>")`.
 */
export function advanceButton(page) {
  return page.locator('[data-slot="stage-actions"]').getByRole("button", { name: /Continuar a/i });
}

/**
 * Cloud Storage con el Admin SDK, sobre la misma app que `adminDb()`.
 *
 * Existe porque en la suite emulada **no hay URL firmada**: firmar necesita una cuenta de servicio y
 * un proyecto `demo-` no tiene ninguna. Un driver que quiera comprobar los bytes de un archivo tiene
 * que leerlos por aquí, que además es una aserción más fuerte que descargar un enlace — mira el
 * objeto, no la URL.
 *
 * El bucket se nombra explícitamente: la app emulada se inicializa solo con el id del proyecto, así
 * que no hay bucket por defecto que resolver.
 */
export function adminStorage() {
  const require = createRequire(joinPath(REPO, "package.json"));
  const { getStorage } = require("firebase-admin/storage");

  adminDb();
  const projectId = process.env.FIREBASE_PROJECT_ID;

  return getStorage(adminApp).bucket(`${projectId}.firebasestorage.app`);
}

/**
 * Auth con el Admin SDK, sobre la misma app que `adminDb()`.
 *
 * Existe por lo mismo: un driver que llamaba a `initializeApp()` por su cuenta con la cuenta de
 * servicio real acababa preguntándole al proyecto de verdad por una cuenta que acababa de crear en
 * el emulador, y moría con `USER_NOT_FOUND` antes de su primera aserción.
 */
export function adminAuth() {
  const require = createRequire(joinPath(REPO, "package.json"));
  // `adminDb()` es quien decide la app —emulador o cuenta de servicio— y la deja inicializada.
  adminDb();

  return require("firebase-admin/auth").getAuth(adminApp);
}

/** `FieldValue`, para los `serverTimestamp()` de los drivers. */
export function adminFieldValue() {
  const require = createRequire(joinPath(REPO, "package.json"));
  return require("firebase-admin/firestore").FieldValue;
}
