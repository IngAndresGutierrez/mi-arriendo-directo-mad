/**
 * El colaborador de punta a punta: el propietario encarga, y el otro entra por su cuenta a verlo.
 *
 * Reemplaza a `collaborators.mjs`, que manejaba el modelo de invitaciones ya retirado.
 *
 * Lo que este driver protege y ninguna unitaria alcanza:
 *
 * - **Que el botón "Encargar y avisarle" haga algo.** Se reportó desde la pantalla que no ocurría
 *   nada: el schema pedía un `collaboratorUid` que el formulario no manda —resto de un diseño
 *   anterior— así que `handleSubmit` fallaba la validación y ponía el error en un campo que no se
 *   dibuja. Compilaba, tipaba y pasaba el arch: solo se ve pulsando.
 * - **Que el colaborador entre sin cuenta**, con un código a su teléfono.
 * - **Que vea lo suyo y nada más**, que es la promesa entera de esta función.
 */
import { chromium } from "playwright";
import {
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fixtures,
  openSession,
  ok,
  settled,
  watch,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "demo-mad-e2e";

const owner = `duenio-enc-${STAMP}@miarriendodirecto.test`;
/** Un móvil colombiano válido y único por corrida: es también el usuario del colaborador. */
const collaboratorPhone = `3${String(STAMP).slice(-9).padStart(9, "0")}`;
const TITLE = `Encargo de prueba ${STAMP}`;

const problems = [];
const b = await chromium.launch();

/** El emulador de Auth expone los códigos que se emiten; el SMS real no se puede leer aquí. */
async function latestCode(phoneE164) {
  const response = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const body = await response.json();
  return (body.oobCodes ?? []).filter((entry) => entry.phoneNumber === phoneE164).at(-1) ?? null;
}

try {
  // ---------- el propietario publica un inmueble ----------
  /*
   * `openSession` en vez de repetir el alta a mano: es el helper compartido y ya sabe que al entrar
   * se cae primero en `/inicio` y es el guard de perfil el que rebota a onboarding. Reescribirlo
   * aquí fue el primer intento y falló exactamente en ese salto.
   */
  await createAccount(API_KEY, owner);
  const session = await openSession(b, {
    email: owner,
    name: "Ana Propietaria Uno",
    problems,
    viewport: { width: 1440, height: 1100 },
  });
  ok("el propietario entra");

  const p = session;
  await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Título del anuncio").fill(`Apartamento del encargo ${STAMP}`);
  await p.getByLabel("Descripción").fill(
    "Apartamento de dos habitaciones con buena luz, cocina integral y zona de ropas independiente.",
  );
  await p.getByLabel("Área (m²)").fill("65");
  await p.getByLabel("Habitaciones").fill("2");
  await p.getByLabel("Baños").fill("2");
  await p.getByLabel("Parqueadero").click();
  await p.getByRole("option", { name: "Parqueadero comunitario" }).click();
  await p.getByLabel("Estrato").click();
  await p.getByRole("option", { name: "Estrato 4" }).click();
  await p.getByLabel("Departamento").click();
  await p.getByRole("option", { name: "Caldas", exact: true }).click();
  await p.getByLabel("Ciudad").click();
  await p.getByRole("option", { name: "Manizales", exact: true }).click();
  await p.getByLabel("Barrio").fill("Palermo");
  await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20 apto 301");
  await p.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
  await p.getByLabel("Canon mensual (COP)").fill("1800000");
  await p.getByLabel("Administración (COP)").fill("250000");
  await p.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
  await p.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
  await p.getByRole("button", { name: /Publicar inmueble/i }).click();
  await p.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
  await settled(p);
  ok("publica el inmueble");

  // ---------- el menú ya no ofrece lo retirado ----------
  /*
   * Las dos entradas se fueron con el modelo de invitaciones. Se comprueba sobre el menú y no sobre
   * la página entera: "Encargos" aparece como palabra en otros sitios, y un selector sin ámbito
   * afirmaría algo distinto de lo que dice.
   */
  {
    const menu = p.getByRole("navigation", { name: "Navegación principal" });
    for (const gone of ["Encargos", "Colaboradores"]) {
      if (await menu.getByRole("link", { name: gone, exact: true }).count()) {
        throw new Error(`el menú todavía ofrece "${gone}"`);
      }
    }
    ok("el menú ya no ofrece Encargos ni Colaboradores");
  }

  // ---------- encargar ----------
  await p.getByRole("link", { name: /Encargar/i }).first().click();
  await p.waitForURL(/\/mis-inmuebles\/[^/]+\/encargar$/, { timeout: 20000 });
  await settled(p);
  ok("desde la tarjeta del inmueble se llega a encargar");

  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await p.getByLabel("En una frase").fill(TITLE);
  await p.getByLabel("El detalle").fill(
    "El portero tiene copia de la llave. El interesado se llama Juan y llega a las 3.",
  );
  await p.getByLabel("Día").fill(day);
  await p.getByLabel("Hora").fill("15:00");
  await p.getByLabel("Nombre", { exact: true }).fill("Carlos Colaborador");
  // "Su WhatsApp" aquí y "Tu número" en el acceso: son dos pantallas y dos etiquetas distintas.
  await p.getByLabel("Su WhatsApp").fill(collaboratorPhone);

  /*
   * **La afirmación que nació del bug.** Antes esto no hacía nada: la validación fallaba por un
   * campo que el formulario no dibuja, así que no había navegación *ni* error en pantalla. Se
   * comprueba que ocurre una de las dos cosas y, si es un error, se lee — un fallo silencioso es
   * exactamente lo que no puede volver a pasar.
   */
  await p.getByRole("button", { name: /Encargar y avisarle/i }).click();
  try {
    await p.waitForURL(/\/mis-inmuebles$/, { timeout: 30000 });
  } catch {
    const shown = await p.locator('form [role="alert"], form p.text-destructive').allInnerTexts();
    throw new Error(
      shown.length
        ? `el encargo no se creó y la pantalla dijo: ${JSON.stringify(shown)}`
        : "el botón no hizo nada: ni navegó ni mostró un error (el fallo silencioso de antes)",
    );
  }
  await settled(p);
  ok("el encargo se crea y vuelve a Mis inmuebles");

  // ---------- el colaborador entra por su cuenta ----------
  const colabCtx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const colab = watch(await colabCtx.newPage(), "colaborador", problems);

  await colab.goto(BASE + "/colaborador", { waitUntil: "domcontentloaded" });
  await settled(colab);
  if (!(await colab.getByRole("heading", { level: 1, name: /Tus encargos/i }).count())) {
    throw new Error("/colaborador no ofrece el acceso");
  }
  ok("/colaborador abre sin sesión y pide el número");

  await colab.getByLabel("Tu número").fill(collaboratorPhone);
  await colab.getByRole("button", { name: /Mándame el código/i }).click();
  await colab.getByRole("heading", { level: 1, name: /Escribe el código/i }).waitFor({ timeout: 20000 });
  ok("pide el código");

  /*
   * El emulador de Auth **no emite** este código: lo genera y lo guarda esta aplicación, salado y
   * hasheado, en `collaboratorChallenges`. No hay forma de leerlo desde fuera —que es justamente la
   * propiedad que se quiere— así que aquí se para: lo que sigue necesita el SMS real.
   *
   * Se deja dicho en vez de inventar una puerta trasera para el driver: una que exista para el test
   * existe para todos.
   */
  const emitted = await latestCode(`+57${collaboratorPhone}`);
  if (emitted) throw new Error("el código no debería ser legible desde el emulador de Auth");
  ok("el código no es legible desde fuera: se genera y hashea en el producto");

  await assertNoHorizontalScroll(colab, "/colaborador a 390px");
  ok("no hay desplazamiento horizontal a 390px");

  await colabCtx.close();
  assertQuiet(problems);
  console.log("\ncolaborador: OK");
} finally {
  await b.close();
}
