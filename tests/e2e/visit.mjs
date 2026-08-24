/**
 * La visita al inmueble, entera: el propietario propone día y punto de encuentro, al inquilino le
 * llega el aviso, confirma, va, y **él** dice si le interesa — que es lo único que deja seguir.
 *
 * Tres cosas que solo se pueden comprobar aquí:
 *
 * 1. **Que un "no me interesa" para el proceso.** Es lo que separa una etapa que filtra de una que
 *    solo se registra, y es el motivo de que exista.
 * 2. **Que el punto de encuentro no sale del producto.** Es el único campo del proceso que entrega
 *    la dirección, y la afirmación es sobre el correo y la campana, que es por donde se escaparía.
 * 3. **Que el propietario no puede responder por el inquilino.** Quien dice si un apartamento
 *    sirve es quien lo fue a ver.
 */
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  adminDb,
  BASE,
  config,
  createAccount,
  declareReferenceAuthorized,
  fixtures,
  LOGIN_PATH,
  MONTHS,
  ok,
  onStage,
  settled,
  stepLabel,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

const db = adminDb();
const problemas = [];
const b = await chromium.launch();

const DIRECCION = "Calle 60 #10-20";
const PUNTO = "Cra 23 #14-08, portería de la torre 2";

async function cuenta(email) {
  await createAccount(API_KEY, email);
}

async function entrar(email, nombre) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
  p.on("pageerror", (e) => problemas.push(`${nombre}: ${e}`));
  await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.waitForFunction(
    () => {
      const f = document.querySelector("form");
      return f && Object.keys(f).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout: 20000 },
  );
  await p.getByLabel("Correo electrónico").fill(email);
  await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
  await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
  await p.waitForURL(/completar-perfil/, { timeout: 25000 });
  await settled(p);
  await p.getByLabel("Nombre completo").fill(nombre);
  await p.getByLabel("Teléfono").fill("3001234567");
  await p.getByLabel("Día", { exact: true }).fill("10");
  await p.getByLabel("Mes", { exact: true }).click();
  await p.getByRole("option", { name: MONTHS[4], exact: true }).click();
  await p.getByLabel("Año", { exact: true }).fill("1990");
  await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
  for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
    await p.getByLabel(l).click();
    await p.getByRole("option", { name: o }).first().click();
  }
  await acceptLegalConsents(p);
  await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
  await p.waitForURL(/\/inicio/, { timeout: 30000 });
  await settled(p);
  return p;
}

const dueñoEmail = `visdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `visinq-${STAMP}@miarriendodirecto.test`;
await cuenta(dueñoEmail);
await cuenta(inqEmail);
const dueño = await entrar(dueñoEmail, "Ana Propietaria Pérez");
const inq = await entrar(inqEmail, "Carlos Inquilino Ramírez");

// ---------- un inmueble y una postulación ----------
await dueño.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await dueño
  .getByLabel("Descripción")
  .fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await dueño.getByLabel("Área (m²)").fill("70");
await dueño.getByLabel("Habitaciones").fill("2");
await dueño.getByLabel("Baños").fill("2");
await dueño.getByLabel("Estrato").click();
await dueño.getByRole("option", { name: "Estrato 4" }).click();
await dueño.getByLabel("Parqueadero").click();
await dueño.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await dueño.getByLabel("Departamento").click();
await dueño.getByRole("option", { name: "Caldas", exact: true }).click();
await dueño.getByLabel("Ciudad").click();
await dueño.getByRole("option", { name: "Manizales", exact: true }).click();
await dueño.getByLabel("Barrio").fill("Palermo");
await dueño.getByLabel("Dirección", { exact: true }).fill(DIRECCION);
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await dueño.getByLabel("Canon mensual (COP)").click();
await dueño.keyboard.type("1800000");
await dueño.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await dueño.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await dueño.getByRole("button", { name: /Publicar inmueble/i }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);
const href = await dueño
  .locator("li", { hasText: `Apartamento con balcón en Palermo ${STAMP}` })
  .getByRole("link")
  .first()
  .getAttribute("href");

await inq.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("link", { name: "Postularme" }).click();
await inq.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(inq);
await inq.getByLabel("Número de documento").fill("1053812345");
await inq.getByLabel("Dónde trabajas").fill("Crehana");
await inq.getByLabel("Ingresos mensuales (COP)").click();
await inq.keyboard.type("6000000");
await inq.getByLabel("Personas que vivirían ahí").fill("2");
await inq.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await inq.getByLabel("Qué relación tienen").fill("Jefe directo");
await inq.getByLabel("Teléfono de tu referencia").fill("3009876543");
await declareReferenceAuthorized(inq);
await inq
  .getByLabel("Cuándo te mudarías")
  .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
const applicationId = new URL(proceso).pathname.split("/").pop();
ok("proceso creado", new URL(proceso).pathname);

/*
 * La visita es la segunda etapa, así que el propietario llega a ella con el botón del producto.
 * Es la única etapa de este driver, y se entra a mano y no por detrás precisamente porque avanzar
 * hasta ella es parte de lo que se comprueba.
 */
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.locator('[data-slot="stage-actions"]').getByRole("button", { name: /Continuar a/i }).click();
await onStage(dueño, "visit");
ok("desde la postulación se avanza a la visita", stepLabel("visit"));

// ---------- sin proponer nada, no se puede avanzar ----------
{
  const bloqueado = await dueño
    .getByRole("button", { name: /Continuar a/i })
    .first()
    .getAttribute("aria-disabled");
  if (bloqueado !== "true") throw new Error("se puede avanzar sin haber agendado la visita");
  if (!(await dueño.evaluate(() => document.body.innerText)).includes("Propón un día")) {
    throw new Error("no dice por qué está bloqueado");
  }
  ok("sin agendar, el avance está bloqueado y dice por qué");
}

// ---------- el propietario propone día, hora y punto de encuentro ----------
await dueño.getByRole("button", { name: /Visita al inmueble/i }).first().click();
const dia = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
await dueño.locator("#visit-day").fill(dia);
await dueño.locator("#visit-time").fill("15:00");

/*
 * La dirección que dio al publicar se le ofrece, en vez de pedírsela otra vez. Vive en
 * `properties/{id}/private/location` y solo la ve el dueño: que el botón la traiga es la
 * comprobación de que el producto le devuelve algo que ya tenía.
 */
{
  const usarDireccion = dueño.getByRole("button", { name: /Usar la dirección del inmueble/i });
  if ((await usarDireccion.count()) === 0) {
    throw new Error("no le ofrece al propietario la dirección que ya dio al publicar");
  }
  if (!(await usarDireccion.innerText()).includes(DIRECCION)) {
    throw new Error("la dirección ofrecida no es la del inmueble");
  }
  await usarDireccion.click();
  if ((await dueño.locator("#visit-point").inputValue()) !== DIRECCION) {
    throw new Error("pulsarlo no rellena el punto de encuentro");
  }
  ok("le ofrece la dirección que ya dio al publicar, y la pone en el campo");
}

// Pero lo que se guarda es lo que él escriba: "en la portería" es lo que sirve para llegar.
await dueño.locator("#visit-point").fill(PUNTO);
await dueño.locator("#visit-note").fill("Timbra en el 502. Hay parqueadero de visitantes.");
{
  const caja = await dueño
    .locator("div")
    .filter({ hasText: "Propón la visita al inmueble" })
    .last()
    .boundingBox();
  await dueño.screenshot({
    path: `${SHOT_DIR}/visita-form.png`,
    clip: { x: caja.x - 10, y: caja.y - 10, width: caja.width + 20, height: Math.min(caja.height + 20, 700) },
  });
}
await dueño.getByRole("button", { name: /Proponer y avisar/i }).click();
await dueño.waitForFunction(() => document.body.innerText.includes("Sin confirmar"), null, {
  timeout: 20000,
});
ok("el propietario propone día, hora y punto de encuentro");

// ---------- el propietario no puede responder por el inquilino ----------
{
  const suyo = await dueño.evaluate(() => document.body.innerText);
  if (/Me interesa\b/.test(suyo)) {
    throw new Error("¡el propietario puede decir por el inquilino si el inmueble le interesa!");
  }
  ok("el propietario no puede responder por el inquilino");
}

// ---------- al inquilino le llega, y ve dónde es ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Visita al inmueble/i }).first().click();
{
  const visto = await inq.evaluate(() => document.body.innerText);
  if (!visto.includes(PUNTO)) throw new Error("el inquilino no ve dónde es: " + visto.slice(0, 300));
  if (!visto.includes("Timbra en el 502")) throw new Error("no ve el mensaje del propietario");
  if (/Me interesa\b/.test(visto)) {
    throw new Error("le pide su respuesta antes de haber confirmado la visita");
  }
  const caja = await inq.locator("li#etapa-visit").boundingBox();
  await inq.screenshot({
    path: `${SHOT_DIR}/visita-inquilino.png`,
    clip: { x: caja.x, y: caja.y, width: caja.width, height: Math.min(caja.height, 620) },
  });
  ok("el inquilino ve cuándo y dónde, y todavía no le piden su respuesta");
}

/*
 * **El punto de encuentro no sale del producto.** Es el único campo del proceso que entrega la
 * dirección, así que se lee en la página y detrás de la sesión: el aviso dice cuándo es y manda a
 * mirar dónde. Un correo se reenvía, se cita y se queda abierto en un portátil.
 */
await inq.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
{
  /*
   * Se lee **el panel**, no `document.body.innerText`: detrás de la campana está la página, y ahí
   * el punto de encuentro sí tiene que estar. Leyendo el cuerpo entero esta aserción se pone roja
   * por la página que está tapando, que es exactamente donde ese dato es correcto.
   */
  const panel = inq.getByRole("dialog", { name: "Notificaciones" });
  await panel.waitFor({ state: "visible", timeout: 10000 });
  const campana = await panel.innerText();
  if (!campana.includes("Te proponen un día para conocer el inmueble")) {
    throw new Error("no llegó la notificación de la visita: " + campana.slice(0, 300));
  }
  if (campana.includes(PUNTO) || campana.includes(DIRECCION)) {
    throw new Error("¡el punto de encuentro se fue en la notificación!: " + campana.slice(0, 300));
  }
  // Y sí dice cuándo, que es lo que la hace útil sin dar la dirección.
  if (!/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(campana)) {
    throw new Error("el aviso no dice cuándo es: " + campana.slice(0, 300));
  }
  ok("el aviso dice cuándo es y nunca dónde");
}
await inq.keyboard.press("Escape");
await inq.getByRole("dialog", { name: "Notificaciones" }).waitFor({ state: "hidden", timeout: 5000 });

// ---------- pide otro día, y luego confirma ----------
await inq.getByRole("button", { name: /No puedo ese día/i }).click();
await inq.locator("#visit-decline").fill("Los sábados por la mañana.");
await inq.getByRole("button", { name: /Enviar y pedir otro día/i }).click();
await inq.waitForFunction(() => document.body.innerText.includes("Sin día"), null, { timeout: 20000 });
ok("el inquilino puede decir que ese día no le sirve");

await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByRole("button", { name: /Visita al inmueble/i }).first().click();
{
  const leido = await dueño.evaluate(() => document.body.innerText);
  if (!leido.includes("Los sábados por la mañana")) {
    throw new Error("el propietario no lee por qué no le sirve");
  }
  ok("y el propietario lee por qué");
}

// Proponer otra vez reemplaza el arreglo entero, y el punto de encuentro se conserva.
await dueño.locator("#visit-day").fill(new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10));
await dueño.locator("#visit-time").fill("10:00");
if ((await dueño.locator("#visit-point").inputValue()) !== PUNTO) {
  throw new Error("al proponer otro día se pierde el punto de encuentro");
}
await dueño.getByRole("button", { name: /Proponer y avisar/i }).click();
await dueño.waitForFunction(() => document.body.innerText.includes("Sin confirmar"), null, {
  timeout: 20000,
});
ok("proponer otro día conserva el punto de encuentro y vuelve a pedir confirmación");

await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Visita al inmueble/i }).first().click();
await inq.getByRole("button", { name: /Confirmar la visita/i }).click();
await inq.waitForFunction(() => document.body.innerText.includes("Confirmada"), null, { timeout: 20000 });
ok("el inquilino confirma el nuevo día");

// ---------- confirmada, el propietario sigue bloqueado: falta que el inquilino vaya y responda ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
{
  const estado = await dueño
    .getByRole("button", { name: /Continuar a/i })
    .first()
    .getAttribute("aria-disabled");
  if (estado !== "true") throw new Error("avanza con la visita confirmada pero sin respuesta");
  const dice = await dueño.evaluate(() => document.body.innerText);
  if (!dice.includes("tiene que decir si el inmueble le interesa")) {
    throw new Error("no explica que falta la respuesta del inquilino: " + dice.slice(0, 400));
  }
  ok("confirmada pero sin respuesta, el proceso sigue sin poder avanzar");
}

// ---------- y aquí está la etapa: un "no me interesa" para el proceso ----------
await inq.getByRole("button", { name: /^No me interesa$/i }).click();
await inq.waitForFunction(
  () => document.body.innerText.includes("No me interesa el inmueble"),
  null,
  { timeout: 20000 },
);
ok("el inquilino puede decir que el inmueble no le interesa");

await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
{
  const estado = await dueño
    .getByRole("button", { name: /Continuar a/i })
    .first()
    .getAttribute("aria-disabled");
  if (estado !== "true") throw new Error("¡el proceso avanza con el inquilino diciendo que no!");
  const dice = await dueño.evaluate(() => document.body.innerText);
  if (!dice.includes("no le interesó el inmueble")) {
    throw new Error("no dice que el inquilino dijo que no: " + dice.slice(0, 400));
  }
  // Y dice cómo salir de ahí, en vez de dejar el proceso clavado sin explicación.
  if (!/rechazar la postulación/i.test(dice)) throw new Error("no dice cómo se sale de ahí");
  ok("con un 'no me interesa' el proceso no avanza, y dice cómo salir de ahí");
}

await dueño.getByRole("button", { name: /^Campana|Notificaciones/i }).first().click();
{
  const panel = dueño.getByRole("dialog", { name: "Notificaciones" });
  await panel.waitFor({ state: "visible", timeout: 10000 });
  const avisos = await panel.innerText();
  if (!avisos.includes("Al inquilino no le interesó el inmueble")) {
    throw new Error("al propietario no le avisaron de la respuesta: " + avisos.slice(0, 300));
  }
  ok("y al propietario le avisan");
}
await dueño.keyboard.press("Escape");
await dueño.getByRole("dialog", { name: "Notificaciones" }).waitFor({ state: "hidden", timeout: 5000 });

// ---------- cambiar de opinión ----------
await inq.getByRole("button", { name: /Cambiar lo que respondí/i }).click();
await inq.locator("#visit-verdict-note").fill("Lo pensé mejor: la luz de la tarde es buenísima.");
await inq.getByRole("button", { name: /^Me interesa$/i }).click();
await inq.waitForFunction(
  () => document.body.innerText.includes("Me interesa el inmueble"),
  null,
  { timeout: 20000 },
);
ok("y puede cambiar lo que respondió");

// ---------- ahora sí avanza ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño
  .waitForFunction(
    () => {
      const boton = [...document.querySelectorAll("button")].find((b) =>
        /Continuar a/i.test(b.textContent ?? ""),
      );
      return boton && boton.getAttribute("aria-disabled") !== "true";
    },
    null,
    { timeout: 15000 },
  )
  .catch(() => {
    throw new Error("sigue bloqueado con el inquilino diciendo que le interesa");
  });
await dueño.getByRole("button", { name: /Visita al inmueble/i }).first().click();
{
  const leido = await dueño.evaluate(() => document.body.innerText);
  if (!leido.includes("la luz de la tarde es buenísima")) {
    throw new Error("el propietario no lee lo que le pareció");
  }
}
await dueño.locator('[data-slot="stage-actions"]').getByRole("button", { name: /Continuar a/i }).click();
await onStage(dueño, "tenant_data", 25000);
ok("con el visto bueno del inquilino, el proceso avanza", stepLabel("tenant_data"));

// ---------- la etapa pasada conserva su panel, sin botones ----------
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Visita al inmueble/i }).first().click();
{
  const cerrada = await inq.evaluate(() => document.body.innerText);
  if (!cerrada.includes(PUNTO)) throw new Error("la etapa pasada perdió el registro de la visita");
  if (cerrada.includes("Cambiar lo que respondí")) {
    throw new Error("una etapa pasada sigue ofreciendo botones");
  }
  ok("la etapa pasada conserva el registro y no ofrece botones");
}

await inq.setViewportSize({ width: 390, height: 844 });
if (await inq.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
  throw new Error("scroll horizontal a 390px");
}
ok("390px sin scroll horizontal");

// ---------- lo que quedó escrito, leído del documento ----------
{
  const doc = (await db.collection("applications").doc(applicationId).get()).data();
  if (doc.visit.meetingPoint !== PUNTO) throw new Error("el punto de encuentro no se guardó");
  if (doc.visit.verdict.result !== "interested") throw new Error("la respuesta no se guardó");
  if (doc.stage !== "tenant_data") throw new Error("el proceso no quedó en la etapa siguiente");
  ok("el documento guarda el punto de encuentro, la respuesta y la etapa");
}

await dueño.screenshot({ path: `${SHOT_DIR}/visita.png`, fullPage: true });
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");

await b.close();
