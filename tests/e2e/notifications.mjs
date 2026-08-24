import { chromium } from "playwright";
import { advanceButton, BASE, config, createAccount, fixtures, ok, settled } from "./lib.mjs";
import { openSession as libOpenSession } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
// Publicar termina en el listado: el enlace del anuncio sale de la tarjeta que acaba de aparecer.
async function listingPathOf(page, title) {
  const href = await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: title })
    .first()
    .getAttribute("href");
  if (!href) throw new Error(`no encontré el anuncio de "${title}" en el listado`);
  return href;
}
// `delivered+algo@resend.dev` es la bandeja de pruebas del proveedor: entrega de verdad, no le
// escribe a nadie y no genera rebotes contra la reputación del dominio.
const ownerEmail = `delivered+owner-${STAMP}@resend.dev`;
const tenantEmail = `delivered+renter-${STAMP}@resend.dev`;
for (const email of [ownerEmail, tenantEmail]) {
  await createAccount(API_KEY, email);
}
const b = await chromium.launch();
const problems = [];
const bell = (p) => p.getByRole("button", { name: /^Notificaciones/ });

/*
 * El sonido se prueba contando osciladores, no escuchandolos.
 *
 * `playChime` no programa nada si el navegador no dejo correr el contexto de audio, asi que el
 * contador distingue las dos cosas que importan y que ninguna asercion sobre CSS puede ver: que
 * sono, y que NO sono cuando no era una noticia. Se instala con `addInitScript`, asi que se
 * reinicia en cada navegacion — de ahi que cada bloque tome su propia linea base.
 */
const chimeCounter = () => {
  window.__madChimes = 0;
  const Audio = window.AudioContext;
  if (!Audio) return;
  const create = Audio.prototype.createOscillator;
  Audio.prototype.createOscillator = function (...args) {
    window.__madChimes += 1;
    return create.apply(this, args);
  };
};
const chimes = (page) => page.evaluate(() => window.__madChimes ?? -1);
const soundToggle = (scope, on = true) =>
  scope.getByRole("button", {
    name: on ? "Silenciar las notificaciones" : "Activar el sonido de las notificaciones",
  });

/*
 * Abre el panel de la campana, reintentando el clic.
 *
 * `settled()` dice que el esqueleto se fue, no que alguien escuche. El panel lo pinta el cliente,
 * asi que un clic que llega antes de que React enganche su `onClick` **se pierde**: Playwright no
 * lo reintenta, porque el boton ya era accionable y el clic si ocurrio. El sintoma es un
 * `waitFor` de 30s sobre un dialogo que nunca abre, y aparece solo cuando el servidor esta
 * ocupado — este driver pasaba suelto y se caia dentro de la suite completa, en esta misma linea,
 * desde antes de que existiera el sonido.
 *
 * Reintentar el clic es la espera correcta, no una asercion mas debil: sigue exigiendo que el
 * panel abra. Solo vuelve a hacer clic cuando el panel NO esta visible, asi que nunca lo cierra
 * por accidente.
 */
async function openBell(page, scope) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await bell(page).click();
    try {
      await scope.waitFor({ state: "visible", timeout: 3000 });
      return;
    } catch {
      // El clic llego antes de la hidratacion. Se vuelve a intentar.
    }
  }
  throw new Error("la campana no abrio el panel en 10 intentos");
}

/*
 * Abrir y cerrar la campana hace dos cosas de una: prueba que React ya esta escuchando y le da al
 * navegador el gesto sin el cual no deja crear un AudioContext. Un `keydown` suelto no sirve:
 * llegaria antes de que el efecto que lo escucha se haya montado, y ese evento tampoco se
 * reintenta.
 */
async function unlockAudio(page, scope) {
  await openBell(page, scope);
  await page.keyboard.press("Escape");
  await scope.waitFor({ state: "hidden", timeout: 5000 });
}
const openSession = (email, name) => libOpenSession(b, { email, name, problems });

const owner = await openSession(ownerEmail, "Marta Propietaria Gómez");

// La campana existe en escritorio y arranca en cero.
if (!(await bell(owner).isVisible())) throw new Error("no hay campana en escritorio");
if (!(await bell(owner).getAttribute("aria-label")).includes("ninguna sin leer")) throw new Error("arranca con contador");
ok("la campana está en la barra y arranca sin nada");
const panel = owner.getByRole("dialog", { name: "Notificaciones" });
await openBell(owner, panel);
if (!(await panel.innerText()).includes("Nada por ahora")) throw new Error("el vacío no explica nada");
ok("vacía, explica que ahí se avisará");
// El interruptor del sonido está donde uno está parado cuando el ruido molesta, y también cuando
// no hay nada en la lista: un ruido sin forma de apagarlo se apaga en el sistema operativo, y
// entonces el recordatorio de diez minutos antes de la entrevista llega apagado también.
if (!(await soundToggle(panel).isVisible())) throw new Error("no hay cómo silenciar la campana");
ok("y trae el interruptor del sonido");
await owner.keyboard.press("Escape");
await panel.waitFor({ state: "hidden", timeout: 5000 });
ok("Escape la cierra");

// Publicar.
await owner.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await owner.getByLabel("Descripción").fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await owner.getByLabel("Área (m²)").fill("70");
await owner.getByLabel("Habitaciones").fill("2");
await owner.getByLabel("Baños").fill("2");
await owner.getByLabel("Estrato").click(); await owner.getByRole("option", { name: "Estrato 4" }).click();
await owner.getByLabel("Parqueadero").click(); await owner.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await owner.getByLabel("Duración mínima").click(); await owner.getByRole("option", { name: "6 meses", exact: true }).click();
await owner.getByLabel("Departamento").click(); await owner.getByRole("option", { name: "Caldas", exact: true }).click();
await owner.getByLabel("Ciudad").click(); await owner.getByRole("option", { name: "Manizales", exact: true }).click();
await owner.getByLabel("Barrio").fill("Palermo");
await owner.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await owner.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await owner.getByLabel("Canon mensual (COP)").click(); await owner.keyboard.type("1800000");
await owner.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await owner.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await owner.getByRole("button", { name: /Publicar inmueble/i }).click();
await owner.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(owner);
const listingPath = await listingPathOf(owner, `Apartamento con balcón en Palermo ${STAMP}`);

// La campana suena cuando algo llega a una página que YA está abierta, así que el propietario se
// queda en /inicio antes de que el inquilino se postule. Recargar después no sirve para probarlo:
// lo que llega en el primer snapshot es lo que ya estaba en pantalla, y eso no es una noticia.
await owner.addInitScript(chimeCounter);
await owner.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(owner);
await unlockAudio(owner, panel);

const box = await bell(owner).boundingBox();
if (box.height < 44 || box.width < 44) {
  throw new Error(`la campana mide ${Math.round(box.width)}×${Math.round(box.height)}px: por debajo de 44`);
}
ok("la campana es un control, no un icono suelto", `${Math.round(box.width)}×${Math.round(box.height)}px`);
// Se compara el color calculado con el de después, no contra un hex: el token está en
// globals.css y repetirlo aquí sería una segunda copia de la decisión.
const quiet = await bell(owner).evaluate((el) => getComputedStyle(el).backgroundColor);

// El inquilino se postula.
const tenant = await openSession(tenantEmail, "Ana Inquilina Pérez");
const tenantPanel = tenant.getByRole("dialog", { name: "Notificaciones" });
await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
await tenant.getByRole("link", { name: "Postularme" }).click();
await tenant.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(tenant);
await tenant.getByLabel("Número de documento").fill("1053812345");
await tenant.getByLabel("Dónde trabajas").fill("Crehana");
await tenant.getByLabel("Ingresos mensuales (COP)").click(); await tenant.keyboard.type("6000000");
await tenant.getByLabel("Personas que vivirían ahí").fill("2");
await tenant.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await tenant.getByLabel("Qué relación tienen").fill("Jefe directo");
await tenant.getByLabel("Teléfono de tu referencia").fill("3009876543");
await tenant.getByLabel("Cuándo te mudarías").fill("2026-10-01");
await tenant.getByRole("button", { name: /Enviar postulación/i }).click();
await tenant.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(tenant);
const processUrl = tenant.url();
const applicationId = new URL(processUrl).pathname.split("/").pop();

// El propietario recibe el aviso sin recargar: suena, el control cambia y lo dice en voz alta.
await owner.waitForFunction(() => (window.__madChimes ?? 0) >= 2, null, { timeout: 25000 });
ok("lo que llega a una página abierta suena", `${await chimes(owner)} osciladores`);
await owner.waitForFunction(() => {
  const el = [...document.querySelectorAll("button")].find((n) => (n.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return el && el.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 20000 });
const loud = await bell(owner).evaluate((el) => getComputedStyle(el).backgroundColor);
if (loud === quiet) throw new Error(`con algo sin leer la campana se ve igual que vacía: ${loud}`);
ok("el control entero cambia, no sólo una calcomanía en la esquina", `${quiet} → ${loud}`);
const spoken = await owner.getByRole("status").filter({ hasText: "sin leer" }).innerText();
if (!spoken.includes("1 notificación sin leer")) throw new Error("el lector de pantalla no se enteró: " + spoken);
ok("y lo dice para quien escucha la página en vez de mirarla", spoken);

// El propietario recibe el aviso.
await owner.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && b.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 20000 });
ok("al propietario le suena la campana con la postulación", "1 sin leer");
await openBell(owner, panel);
const first = await panel.locator("li a").first().innerText();
if (!first.includes("Nueva postulación")) throw new Error("el aviso no dice qué pasó: " + first);
if (!first.includes("Ana Inquilina Pérez")) throw new Error("no dice quién");
ok("el aviso dice qué pasó y quién", first.split("\n")[0]);
await owner.screenshot({ path: `${SHOT_DIR}/campana.png` });

// Abrir el panel reescribe `readAt` en cada notificación sin leer, y eso llega como un cambio en
// la misma consulta a la que está suscrita la campana. No es una noticia y no puede sonar: es el
// caso que `domain/arrivals` existe para distinguir.
await panel.getByText("Al día").waitFor({ state: "visible", timeout: 20000 });
if ((await chimes(owner)) !== 0) throw new Error("abrir la campana la hizo sonar por lo que ya había leído");
// Y ese cero significa "no sonó", no "el navegador no dejaba sonar": encender el sonido suena, así
// que si el contador sube aquí el camino de audio estaba vivo en este mismo momento.
await soundToggle(panel).click();
await soundToggle(panel, false).click();
await owner.waitForFunction(() => (window.__madChimes ?? 0) >= 2, null, { timeout: 10000 });
ok("reescribir readAt no vuelve a sonar, y el audio sí estaba vivo", `${await chimes(owner)} osciladores`);

// El enlace lleva a la etapa, no al principio de la página.
const href = await panel.locator("li a").first().getAttribute("href");
if (href !== `/contratos/${applicationId}#etapa-submitted`) throw new Error("el enlace no apunta a la etapa: " + href);
await panel.locator("li a").first().click();
await owner.waitForURL(/#etapa-submitted$/, { timeout: 20000 });
await settled(owner);
const onTarget = await owner.evaluate(() => {
  const el = document.getElementById("etapa-submitted");
  if (!el) return "no existe el ancla";
  const top = el.getBoundingClientRect().top;
  return top >= -5 && top < window.innerHeight ? "visible" : `fuera de pantalla (${Math.round(top)}px)`;
});
if (onTarget !== "visible") throw new Error("el ancla no queda a la vista: " + onTarget);
ok("el enlace aterriza en la etapa, a la vista", href);

// Abrirla la deja leída.
await owner.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(owner);
if (!(await bell(owner).getAttribute("aria-label")).includes("ninguna sin leer")) throw new Error("sigue marcando sin leer");
ok("abrirla la marca como leída y el contador se apaga");

// El interruptor se prueba contra una noticia de verdad, no contra su propia etiqueta: el
// inquilino se queda en /inicio con el sonido apagado y el propietario avanza la etapa.
await tenant.addInitScript(chimeCounter);
await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
await unlockAudio(tenant, tenantPanel);
await openBell(tenant, tenantPanel);
await soundToggle(tenantPanel).click();
if ((await chimes(tenant)) !== 0) throw new Error("silenciar hizo ruido");
ok("silenciar no suena");
await soundToggle(tenantPanel, false).click();
await tenant.waitForFunction(() => (window.__madChimes ?? 0) >= 2, null, { timeout: 10000 });
ok("encenderlo sí: un ajuste de sonido cuyo efecto se descubre horas después no se usa");
await soundToggle(tenantPanel).click();
const muted = await chimes(tenant);
await tenant.keyboard.press("Escape");
await tenantPanel.waitFor({ state: "hidden", timeout: 5000 });

// Avanzar avisa al inquilino, y el texto es una tarea, no un estado.
await owner.goto(BASE + `/contratos/${applicationId}`, { waitUntil: "domcontentloaded" });
await settled(owner);
await advanceButton(owner).click();
await owner.waitForFunction(() => document.body.innerText.includes("Paso 2 de 7"), null, { timeout: 20000 });
await tenant.waitForFunction(() => {
  const el = [...document.querySelectorAll("button")].find((n) => (n.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return el && el.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 25000 });
if ((await chimes(tenant)) !== muted) throw new Error("silenciada y sonó igual");
ok("silenciada, la noticia llega y el sonido no", `${muted} osciladores, sin subir`);

await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
await tenant.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && b.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 20000 });
await openBell(tenant, tenantPanel);
const advanced = await tenantPanel.locator("li a").first().innerText();
if (!/documentos/i.test(advanced)) throw new Error("avanzar a datos no pide documentos: " + advanced);
const tenantHref = await tenantPanel.locator("li a").first().getAttribute("href");
if (tenantHref !== `/contratos/${applicationId}#etapa-tenant-data`) throw new Error("no apunta a la etapa nueva: " + tenantHref);
ok("avanzar a 'Datos y documentos' le pide documentos al inquilino", tenantHref);

// Rechazar avisa al inquilino.
await owner.getByRole("button", { name: /Rechazar postulación/i }).click();
const dialog = owner.getByRole("dialog", { name: /Rechazar/ });
await dialog.waitFor({ state: "visible" });
await dialog.getByRole("button", { name: "Rechazar postulación" }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Rechazada"), null, { timeout: 20000 });
await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
await openBell(tenant, tenantPanel);
const rejected = await tenantPanel.locator("li a").first().innerText();
if (!rejected.includes("rechazada")) throw new Error("no avisa el rechazo: " + rejected);
if (!rejected.includes("Datos y documentos")) throw new Error("no dice en qué etapa");
ok("el rechazo avisa, y dice en qué etapa se detuvo");

// Nadie ve las notificaciones ajenas.
const mine = await tenantPanel.locator("li a").allInnerTexts();
if (mine.some((t) => t.includes("Nueva postulación"))) throw new Error("¡el inquilino ve las del propietario!");
ok("cada quien ve solo las suyas");

// Móvil.
await tenant.setViewportSize({ width: 390, height: 844 });
await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
if (!(await bell(tenant).isVisible())) throw new Error("no hay campana en móvil");
await openBell(tenant, tenantPanel);
const overflow = await tenant.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await tenant.screenshot({ path: `${SHOT_DIR}/campana-movil.png` });
if (overflow) throw new Error("el panel desborda a 390px");
ok("390px: la campana abre sin desbordar");

// El correo que sale desde localhost tiene que apuntar a localhost, o no hay forma de probarlo.
const enviados = await fetch("https://api.resend.com/emails?limit=5", {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
}).then((r) => (r.ok ? r.json() : { data: [] }));
const mio = (enviados.data ?? []).find((e) => (e.to ?? []).some((t) => t.includes(STAMP)));
if (!mio) console.log("  (no pude leer el correo enviado; se verifica aparte)");
else {
  const detalle = await fetch(`https://api.resend.com/emails/${mio.id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  }).then((r) => r.json());
  const enlace = (detalle.text ?? "").match(/https?:\/\/\S+/)?.[0] ?? "";
  if (!enlace.startsWith(BASE)) throw new Error(`el correo local apunta a otro sitio: ${enlace}`);
  if (!enlace.includes("#etapa-")) throw new Error("el enlace perdió la etapa: " + enlace);
  ok("el correo enviado desde localhost apunta a localhost", enlace.replace(BASE, "") ? enlace : enlace);
}

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
console.log("APPLICATION_ID=" + applicationId);
await b.close();
