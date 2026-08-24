/**
 * Recuperar la contraseña, de punta a punta.
 *
 * La afirmación que no se puede sustituir por una unitaria es la última: que después de cambiarla,
 * **se entra con la nueva**. Todo lo demás —la pantalla, el enlace, el código— puede estar bien y
 * dejar una cuenta con la contraseña vieja, y eso solo se ve entrando.
 *
 * La segunda que importa es la de enumeración: la respuesta a un correo que existe y a uno que no
 * tiene que ser **la misma palabra por palabra**. Es una propiedad de dos ejecuciones comparadas
 * entre sí, así que no hay unitaria que la cubra: vive en la pantalla.
 */
import { chromium } from "playwright";
import {
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  LOGIN_PATH,
  ok,
  PASSWORD,
  settled,
  watch,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP } = config();
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "demo-mad-e2e";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const NEW_PASSWORD = "ClaveNuevaSegura9";

const email = `reset-${STAMP}@miarriendodirecto.test`;

/**
 * El `oobCode` que el emulador acaba de emitir.
 *
 * El correo real lleva el enlace en el cuerpo, no en el asunto, así que —a diferencia del código de
 * firma— no se puede leer del log de `pnpm dev`. El emulador de Auth expone los códigos pendientes
 * en su propia API, que es exactamente para esto. Se toma **el último**, porque el driver pide más
 * de uno a lo largo del run.
 */
async function latestOobCode() {
  const response = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const body = await response.json();
  const codes = (body.oobCodes ?? []).filter((entry) => entry.email === email);

  return codes.at(-1) ?? null;
}

const problems = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = watch(await ctx.newPage(), "password-reset", problems);

try {
  await createAccount(API_KEY, email);

  // ---------- el enlace del login llega a alguna parte ----------
  /*
   * `/recuperar` estuvo enlazado desde el formulario de acceso mucho antes de existir, respondiendo
   * 404 todo ese tiempo. Un `<Link>` a una ruta que no está compila perfectamente, así que esto es
   * lo único que lo habría detectado.
   */
  await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByRole("link", { name: /¿Olvidaste tu contraseña\?/i }).click();
  await p.waitForURL(/\/recuperar$/, { timeout: 20000 });
  await settled(p);
  if (!(await p.getByRole("heading", { level: 1, name: /Recuperar tu contraseña/i }).count())) {
    throw new Error("/recuperar no abrió su formulario");
  }
  ok("el enlace del login llega a /recuperar y ya no es un 404");

  // ---------- pedirlo para una cuenta que existe ----------
  await p.getByLabel("Correo electrónico").fill(email);
  await p.getByRole("button", { name: /Enviarme el enlace/i }).click();
  await p.getByRole("heading", { level: 1, name: /Revisa tu correo/i }).waitFor({ timeout: 20000 });
  const conCuenta = (await p.locator("[role='status']").first().innerText()).replace(/\s+/g, " ").trim();
  ok("pedirlo para una cuenta que existe confirma sin más", conCuenta.slice(0, 60));

  const emitted = await latestOobCode();
  if (!emitted?.oobCode) throw new Error("el emulador no registró ningún código para esa cuenta");
  ok("se emitió un código de recuperación");

  /*
   * **El `continueUrl` no puede ser la pantalla de confirmar**, y esto es una regresión que ya
   * ocurrió: `url` en `generatePasswordResetLink` es a dónde va la persona *después* de haber
   * cambiado la contraseña, no a dónde apunta el enlace del correo. Apuntándolo a
   * `/recuperar/confirmar`, quien terminaba el cambio en la página de Firebase aterrizaba en la
   * pantalla que exige un `oobCode`, sin `oobCode`, y leía "este enlace está incompleto" sobre una
   * contraseña que se acababa de guardar bien.
   *
   * Se afirma sobre el enlace que el emulador registró, que es el que Firebase enviaría.
   */
  const continueUrl = new URL(emitted.oobLink).searchParams.get("continueUrl") ?? "";
  if (continueUrl.includes("/recuperar/confirmar")) {
    throw new Error(`el continueUrl vuelve a la pantalla que pide el código: ${continueUrl}`);
  }
  if (!continueUrl.includes(LOGIN_PATH)) {
    throw new Error(`el continueUrl no lleva al login: ${continueUrl || "(vacío)"}`);
  }
  ok("después de cambiarla, Firebase devuelve al login", continueUrl);

  // ---------- y para una que no existe: la MISMA respuesta ----------
  /*
   * El corazón de esta pantalla. Si el mensaje cambiara —"no existe una cuenta con ese correo"—
   * cualquiera podría teclear direcciones y averiguar cuáles están registradas aquí. Es la misma
   * regla que `shared/auth/errors.ts` sostiene en el login haciendo que credencial inválida y
   * usuario desconocido compartan un mensaje, y dejarla escapar por aquí la anularía.
   *
   * Se compara el texto de las dos ejecuciones, no se busca una frase concreta: lo que se afirma
   * es que son indistinguibles, y eso no lo puede fingir un `includes`.
   */
  const desconocido = `no-existe-${STAMP}@miarriendodirecto.test`;
  await p.goto(BASE + "/recuperar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Correo electrónico").fill(desconocido);
  await p.getByRole("button", { name: /Enviarme el enlace/i }).click();
  await p.getByRole("heading", { level: 1, name: /Revisa tu correo/i }).waitFor({ timeout: 20000 });
  const sinCuenta = (await p.locator("[role='status']").first().innerText()).replace(/\s+/g, " ").trim();

  if (sinCuenta.replace(desconocido, "X") !== conCuenta.replace(email, "X")) {
    throw new Error(`la respuesta delata si la cuenta existe:\n  con: ${conCuenta}\n  sin: ${sinCuenta}`);
  }
  ok("un correo sin cuenta recibe exactamente la misma respuesta");

  // ---------- un enlace inservible se dice antes de pedir nada ----------
  await p.goto(BASE + "/recuperar/confirmar?oobCode=codigo-que-no-existe", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByRole("heading", { level: 1, name: /El enlace no sirve/i }).waitFor({ timeout: 20000 });
  if (await p.getByLabel("Contraseña nueva").count()) {
    throw new Error("ofreció el formulario con un código muerto");
  }
  ok("un código inválido se avisa antes de escribir la contraseña");

  // ---------- y sin código en la URL: otra cosa, no un error ----------
  /*
   * Llegar aquí sin código **no** es un enlace roto en el caso más probable: es alguien que acaba
   * de terminar el cambio en la página de Firebase. Decirle "el enlace no sirve" sería mentirle
   * sobre una contraseña que sí se guardó, así que la pantalla dice otra cosa y ofrece entrar.
   */
  await p.goto(BASE + "/recuperar/confirmar", { waitUntil: "domcontentloaded" });
  await settled(p);
  if (await p.getByRole("heading", { level: 1, name: /El enlace no sirve/i }).count()) {
    throw new Error("sin código dice que el enlace no sirve, y lo más probable es que sí sirviera");
  }
  await p.getByRole("heading", { level: 1, name: /Aquí no hay nada que cambiar/i }).waitFor({ timeout: 20000 });
  if (!(await p.getByRole("link", { name: /Iniciar sesión/i }).count())) {
    throw new Error("sin código no ofrece entrar, que es lo que esa persona viene a hacer");
  }
  ok("sin código, la pantalla no acusa un fallo y ofrece entrar");

  // ---------- el camino feliz ----------
  await p.goto(BASE + `/recuperar/confirmar?oobCode=${encodeURIComponent(emitted.oobCode)}`, {
    waitUntil: "domcontentloaded",
  });
  await settled(p);
  await p.getByRole("heading", { level: 1, name: /Elige una contraseña nueva/i }).waitFor({ timeout: 20000 });

  // La pantalla dice de qué cuenta es: quien tiene dos necesita saber cuál enlace abrió.
  if (!(await p.getByText(email, { exact: false }).count())) {
    throw new Error("la pantalla no dice de qué cuenta es el enlace");
  }
  ok("el enlace bueno abre el formulario y nombra la cuenta");

  await p.getByLabel("Contraseña nueva").fill(NEW_PASSWORD);
  await p.getByRole("button", { name: /Guardar la contraseña/i }).click();
  await p.getByRole("heading", { level: 1, name: /Contraseña actualizada/i }).waitFor({ timeout: 25000 });
  ok("la contraseña se guarda");

  // ---------- lo único que prueba que sirvió: entrar con ella ----------
  await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Correo electrónico").fill(email);
  await p.getByLabel("Contraseña").fill(NEW_PASSWORD);
  await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
  await p.waitForURL(/completar-perfil|\/inicio/, { timeout: 30000 });
  await settled(p);
  ok("se entra con la contraseña nueva", new URL(p.url()).pathname);

  // ---------- y la vieja deja de servir ----------
  /*
   * La otra mitad, y la que de verdad importa si alguien pidió el cambio porque le robaron la
   * contraseña: cambiarla sin invalidar la anterior no es cambiarla.
   */
  const conLaVieja = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );
  if (conLaVieja.ok) throw new Error("la contraseña vieja sigue sirviendo");
  ok("la contraseña vieja deja de servir");

  // ---------- un código no se puede usar dos veces ----------
  await p.goto(BASE + `/recuperar/confirmar?oobCode=${encodeURIComponent(emitted.oobCode)}`, {
    waitUntil: "domcontentloaded",
  });
  await settled(p);
  await p.getByRole("heading", { level: 1, name: /El enlace no sirve/i }).waitFor({ timeout: 20000 });
  ok("el mismo código no se puede usar otra vez");

  // ---------- una pestaña del portal abierta mientras cambian la contraseña ----------
  /*
   * El fallo que se reportó desde la pantalla, y el que ningún test unitario alcanza.
   *
   * Restablecer la contraseña **revoca los refresh tokens**, así que cualquier `onSnapshot` que
   * siga enganchado —la campana, la página de un proceso, la de un arriendo— recibe
   * `permission-denied`. No es una regla negando nada: es la sesión acabándose. `isSigningOut()`
   * no lo cubre porque es una bandera de módulo y aquí la sesión muere sin que esta pestaña haya
   * tocado nada.
   *
   * Se afirma sobre la consola, que es donde dolía: el error decía "live notifications stopped" y
   * mandaba a mirar las reglas desplegadas y los índices, que es exactamente donde no estaba.
   */
  const portalProblems = [];
  const portalCtx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  const portal = watch(await portalCtx.newPage(), "portal", portalProblems);

  await portal.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(portal);
  await portal.getByLabel("Correo electrónico").fill(email);
  await portal.getByLabel("Contraseña").fill(NEW_PASSWORD);
  await portal.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
  await portal.waitForURL(/completar-perfil|\/inicio/, { timeout: 30000 });
  await settled(portal);

  // Otra pestaña cambia la contraseña de esa misma cuenta.
  await p.goto(BASE + "/recuperar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.getByLabel("Correo electrónico").fill(email);
  await p.getByRole("button", { name: /Enviarme el enlace/i }).click();
  await p.getByRole("heading", { level: 1, name: /Revisa tu correo/i }).waitFor({ timeout: 20000 });

  const segundo = await latestOobCode();
  if (!segundo?.oobCode) throw new Error("no se emitió el segundo código");
  await p.goto(BASE + `/recuperar/confirmar?oobCode=${encodeURIComponent(segundo.oobCode)}`, {
    waitUntil: "domcontentloaded",
  });
  await settled(p);
  await p.getByLabel("Contraseña nueva").fill("OtraClaveMas7");
  await p.getByRole("button", { name: /Guardar la contraseña/i }).click();
  await p.getByRole("heading", { level: 1, name: /Contraseña actualizada/i }).waitFor({ timeout: 25000 });

  // Se le da tiempo a la pestaña del portal a recibir la negación y reaccionar.
  await portal.waitForTimeout(6000);

  const gritó = portalProblems.filter((problem) => /live (notifications|updates) stopped/i.test(problem));
  if (gritó.length) {
    throw new Error(`la sesión se acabó y la consola lo reportó como fallo de reglas: ${gritó[0]}`);
  }
  ok("con la sesión revocada, la suscripción no acusa un fallo de reglas");

  await portalCtx.close();

  // ---------- un teléfono ----------
  await p.goto(BASE + "/recuperar", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.setViewportSize({ width: 390, height: 844 });
  await settled(p);
  await assertNoHorizontalScroll(p, "/recuperar a 390px");
  ok("no hay desplazamiento horizontal a 390px");

  /*
   * Este driver **provoca** tres peticiones fallidas a propósito: un código inventado, la URL sin
   * código y el código ya gastado. El emulador de Auth responde 400 a cada una —que es la respuesta
   * correcta— y el navegador anota cada 400 en la consola, así que `assertQuiet` fallaría por el
   * producto funcionando bien.
   *
   * Se filtra esa forma exacta y **nada más**: cualquier otro error de consola, y cualquier
   * `pageerror`, sigue tumbando el driver. Filtrar aquí y no dentro de `watch()` es deliberado —
   * un cambio en `lib.mjs` es un cambio en los cuarenta drivers, y en los otros treinta y nueve un
   * 400 sí es una noticia.
   */
  const EXPECTED_400 = /Failed to load resource: the server responded with a status of 400/;
  const unexpected = problems.filter((problem) => !EXPECTED_400.test(problem));
  if (problems.length === unexpected.length) {
    throw new Error("no se registró ningún 400: los códigos muertos dejaron de fallar en el emulador");
  }
  ok("los códigos muertos fallan contra Firebase, no en el cliente", `${problems.length - unexpected.length} respuestas 400`);

  assertQuiet(unexpected);
  console.log("\npassword-reset: OK");
} finally {
  await b.close();
}
