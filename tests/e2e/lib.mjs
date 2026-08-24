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
 */
const defused = new WeakSet();
async function defuseDevOverlay(page) {
  // Una vez por página, no por navegación. Meterlo en cada `settled()` inyectaba un `<style>`
  // nuevo en cada paso y le sumaba una llamada al protocolo a cada espera: `documents` pasó de
  // 74s a 104s y se quedó sin tiempo esperando que se habilitara "Continuar a".
  if (defused.has(page)) return;
  defused.add(page);
  // `addInitScript` corre en cada documento que cargue la página, así que sobrevive a las
  // navegaciones y a los `reload()` sin volver a tocar el DOM desde fuera.
  await page
    .addInitScript(() => {
      const put = () => {
        if (document.getElementById("mad-e2e-defuse")) return;
        const style = document.createElement("style");
        style.id = "mad-e2e-defuse";
        style.textContent = "nextjs-portal { pointer-events: none !important; }";
        document.head?.append(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", put, { once: true });
      } else {
        put();
      }
    })
    .catch(() => {});
  // La página actual ya está cargada, así que el init script no la alcanza: se aplica a mano.
  await page
    .addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" })
    .catch(() => {});
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

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
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
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: /Guardar|Continuar/i }).click();
  await page.waitForURL(/\/inicio/, { timeout: 30000 });
  await settled(page);
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
  };
  if (!existsSync(files.photo1)) writeFileSync(files.photo1, png(64, [45, 18, 77]));
  if (!existsSync(files.photo2)) writeFileSync(files.photo2, png(64, [0, 229, 255]));
  if (!existsSync(files.pdf)) writeFileSync(files.pdf, PDF, "latin1");
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

/** `FieldValue`, para los `serverTimestamp()` de los drivers. */
export function adminFieldValue() {
  const require = createRequire(joinPath(REPO, "package.json"));
  return require("firebase-admin/firestore").FieldValue;
}
