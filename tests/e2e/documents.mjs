import { chromium } from "playwright";
import {
  advanceButton,
  BASE,
  config,
  createAccount,
  declareReferenceAuthorized,
  fixtures,
  ok,
  settled,
} from "./lib.mjs";
import { openSession as libOpenSession } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2, pdf: PDF } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
/** Despliega el panel de una etapa si está plegado. */
async function abrirPanel(pagina, etapaId) {
  const boton = pagina.locator(`li#${etapaId} button[aria-expanded]`).first();
  if ((await boton.count()) && (await boton.getAttribute("aria-expanded")) === "false") {
    await boton.click();
    await pagina.waitForFunction(
      (id) => document.querySelector(`li#${id} button[aria-expanded]`)?.getAttribute("aria-expanded") === "true",
      etapaId,
      { timeout: 5000 },
    );
  }
}
const suAcordeonAbrir = (pagina) => abrirPanel(pagina, "etapa-tenant-data");
const ownerEmail = `owner-${STAMP}@miarriendodirecto.test`;
const tenantEmail = `renter-${STAMP}@miarriendodirecto.test`;
for (const email of [ownerEmail, tenantEmail]) {
  await createAccount(API_KEY, email);
}
const b = await chromium.launch();
const problems = [];
const openSession = (email, name) => libOpenSession(b, { email, name, problems });
const owner = await openSession(ownerEmail, "Marta Propietaria Gómez");
await owner.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(owner);
await owner.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await owner.getByLabel("Descripción").fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await owner.getByLabel("Área (m²)").fill("70");
await owner.getByLabel("Habitaciones").fill("2");
await owner.getByLabel("Baños").fill("2");
await owner.getByLabel("Estrato").click(); await owner.getByRole("option", { name: "Estrato 4" }).click();
await owner.getByLabel("Parqueadero").click(); await owner.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
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
const listingPath = await owner.locator("li", { hasText: `Apartamento con balcón en Palermo ${STAMP}` }).getByRole("link", { name: `Apartamento con balcón en Palermo ${STAMP}` }).first().getAttribute("href");

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
await declareReferenceAuthorized(tenant);
await tenant.getByLabel("Cuándo te mudarías").fill("2026-10-01");
await tenant.getByRole("button", { name: /Enviar postulación/i }).click();
await tenant.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(tenant);
const processUrl = tenant.url();
ok("postulación creada");

// El propietario avanza a la etapa 2.
await owner.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(owner);
await advanceButton(owner).click();
await owner.waitForFunction(() => document.body.innerText.includes("Paso 2 de 7"), null, { timeout: 20000 });
ok("el proceso tiene 7 etapas y llegó a la 2");

// ---------- la sección vive dentro de la etapa 2, como acordeón ----------
await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
const etapa2 = tenant.locator("li#etapa-tenant-data");
const acordeon = etapa2.getByRole("button", { name: /Tus documentos/ });
if (await acordeon.count() === 0) throw new Error("la sección no está dentro de la etapa 2");
const fueraDeLaEtapa = await tenant.locator("section#documentos").count();
if (fueraDeLaEtapa > 0) throw new Error("la sección sigue existiendo por fuera de la etapa");
ok("la sección está dentro del paso 2 y no por fuera");

const encabezados = await tenant.getByText("Tus documentos", { exact: false }).count();
if (encabezados !== 1) throw new Error(`el encabezado sale ${encabezados} veces`);
ok("un solo encabezado, no dos");

if (await acordeon.getAttribute("aria-expanded") !== "false") throw new Error("no arranca plegado");
if (await etapa2.getByLabel(/un solo archivo/i).count() !== 0) throw new Error("plegado, ya muestra el contenido");
const flechaCerrada = await etapa2.locator("button svg").first().getAttribute("class");
if (flechaCerrada.includes("rotate-180")) throw new Error("la flecha apunta hacia arriba estando plegado");
await acordeon.click();
await tenant.waitForFunction(() => {
  const b = document.querySelector("li#etapa-tenant-data button");
  return b && b.getAttribute("aria-expanded") === "true";
}, null, { timeout: 5000 });
const flechaAbierta = await etapa2.locator("button svg").first().getAttribute("class");
if (!flechaAbierta.includes("rotate-180")) throw new Error("la flecha no gira al abrir");
ok("arranca plegado, se despliega y la flecha gira");

// ---------- la cédula, en un archivo o en dos ----------
const unSolo = etapa2.getByLabel(/un solo archivo/i);
if (!(await unSolo.isVisible())) throw new Error("no ofrece la opción de un solo archivo");
let rotulos = await etapa2.locator("li p").allInnerTexts();
if (!rotulos.some((t) => t.includes("Cédula por el frente"))) throw new Error("por defecto no pide las dos caras");
await unSolo.click();
rotulos = await etapa2.locator("li p").allInnerTexts();
if (rotulos.some((t) => t.includes("Cédula por el frente"))) throw new Error("marcado, sigue pidiendo las dos caras");
if (!rotulos.some((t) => t.includes("Cédula (ambos lados)"))) throw new Error("no cambió a un solo archivo");
ok("el check cambia entre una cédula en dos caras y una en un archivo");

// ---------- mientras sube, se ve que está subiendo ----------
// La subida a Storage es rápida con un PDF de 300 bytes, así que se demora a propósito: sin eso
// la prueba pasaría por no llegar a mirar.
await tenant.route("**/firebasestorage.googleapis.com/**", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await route.continue();
});

// Sube la cédula como PDF y el resto.
await tenant.locator("#upload-id_both").setInputFiles([PDF]);
const subiendo = etapa2.getByRole("button", { name: /Subiendo/ });
await subiendo.first().waitFor({ state: "visible", timeout: 10000 });
const girando = await etapa2.locator("button svg.animate-spin").count();
if (girando === 0) throw new Error("no hay indicador girando mientras sube");
ok("mientras sube, el botón lo dice y hay un indicador girando", (await subiendo.first().innerText()).trim());
await tenant.waitForFunction(() => document.body.innerText.includes("1 de 5"), null, { timeout: 30000 });
ok("la cédula sube como PDF y se previsualiza", "un solo archivo");

await suAcordeonAbrir(owner);
// El propietario está en la misma pantalla y no ha recargado: el archivo debe aparecerle solo.
await owner.waitForFunction(
  () => document.querySelectorAll('button[aria-label^="Aprobar"]').length >= 1,
  null,
  { timeout: 30000 },
);
ok("el propietario ve llegar el archivo sin recargar");

await tenant.locator("#upload-payslip").setInputFiles([PDF, PDF, PDF]);
const conProgreso = await etapa2.getByRole("button", { name: /Subiendo \d+ de 3/ }).first().innerText().catch(() => "");
if (!/de 3/.test(conProgreso)) throw new Error("con varios archivos no dice cuál va: " + conProgreso);
ok("con varios archivos dice cuál va", conProgreso.trim());
await tenant.waitForFunction(() => document.body.innerText.includes("4 de 5"), null, { timeout: 60000 });
await tenant.locator("#upload-employment_letter").setInputFiles([PDF]);
await tenant.waitForFunction(() => document.body.innerText.includes("5 de 5"), null, { timeout: 40000 });
ok("completa los cinco documentos que le corresponden a un empleado");
await tenant.screenshot({ path: `${SHOT_DIR}/documentos-inquilino.png`, fullPage: true });

// ---------- el botón no avanza hasta que todo esté aprobado ----------
await owner.reload({ waitUntil: "domcontentloaded" });
await settled(owner);
await suAcordeonAbrir(owner);
const continuar = advanceButton(owner);
if (await continuar.getAttribute("aria-disabled") !== "true") throw new Error("el botón está activo sin revisar nada");
const motivo = await owner.locator("p", { hasText: /por revisar/ }).first().innerText();
if (!/5 documentos por revisar/.test(motivo)) throw new Error("no dice cuántos faltan: " + motivo);
ok("el botón no avanza y dice por qué", motivo.trim());

// Playwright se niega a pulsar algo anunciado como no disponible, igual que un lector de
// pantalla lo anuncia: el camino al bloqueo es un control propio, y eso es lo que se prueba.
await owner.getByRole("button", { name: "Ver qué falta" }).click();
const señalado = await owner.evaluate(() => {
  const el = document.getElementById("etapa-tenant-data");
  return el ? { resaltado: el.className.includes("ring-accent"), aLaVista: el.getBoundingClientRect().top < window.innerHeight } : null;
});
if (!señalado?.resaltado) throw new Error("al pulsarlo no resalta la sección");
if (!señalado.aLaVista) throw new Error("al pulsarlo no lleva a la sección");
ok("\"Ver qué falta\" lleva a la sección y la resalta");
await owner.screenshot({ path: `${SHOT_DIR}/bloqueado.png`, fullPage: true });

// El propietario ve lo mismo: su panel dentro de la etapa, plegado al llegar. Se comprueba
// sobre una carga limpia, porque más arriba el driver ya lo abrió para revisar.
await owner.reload({ waitUntil: "domcontentloaded" });
await settled(owner);
const suAcordeon = owner.locator("li#etapa-tenant-data").getByRole("button", { name: /Documentos del inquilino/ });
if (await suAcordeon.count() === 0) throw new Error("el propietario no ve el acordeón dentro de la etapa");
if (await suAcordeon.getAttribute("aria-expanded") !== "false") throw new Error("al propietario no le arranca plegado");
ok("el propietario ve el mismo acordeón dentro de la etapa 2, plegado al llegar");
await suAcordeonAbrir(owner);

// ---------- revisar: rechazar uno y aprobar el resto ----------
await owner.getByRole("button", { name: /^Rechazar Desprendibles/ }).first().click();
await owner.getByLabel("¿Qué le falta a este documento?").fill("La foto está borrosa y no se lee el número.");
await owner.getByRole("button", { name: "Rechazar documento" }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Rechazado"), null, { timeout: 20000 });
const trasRechazo = await owner.locator("p", { hasText: /Rechazaste/ }).first().innerText();
ok("rechazar con motivo cambia la razón del bloqueo", trasRechazo.trim());

// ---------- en vivo: sin recargar, en los dos lados ----------
// El inquilino se queda mirando su pantalla mientras el propietario aprueba.
const antesEnInquilino = await tenant.evaluate(() => document.body.innerText);
if (/Aprobado/.test(antesEnInquilino)) throw new Error("ya había algo aprobado antes de empezar");

await owner.getByRole("button", { name: /^Aprobar Cédula/ }).click();
// Nada de recargar en la página del inquilino: se espera a que llegue solo.
await tenant.waitForFunction(() => /Aprobado/.test(document.body.innerText), null, { timeout: 25000 });
ok("el inquilino ve la aprobación sin recargar");

// Y la marca está sobre el archivo, no solo en texto.
const marcas = await tenant.locator("#etapa-tenant-data a.relative span.bg-status-approved").count();
if (marcas === 0) throw new Error("no hay check sobre el archivo aprobado");
ok("el archivo aprobado lleva un check encima", `${marcas}`);

// Aprobado deja de ofrecer "Aprobar".
await owner.getByRole("button", { name: /^Aprobar Certificado laboral$/ }).click();
// Se espera a que ESE botón desaparezca, no a que la palabra "Aprobado" salga en la página:
// con la cédula ya aprobada, esa condición era cierta antes de empezar.
await owner.getByRole("button", { name: /^Aprobar Certificado laboral$/ }).waitFor({ state: "detached", timeout: 25000 });
if (await owner.getByRole("button", { name: /^Rechazar Certificado laboral$/ }).count() !== 1) {
  throw new Error("no deja cambiar de opinión sobre lo aprobado");
}
ok("lo aprobado ya no ofrece 'Aprobar', solo cambiar de opinión");

// El inquilino ve el motivo sin recargar.
await tenant.waitForFunction(() => /Rechazado\./.test(document.body.innerText), null, { timeout: 25000 });
const visto = await tenant.evaluate(() => document.body.innerText);
if (!visto.includes("La foto está borrosa")) throw new Error("el inquilino no ve el motivo del rechazo");
if (!/Rechazado\./.test(visto)) throw new Error("el rechazo no se anuncia en la fila");
if (!visto.includes("Súbelo otra vez")) throw new Error("no le dice qué hacer");
// La fila entera cambia de color, no solo un texto pequeño debajo de la miniatura.
const filaRoja = await etapa2.locator("li.border-destructive").count();
if (filaRoja === 0) throw new Error("la fila del documento rechazado no se destaca");
ok("el rechazo se ve: fila destacada, motivo y qué hacer");
const equis = await etapa2.locator("a.relative span.bg-destructive").count();
if (equis === 0) throw new Error("no hay X sobre el archivo rechazado");
ok("el archivo rechazado lleva una X encima");

// Y puede subir el reemplazo: un rechazado no ocupa cupo.
const puedeSubir = etapa2.getByRole("button", { name: /^Subir/ });
if (await puedeSubir.count() === 0) throw new Error("con un desprendible rechazado no deja subir el reemplazo");
ok("puede subir el reemplazo: un rechazado no ocupa cupo");

// Sin recargar: la campana se enciende sola.
await tenant.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && /[1-9]/.test(b.getAttribute("aria-label") ?? "");
}, null, { timeout: 25000 });
ok("la campana se enciende sin recargar");
await tenant.getByRole("button", { name: /^Notificaciones/ }).click();
const panel = tenant.getByRole("dialog", { name: "Notificaciones" });
await panel.waitFor({ state: "visible", timeout: 5000 });
const aviso = await panel.locator("li a").first().innerText();
if (!/corregir un documento/i.test(aviso)) throw new Error("la campana no avisa del rechazo: " + aviso);
if (!aviso.includes("La foto está borrosa")) throw new Error("el aviso no dice el motivo: " + aviso);
const destino = await panel.locator("li a").first().getAttribute("href");
if (!destino.endsWith("#etapa-tenant-data")) throw new Error("el aviso no lleva a la etapa: " + destino);
ok("la campana avisa del rechazo, con motivo y enlace a la etapa", destino);
await tenant.keyboard.press("Escape");

// Y sale el correo.
if (process.env.RESEND_API_KEY) {
  const enviados = await fetch("https://api.resend.com/emails?limit=6", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  }).then((r) => (r.ok ? r.json() : { data: [] }));
  const suyo = (enviados.data ?? []).find((e) => (e.to ?? []).some((t) => t.includes(STAMP)) && /corregir un documento/i.test(e.subject ?? ""));
  if (!suyo) throw new Error("no salió el correo del rechazo");
  ok("y sale el correo del rechazo", suyo.subject);
}

// Aprobar todo. Los ya aprobados dejan de ofrecer el botón, así que se pulsa siempre el
// primero que quede hasta que no quede ninguno.
await owner.reload({ waitUntil: "domcontentloaded" });
await settled(owner);
await suAcordeonAbrir(owner);
/*
 * Por `aria-label`, que es lo que mira `getByRole({ name })`: el texto visible del botón es
 * sólo "Aprobar" (o "Aprobar de todos modos"), así que contar por `textContent` con /^Aprobar /
 * daba cero en la primera vuelta y el bucle salía sin aprobar nada.
 */
const pendientes = () => owner.locator('button[aria-label^="Aprobar "]').count();
for (let i = 0; i < 15; i += 1) {
  const antes = await pendientes();
  if (antes === 0) break;
  await owner.getByRole("button", { name: /^Aprobar / }).first().click();
  /*
   * Se espera la consecuencia, no un tiempo. Cada veredicto es una escritura más un
   * `router.refresh()`, y con la espera fija de 1500ms que había aquí, bajo carga el siguiente
   * clic llegaba antes del redibujado: se perdía un veredicto, "Continuar a" no se habilitaba
   * nunca y este era el único driver flaky de la suite (73s en verde, 104s en rojo).
   */
  await owner.waitForFunction(
    (previo) => document.querySelectorAll('button[aria-label^="Aprobar "]').length < previo,
    antes,
    { timeout: 30000 },
  );
}
await owner.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => /Continuar a/.test(el.textContent ?? ""));
  return b && b.getAttribute("aria-disabled") !== "true";
}, null, { timeout: 30000 });
ok("con todo aprobado, el botón se activa");
await owner.screenshot({ path: `${SHOT_DIR}/aprobado.png`, fullPage: true });

await advanceButton(owner).click();
await owner.waitForFunction(() => document.body.innerText.includes("Paso 3 de 7"), null, { timeout: 20000 });
ok("y el proceso avanza a la validación de expedientes");

// Al pasar de un paso a otro, todos los acordeones quedan plegados — sin recargar.
const abiertos = await owner.locator('li[id^="etapa-"] button[aria-expanded="true"]').count();
if (abiertos > 0) throw new Error(`quedaron ${abiertos} acordeones abiertos al cambiar de paso`);
ok("al cambiar de paso se pliegan todos los acordeones");
await tenant.waitForFunction(
  () => document.querySelectorAll('li[id^="etapa-"] button[aria-expanded="true"]').length === 0,
  null,
  { timeout: 25000 },
);
ok("y también en la pantalla del inquilino");
// El de la etapa nueva se abre con un clic.
await owner.locator("li#etapa-background-check").getByRole("button", { name: /Validación de expedientes/ }).first().click();
await owner.waitForFunction(() => {
  const b = document.querySelector("li#etapa-background-check button");
  return b && b.getAttribute("aria-expanded") === "true";
}, null, { timeout: 5000 });

// ---------- los pasos anteriores siguen consultables ----------
// El proceso está en la etapa 3; la 2 debe seguir ahí, plegada y sin botones.
for (const [quien, pagina] of [["el inquilino", tenant], ["el propietario", owner]]) {
  await pagina.goto(processUrl, { waitUntil: "domcontentloaded" });
  await settled(pagina);
  const etapaHecha = pagina.locator("li#etapa-tenant-data");
  const suAcordeon = etapaHecha.getByRole("button", { name: /documentos/i }).first();
  if (await suAcordeon.count() === 0) throw new Error(`${quien} perdió el acordeón del paso 2`);
  if (await suAcordeon.getAttribute("aria-expanded") !== "false") throw new Error(`${quien}: el paso hecho no arranca plegado`);
  await suAcordeon.click();
  await pagina.waitForFunction(() => {
    const b = document.querySelector("li#etapa-tenant-data button");
    return b && b.getAttribute("aria-expanded") === "true";
  }, null, { timeout: 5000 });
  const archivos = await etapaHecha.locator("a[href*='firebasestorage']").count();
  if (archivos === 0) throw new Error(`${quien} no puede ver los archivos del paso anterior`);
  // Y sin acciones: la etapa ya pasó.
  const acciones = await etapaHecha.getByRole("button", { name: /^(Subir|Aprobar|Rechazar)/ }).count();
  if (acciones > 0) throw new Error(`${quien} todavía ve ${acciones} botones de una etapa que ya pasó`);
  ok(`${quien} puede volver a ver los archivos del paso 2, sin botones`, `${archivos} archivos`);
}

// ---------- etapa 3: la autorización ----------
await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
// El panel de la etapa arranca plegado: hay que abrirlo para ver la autorización.
await abrirPanel(tenant, "etapa-background-check");
if (!(await tenant.evaluate(() => document.body.innerText)).includes("Autorizo")) throw new Error("no le piden autorización al inquilino");
await tenant.getByLabel(/Autorizo/).click();
await tenant.getByRole("button", { name: /Autorizar la consulta/ }).click();
await tenant.waitForFunction(() => document.body.innerText.includes("Autorización otorgada"), null, { timeout: 20000 });
ok("el inquilino autoriza la consulta y queda con fecha");
await owner.reload({ waitUntil: "domcontentloaded" });
await settled(owner);
await abrirPanel(owner, "etapa-background-check");
const conAutorizacion = await owner.evaluate(() => document.body.innerText);
if (!conAutorizacion.includes("Autorización otorgada")) throw new Error("el propietario no ve la autorización");
if (!conAutorizacion.includes("1053812345")) throw new Error("no le muestra la cédula con la que consultar");
if (!conAutorizacion.includes("SIMIT")) throw new Error("no le da los portales");
ok("el propietario ve la autorización, la cédula y los portales oficiales");

// ---------- cada expediente se consulta y se anota ----------
await abrirPanel(owner, "etapa-background-check");
const etapa3 = owner.locator("li#etapa-background-check");
const fuentes = await etapa3.locator("li").count();
if (fuentes !== 4) throw new Error(`se ven ${fuentes} consultas, no 4`);
ok("las cuatro consultas están, cada una con su enlace");

// Sin registrar nada, el proceso no avanza.
const seguir = advanceButton(owner);
if (await seguir.getAttribute("aria-disabled") !== "true") throw new Error("avanza sin haber consultado nada");
const razon = await owner.locator("p", { hasText: /por registrar/ }).first().innerText();
if (!/4 consultas por registrar/.test(razon)) throw new Error("no dice cuántas faltan: " + razon);
ok("no avanza hasta registrar las cuatro", razon.trim());

// Tres sin hallazgos y una con hallazgo.
for (const nombre of ["Policía Nacional", "Procuraduría", "Contraloría"]) {
  await owner.getByRole("button", { name: `Marcar ${nombre} sin hallazgos` }).click();
  await owner.waitForTimeout(1200);
}
await owner.getByRole("button", { name: /Anotar un hallazgo en SIMIT/ }).click();
await owner.getByLabel("¿Qué encontraste?").fill("Dos comparendos sin pagar de 2024.");
await owner.getByRole("button", { name: "Guardar el hallazgo" }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Con hallazgos"), null, { timeout: 25000 });
ok("el propietario registra tres sin hallazgos y uno con hallazgo");

// El inquilino lo ve, sin recargar, con el detalle.
await abrirPanel(tenant, "etapa-background-check");
await tenant.waitForFunction(() => document.body.innerText.includes("Dos comparendos sin pagar"), null, { timeout: 25000 });
const suVista = await tenant.evaluate(() => document.body.innerText);
if (!suVista.includes("Sin hallazgos")) throw new Error("el inquilino no ve las consultas limpias");
if (await tenant.getByRole("button", { name: /sin hallazgos$/ }).count() > 0) throw new Error("el inquilino puede registrar consultas");
ok("el inquilino ve el resultado de cada consulta, sin poder tocarlas");

// Los enlaces a los portales son herramienta del propietario, no del inquilino.
const enlacesEnInquilino = await tenant.locator(
  'a[href*="policia.gov.co"], a[href*="fcm.org.co"], a[href*="procuraduria.gov.co"], a[href*="contraloria.gov.co"]',
).count();
if (enlacesEnInquilino > 0) throw new Error(`el inquilino ve ${enlacesEnInquilino} enlaces a los portales`);
const enlacesEnPropietario = await owner.locator(
  'a[href*="policia.gov.co"], a[href*="fcm.org.co"], a[href*="procuraduria.gov.co"], a[href*="contraloria.gov.co"]',
).count();
if (enlacesEnPropietario !== 4) throw new Error(`el propietario ve ${enlacesEnPropietario} enlaces, no 4`);
ok("los enlaces a los portales solo los ve el propietario", `${enlacesEnPropietario} / ${enlacesEnInquilino}`);

// Y son las direcciones desde donde se consulta, no la portada.
const destinos = await owner.locator('a[href*="policia.gov.co"], a[href*="fcm.org.co"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
if (!destinos.some((u) => u.includes("srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx"))) throw new Error("la de la Policía no es la de consulta: " + JSON.stringify(destinos));
if (!destinos.some((u) => u.includes("#/estado-cuenta"))) throw new Error("la del SIMIT abre en la portada: " + JSON.stringify(destinos));
ok("y apuntan a la página de consulta, no a la portada");

// Y le avisan del hallazgo.
await tenant.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") ?? "").startsWith("Notificaciones"));
  return b && /[1-9]/.test(b.getAttribute("aria-label") ?? "");
}, null, { timeout: 25000 });
await tenant.getByRole("button", { name: /^Notificaciones/ }).click();
const panelAvisos = tenant.getByRole("dialog", { name: "Notificaciones" });
await panelAvisos.waitFor({ state: "visible", timeout: 5000 });
const avisoHallazgo = await panelAvisos.locator("li a").first().innerText();
if (!/hallazgo/i.test(avisoHallazgo)) throw new Error("no le avisan del hallazgo: " + avisoHallazgo);
ok("y le avisan del hallazgo", avisoHallazgo.split("\n")[0]);
await tenant.keyboard.press("Escape");

// Con las cuatro registradas, avanza.
await owner.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((el) => /Continuar a/.test(el.textContent ?? ""));
  return b && b.getAttribute("aria-disabled") !== "true";
}, null, { timeout: 25000 });
ok("con las cuatro registradas, el proceso puede avanzar");
await owner.screenshot({ path: `${SHOT_DIR}/expedientes.png`, fullPage: true });
await owner.screenshot({ path: `${SHOT_DIR}/expedientes.png`, fullPage: true });

// 390px
await tenant.setViewportSize({ width: 390, height: 844 });
await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
const overflow = await tenant.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
