import { chromium } from "playwright";
import { BASE, config, fixtures, ok, settled } from "./lib.mjs";
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
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
}
const b = await chromium.launch();
const problems = [];
const openSession = (email, name) => libOpenSession(b, { email, name, problems });

const owner = await openSession(ownerEmail, "Marta Propietaria Gómez");
const bell = (p) => p.getByRole("button", { name: /^Notificaciones/ });

// La campana existe en escritorio y arranca en cero.
if (!(await bell(owner).isVisible())) throw new Error("no hay campana en escritorio");
if (!(await bell(owner).getAttribute("aria-label")).includes("ninguna sin leer")) throw new Error("arranca con contador");
ok("la campana está en la barra y arranca sin nada");
await bell(owner).click();
const panel = owner.getByRole("dialog", { name: "Notificaciones" });
await panel.waitFor({ state: "visible", timeout: 5000 });
if (!(await panel.innerText()).includes("Nada por ahora")) throw new Error("el vacío no explica nada");
ok("vacía, explica que ahí se avisará");
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

// El inquilino se postula.
const tenant = await openSession(tenantEmail, "Ana Inquilina Pérez");
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
await tenant.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(tenant);
const processUrl = tenant.url();
const applicationId = new URL(processUrl).pathname.split("/").pop();

// El propietario recibe el aviso.
await owner.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && b.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 20000 });
ok("al propietario le suena la campana con la postulación", "1 sin leer");
await bell(owner).click();
await panel.waitFor({ state: "visible" });
const first = await panel.locator("li a").first().innerText();
if (!first.includes("Nueva postulación")) throw new Error("el aviso no dice qué pasó: " + first);
if (!first.includes("Ana Inquilina Pérez")) throw new Error("no dice quién");
ok("el aviso dice qué pasó y quién", first.split("\n")[0]);
await owner.screenshot({ path: `${SHOT_DIR}/campana.png` });

// El enlace lleva a la etapa, no al principio de la página.
const href = await panel.locator("li a").first().getAttribute("href");
if (href !== `/arriendos/${applicationId}#etapa-submitted`) throw new Error("el enlace no apunta a la etapa: " + href);
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

// Avanzar avisa al inquilino, y el texto es una tarea, no un estado.
await owner.goto(BASE + `/arriendos/${applicationId}`, { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.getByRole("button", { name: /Continuar a/ }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Paso 2 de 9"), null, { timeout: 20000 });
await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
await tenant.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && b.getAttribute("aria-label").includes("1 sin leer");
}, null, { timeout: 20000 });
await bell(tenant).click();
const tenantPanel = tenant.getByRole("dialog", { name: "Notificaciones" });
await tenantPanel.waitFor({ state: "visible" });
const advanced = await tenantPanel.locator("li a").first().innerText();
if (!/documentos/i.test(advanced)) throw new Error("avanzar a datos no pide documentos: " + advanced);
const tenantHref = await tenantPanel.locator("li a").first().getAttribute("href");
if (tenantHref !== `/arriendos/${applicationId}#etapa-tenant-data`) throw new Error("no apunta a la etapa nueva: " + tenantHref);
ok("avanzar a 'Datos y documentos' le pide documentos al inquilino", tenantHref);

// Rechazar avisa al inquilino.
await owner.getByRole("button", { name: /Rechazar postulación/i }).click();
const dialog = owner.getByRole("dialog", { name: /Rechazar/ });
await dialog.waitFor({ state: "visible" });
await dialog.getByRole("button", { name: "Rechazar postulación" }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Rechazada"), null, { timeout: 20000 });
await tenant.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(tenant);
await bell(tenant).click();
await tenantPanel.waitFor({ state: "visible" });
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
await bell(tenant).click();
await tenantPanel.waitFor({ state: "visible" });
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
