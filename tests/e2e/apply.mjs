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
const landlordEmail = `owner-${STAMP}@miarriendodirecto.test`;
const tenantEmail = `renter-${STAMP}@miarriendodirecto.test`;
for (const email of [landlordEmail, tenantEmail]) {
  await createAccount(API_KEY, email);
}

const b = await chromium.launch();
const problems = [];
const openSession = (email, name) => libOpenSession(b, { email, name, problems });

// ---------- el propietario publica ----------
const owner = await openSession(landlordEmail, "Marta Propietaria Gómez");
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
try {
  await owner.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
  await settled(owner);
} catch (e) {
  console.log("   errores en pantalla: " + JSON.stringify(await owner.locator('form [role="alert"], form p.text-destructive').allInnerTexts()));
  throw e;
}
const listingPath = await listingPathOf(owner, `Apartamento con balcón en Palermo ${STAMP}`);
ok("el propietario publica y cae en su listado", listingPath);

// En su propio anuncio no hay botón de postularse. Hay que ir: publicar termina en el listado.
await owner.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(owner);
const ownerSees = await owner.evaluate(() => document.body.innerText);
if (!ownerSees.includes("Este inmueble es tuyo")) throw new Error("al dueño le ofrecen postularse a lo suyo");
ok("al dueño no le ofrecen postularse a su propio inmueble");

// ---------- un visitante sin sesión ----------
const guest = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await guest.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(guest);
const cta = guest.getByRole("link", { name: "Postularme" });
if (!(await cta.isVisible())) throw new Error("el visitante no ve el botón");
if (!(await cta.getAttribute("href")).includes("next=%2Fpostularme")) throw new Error("no lo lleva al login con retorno: " + await cta.getAttribute("href"));
ok("un visitante sin sesión va al login y vuelve aquí", await cta.getAttribute("href"));
await guest.context().close();

// ---------- el inquilino se postula ----------
const tenant = await openSession(tenantEmail, "Ana Inquilina Pérez");
await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
await tenant.getByRole("link", { name: "Postularme" }).click();
await tenant.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(tenant);
if (!(await tenant.evaluate(() => document.body.innerText)).includes("Llénalo una sola vez")) throw new Error("no dice que se guarda para después");
ok("el formulario de postulación abre vacío la primera vez");

await tenant.getByLabel("Número de documento").fill("1053812345");
await tenant.getByLabel("Dónde trabajas").fill("Crehana");
await tenant.getByLabel("Ingresos mensuales (COP)").click(); await tenant.keyboard.type("6000000");
await tenant.getByLabel("Personas que vivirían ahí").fill("2");
await tenant.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await tenant.getByLabel("Qué relación tienen").fill("Jefe directo");
await tenant.getByLabel("Teléfono de tu referencia").fill("3009876543");
await declareReferenceAuthorized(tenant);
await tenant.getByLabel("Cuándo te mudarías").fill("2026-10-01");
await tenant.getByLabel("Mensaje al propietario (opcional)").fill("Trabajo en Manizales hace tres años y busco algo cerca del centro.");
await tenant.getByRole("button", { name: /Enviar postulación/i }).click();
await tenant.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(tenant);
const processUrl = tenant.url();
ok("la postulación se envía y abre el proceso", new URL(processUrl).pathname);

const stages = await tenant.locator("ol li h3").allTextContents();
if (stages.length !== 7) throw new Error(`se ven ${stages.length} etapas`);
if (stages.join(" ").toLowerCase().includes("depósito")) throw new Error("¡apareció una etapa de depósito!");
ok("se ven las 7 etapas y ninguna es depósito", stages[0] + " → " + stages[6]);
const tenantText = await tenant.evaluate(() => document.body.innerText);
if (!tenantText.includes("Paso 1 de 7")) throw new Error("no dice en qué paso va");
ok("el proceso arranca en el paso 1 de 7");
await tenant.screenshot({ path: `${SHOT_DIR}/proceso-inquilino.png`, fullPage: true });

// El inquilino no puede avanzar su propio proceso.
if (await tenant.getByRole("button", { name: /Continuar a/ }).count() > 0) throw new Error("¡el inquilino puede avanzar su propio proceso!");
if (await tenant.getByRole("button", { name: /Retirar mi postulación/ }).count() !== 1) throw new Error("el inquilino no puede retirarse");
ok("el inquilino puede retirarse, pero no avanzar el proceso");

// Ya postulado, el anuncio ofrece ir al proceso, no postularse de nuevo.
await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
if (await tenant.getByRole("link", { name: "Postularme" }).count() > 0) throw new Error("ofrece postularse otra vez");
await tenant.getByRole("link", { name: /Ver mi proceso/i }).click();
await tenant.waitForURL(/\/contratos\//, { timeout: 20000 });
await settled(tenant);
ok("con una postulación abierta, el anuncio lleva al proceso en vez de ofrecer otra");

// Y entrar a mano a /postularme redirige al proceso.
await tenant.goto(BASE + "/postularme/" + listingPath.split("/").pop(), { waitUntil: "domcontentloaded" });
await settled(tenant);
if (!/\/contratos\//.test(tenant.url())) throw new Error("entrando a mano deja postularse dos veces: " + tenant.url());
ok("entrar a mano a /postularme redirige al proceso que ya existe");

// ---------- el propietario lo ve y lo avanza ----------
await owner.goto(BASE + "/contratos", { waitUntil: "domcontentloaded" });
await settled(owner);
const ownerList = await owner.evaluate(() => document.body.innerText);
if (!ownerList.includes("Ana Inquilina Pérez")) throw new Error("el propietario no ve quién se postuló");
ok("el propietario ve la postulación en Contratos", "con el nombre del inquilino");
await owner.getByRole("link", { name: /Ver el proceso/i }).first().click();
await owner.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 20000 });
await settled(owner);

const ownerProcess = await owner.evaluate(() => document.body.innerText);
for (const needed of ["1053812345", "6.000.000", "veces el canon", "Carolina Restrepo"]) {
  if (!ownerProcess.replace(/ /g, " ").includes(needed)) throw new Error(`el propietario no ve "${needed}"`);
}
ok("el propietario ve el expediente: documento, ingresos, múltiplo del canon y referencia");
await owner.screenshot({ path: `${SHOT_DIR}/proceso-propietario.png`, fullPage: true });

await advanceButton(owner).click();
await owner.waitForFunction(() => document.body.innerText.includes("Paso 2 de 7"), null, { timeout: 20000 });
ok("el propietario avanza una etapa", "paso 2 de 7");

// El inquilino ve el avance.
await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
if (!(await tenant.evaluate(() => document.body.innerText)).includes("Paso 2 de 7")) throw new Error("el inquilino no ve el avance");
ok("el inquilino ve el avance del propietario");

// ---------- lo sensible no se filtra ----------
const tenantProcess = await tenant.evaluate(() => document.body.innerText);
if (tenantProcess.includes("Calle 60 #10-20")) throw new Error("¡el inquilino ve la dirección exacta sin estar aprobado!");
ok("el inquilino sigue sin ver la dirección exacta");

// ---------- un tercero no ve nada ----------
const thirdEmail = `nosy-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, thirdEmail);
const nosy = await openSession(thirdEmail, "Curioso Tercero López");
await nosy.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(nosy);
/*
 * Lo que importa es lo que recibe: la página de "no existe", idéntica a la de un id inventado.
 * El código HTTP es 200 porque las pantallas privadas tienen esqueleto de carga y el `notFound()`
 * viaja dentro del flujo ya iniciado; no distingue un proceso ajeno de uno inexistente, que es la
 * propiedad que se está comprobando.
 */
const ajeno = await nosy.evaluate(() => document.body.innerText);
await nosy.goto(BASE + "/contratos/estoNoExisteJamas", { waitUntil: "domcontentloaded" });
await settled(nosy);
const inventado = await nosy.evaluate(() => document.body.innerText);
if (ajeno.includes("Apartamento con balcón")) throw new Error("un tercero ve el proceso ajeno");
if (ajeno.trim() !== inventado.trim()) throw new Error("un proceso ajeno se distingue de uno inexistente");
ok("un tercero recibe la misma pantalla que si el proceso no existiera");

// ---------- el perfil quedó guardado ----------
await tenant.goto(BASE + "/perfil-inquilino", { waitUntil: "domcontentloaded" });
await settled(tenant);
// react-hook-form llena los campos al hidratar: leerlos antes da vacío siempre.
await tenant.waitForFunction(
  () => document.querySelector("#documentNumber")?.value === "1053812345",
  null,
  { timeout: 20000 },
);
if (await tenant.getByLabel("Teléfono de tu referencia").inputValue() !== "3009876543") throw new Error("el teléfono no volvió a nacional");
ok("los datos quedaron en el perfil de inquilino", "y el teléfono vuelve en formato nacional");

// ---------- el propietario rechaza ----------
await owner.getByRole("button", { name: /Rechazar postulación/i }).click();
const dialog = owner.getByRole("dialog");
await dialog.waitFor({ state: "visible", timeout: 5000 });
await dialog.getByLabel(/Motivo/).fill("Ya arrendé el inmueble.");
await dialog.getByRole("button", { name: "Rechazar postulación" }).click();
await owner.waitForFunction(() => document.body.innerText.includes("Rechazada"), null, { timeout: 20000 });
ok("el propietario rechaza con motivo, tras confirmar");

await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
const afterReject = await tenant.evaluate(() => document.body.innerText);
if (!afterReject.includes("Ya arrendé el inmueble")) throw new Error("el inquilino no ve el motivo");
if (!afterReject.includes("Datos y documentos del inquilino")) throw new Error("no dice en qué etapa se detuvo");
ok("el inquilino ve el motivo y la etapa en la que se detuvo");
if (await tenant.getByRole("button", { name: /Retirar mi postulación/ }).count() > 0) throw new Error("sigue ofreciendo retirarse");
ok("un proceso cerrado ya no ofrece acciones");

// ---------- rechazado: el anuncio ya no ofrece postularse ----------
await tenant.goto(BASE + listingPath, { waitUntil: "domcontentloaded" });
await settled(tenant);
if (await tenant.getByRole("link", { name: "Postularme" }).count() > 0) throw new Error("¡sigue ofreciendo postularse tras el rechazo!");
const afterRejectListing = await tenant.evaluate(() => document.body.innerText);
if (!afterRejectListing.includes("no continuó con tu postulación")) throw new Error("no explica por qué no puede");
ok("tras el rechazo, el anuncio no ofrece postularse y explica por qué");
await tenant.getByRole("link", { name: /Ver mi postulación/i }).click();
await tenant.waitForURL(/\/contratos\//, { timeout: 20000 });
await settled(tenant);
ok("y ofrece volver a la postulación rechazada");

// Entrar a mano al formulario tampoco: lleva al proceso, no a un rebote sin explicación.
await tenant.goto(BASE + "/postularme/" + listingPath.split("/").pop(), { waitUntil: "domcontentloaded" });
await settled(tenant);
if (!/\/contratos\//.test(tenant.url())) throw new Error("entrando a mano deja postularse otra vez: " + tenant.url());
ok("entrar a mano a /postularme lleva a la postulación, no al formulario");

// ---------- móvil ----------
await tenant.setViewportSize({ width: 390, height: 844 });
await tenant.goto(processUrl, { waitUntil: "domcontentloaded" });
await settled(tenant);
const overflow = await tenant.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await tenant.screenshot({ path: `${SHOT_DIR}/proceso-movil.png`, fullPage: true });
if (overflow) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
