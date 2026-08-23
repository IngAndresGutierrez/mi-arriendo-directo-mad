/**
 * La etapa de la firma: se firma en ZapSign con la cuenta del propio propietario y el PDF firmado
 * vuelve aquí. Hasta que está, el proceso no avanza — y eso es lo que por fin le da una razón al
 * botón de continuar en esta etapa.
 */
import { chromium } from "playwright";
import { BASE, MONTHS, adminDb, adminFieldValue, config, fixtures, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2, pdf: PDF } = fixtures();

const db = adminDb();
const FieldValue = adminFieldValue();
const problemas = [];
const b = await chromium.launch();

async function cuenta(email) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
}
async function entrar(email, nombre) {
  // `clipboard-read` porque la hoja del cotizador se verifica por lo que llega al portapapeles,
  // no por lo que se ve en la fila: es ahí donde importa que el monto vaya sin formato.
  const p = await (
    await b.newContext({
      viewport: { width: 1100, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    })
  ).newPage();
  p.on("pageerror", (e) => problemas.push(`${nombre}: ${e}`));
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
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
  await p.getByRole("checkbox").click();
  await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
  await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
  return p;
}

const dueñoEmail = `entdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `entinq-${STAMP}@miarriendodirecto.test`;
await cuenta(dueñoEmail); await cuenta(inqEmail);
// El nombre va en una constante porque la hoja del cotizador lo asserta más abajo: escribirlo
// dos veces es cómo la aserción acabó buscando el nombre de otro driver.
const INQ_NOMBRE = "Carlos Inquilino Ramírez";
const dueño = await entrar(dueñoEmail, "Ana Propietaria Pérez");
const inq = await entrar(inqEmail, INQ_NOMBRE);

// ---------- un proceso hasta la etapa de la entrevista ----------
await dueño.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Título del anuncio").fill(`Apartamento con balcón en Palermo ${STAMP}`);
await dueño.getByLabel("Descripción").fill("Dos habitaciones, cocina integral y zona de ropas independiente, con balcón.");
await dueño.getByLabel("Área (m²)").fill("70");
await dueño.getByLabel("Habitaciones").fill("2");
await dueño.getByLabel("Baños").fill("2");
await dueño.getByLabel("Estrato").click(); await dueño.getByRole("option", { name: "Estrato 4" }).click();
await dueño.getByLabel("Parqueadero").click(); await dueño.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await dueño.getByLabel("Departamento").click(); await dueño.getByRole("option", { name: "Caldas", exact: true }).click();
await dueño.getByLabel("Ciudad").click(); await dueño.getByRole("option", { name: "Manizales", exact: true }).click();
await dueño.getByLabel("Barrio").fill("Palermo");
await dueño.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await dueño.getByLabel("Canon mensual (COP)").click(); await dueño.keyboard.type("1800000");
await dueño.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await dueño.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await dueño.getByRole("button", { name: /Publicar inmueble/i }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);
const href = await dueño.locator("li", { hasText: `Apartamento con balcón en Palermo ${STAMP}` }).getByRole("link").first().getAttribute("href");

await inq.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("link", { name: "Postularme" }).click();
await inq.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(inq);
await inq.getByLabel("Número de documento").fill("1053812345");
await inq.getByLabel("Dónde trabajas").fill("Crehana");
await inq.getByLabel("Ingresos mensuales (COP)").click(); await inq.keyboard.type("6000000");
await inq.getByLabel("Personas que vivirían ahí").fill("2");
await inq.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await inq.getByLabel("Qué relación tienen").fill("Jefe directo");
await inq.getByLabel("Teléfono de tu referencia").fill("3009876543");
await inq.getByLabel("Cuándo te mudarías").fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
ok("proceso creado", new URL(proceso).pathname);



// ---------- el proceso, puesto en la etapa de la firma ----------
const applicationId = new URL(proceso).pathname.split("/").pop();
await db.collection("applications").doc(applicationId).update({
  stage: "contract_signature",
  updatedAt: FieldValue.serverTimestamp(),
});
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 7 de 9"), null, { timeout: 20000 });
ok("el proceso esta en la firma", "paso 7 de 9");

/*
 * Lo que esta etapa no tenia: el boton de continuar deshabilitado con la razon. `aria-disabled`,
 * no `disabled`, para que el tooltip siga alcanzable.
 */
const continuar = dueño.getByRole("button", { name: /Continuar a/i }).first();
if ((await continuar.getAttribute("aria-disabled")) !== "true") {
  throw new Error("se puede avanzar sin el contrato firmado");
}
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Sube el contrato firmado")) {
  throw new Error("no dice que falta el contrato firmado");
}
ok("sin el contrato firmado no se avanza, y dice por que");

await continuar.hover();
await dueño.waitForFunction(
  () => /Sube el contrato firmado/.test(document.body.innerText),
  null,
  { timeout: 10000 },
);
ok("y el motivo esta en el tooltip del propio boton");

// ---------- lo que ve el propietario ----------
await dueño.getByRole("button", { name: /Firma del contrato/i }).first().click();
const visto = await dueño.evaluate(() => document.body.innerText);
for (const frase of ["ZapSign", "5 documentos al mes", "Cómo se firma"]) {
  if (!visto.includes(frase)) throw new Error(`el panel no dice "${frase}"`);
}
ok("el panel explica cómo se firma y que el plan gratuito es del propietario");

const irA = dueño.getByRole("link", { name: /ZapSign/i }).first();
const destino = await irA.getAttribute("href");
/*
 * Se comprueba el host, no la URL entera: la ruta exacta dentro de ZapSign es una decisión del
 * producto y repetirla aquí sería mantenerla dos veces. Lo que la etapa promete es que el enlace
 * lleva a ZapSign, por https y en otra pestaña.
 */
const host = destino ? new URL(destino).hostname : "";
if (host !== "app.zapsign.co") throw new Error("el enlace no lleva a ZapSign: " + destino);
if (!destino.startsWith("https://")) throw new Error("el enlace no es https: " + destino);
if ((await irA.getAttribute("target")) !== "_blank") throw new Error("no abre en otra pestaña");
ok("y ofrece subir el contrato a ZapSign, en otra pestaña", new URL(destino).pathname);

// ---------- un archivo que no es un contrato ----------
await dueño.setInputFiles("#contract-file", {
  name: "no-es-un-contrato.zip",
  mimeType: "application/zip",
  buffer: Buffer.from("PK no soy un pdf"),
});
await dueño.waitForFunction(
  () => /tiene que ser un PDF/.test(document.body.innerText),
  null,
  { timeout: 15000 },
);
ok("un archivo que no es contrato se rechaza antes de subirlo");

// ---------- el contrato firmado ----------
await dueño.locator("#contract-note").fill("Firmado por las dos partes el 20 de septiembre.");
await dueño.setInputFiles("#contract-file", PDF);
await dueño.waitForFunction(
  () => /documento\.pdf/.test(document.body.innerText),
  null,
  { timeout: 40000 },
);
ok("el contrato firmado queda subido y con su nombre");

await dueño.waitForFunction(
  () => {
    const boton = [...document.querySelectorAll("button")].find((el) => /Continuar a/.test(el.textContent ?? ""));
    return boton && boton.getAttribute("aria-disabled") !== "true";
  },
  null,
  { timeout: 20000 },
);
ok("con el contrato firmado, el proceso puede avanzar");
await dueño.screenshot({ path: `${SHOT_DIR}/contrato.png`, fullPage: true });

// ---------- el inquilino lo lee, y no lo sube ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Firma del contrato/i }).first().click();
const suyo = await inq.evaluate(() => document.body.innerText);
if (!suyo.includes("documento.pdf")) throw new Error("el inquilino no ve el contrato firmado");
ok("el inquilino ve el mismo documento");

/*
 * El enlace lo firma el servidor y dura una hora: la ruta de contratos esta cerrada a los
 * clientes, asi que esta es la unica forma de leerlo. Se comprueba que sea de Storage y que lleve
 * firma, no que la URL sea una cadena concreta.
 */
const suEnlace = await inq.locator('a:has-text("documento.pdf")').first().getAttribute("href");
if (!/^https:\/\/storage\.googleapis\.com\//.test(suEnlace ?? "")) {
  throw new Error("el contrato no se sirve por una URL firmada de Storage: " + suEnlace);
}
/*
 * Firma y caducidad, sin atarse al esquema: el SDK firma con V2 (`Signature` + `Expires`) o con
 * V4 (`X-Goog-Signature` + `X-Goog-Expires`) según cómo esté configurado, y cuál use no es lo que
 * esta prueba defiende. Lo que defiende es que el contrato no se sirve por una URL pública.
 */
const params = new URL(suEnlace).searchParams;
const firma = params.get("Signature") ?? params.get("X-Goog-Signature");
const caduca = params.get("Expires") ?? params.get("X-Goog-Expires");
if (!firma) throw new Error("la URL del contrato no viene firmada: " + suEnlace);
if (!caduca) throw new Error("la URL del contrato no caduca: " + suEnlace);
ok("y lo lee por una URL firmada que caduca, no por una pública");

if (await inq.locator("#contract-file").count()) {
  throw new Error("al inquilino le ofrecen subir el contrato");
}
ok("el inquilino no puede subirlo: eso es del propietario");

// ---------- 390px ----------
await inq.setViewportSize({ width: 390, height: 900 });
await settled(inq);
const ancho = await inq.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
if (ancho.doc > ancho.win + 1) throw new Error(`scroll horizontal a 390px: ${JSON.stringify(ancho)}`);
ok("390px sin scroll horizontal");
await inq.screenshot({ path: `${SHOT_DIR}/contrato-movil.png`, fullPage: true });

if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
