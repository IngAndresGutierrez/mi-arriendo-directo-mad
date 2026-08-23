/**
 * La etapa de la firma: firma electrónica propia, dentro del producto. El propietario sube el
 * contrato, cada parte pide un código a su canal ya verificado y firma con él. Hasta que las dos
 * firmas están, el proceso no avanza — y eso es lo que por fin le da una razón al botón de
 * continuar en esta etapa.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { adminDb, adminFieldValue, BASE, config, createAccount, fixtures, MONTHS, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2, pdf: PDF } = fixtures();

/*
 * Firma una de las dos partes.
 *
 * El código va al correo, y sin `RESEND_API_KEY` este proyecto lo registra en el log del servidor
 * en vez de mandarlo — que es cómo se ejercitan los envíos en local sin escribirle a nadie. El
 * asunto lleva el código, así que se lee de ahí. Con clave configurada habría que leerlo de la
 * bandeja de pruebas del proveedor, y este driver lo diría en vez de fallar en silencio.
 */
async function firmar(pagina, quien) {
  const registro = process.env.E2E_DEV_LOG;
  if (!registro || !existsSync(registro)) {
    throw new Error(
      "falta E2E_DEV_LOG apuntando al log de `pnpm dev`: es de donde se lee el código de firma",
    );
  }
  const antes = readFileSync(registro, "utf8").length;

  /*
   * Sin `WHATSAPP_OTP_TEMPLATE` configurado, WhatsApp no debe ni aparecer: ofrecer un canal que
   * responde "no pudimos enviar el código" es peor que no ofrecerlo. Y con un solo canal tampoco hay
   * grupo de radios — una pregunta de una sola respuesta no es una pregunta.
   */
  /*
   * Un canal que no puede entregar no se ofrece. Se comprueba por **control**, no por texto: la
   * cláusula legal dice "en mi correo o WhatsApp verificado", así que buscar esa frase en el
   * `innerText` la encontraba ahí y daba un falso positivo.
   */
  const sinPlantillaWhatsApp = !process.env.WHATSAPP_OTP_TEMPLATE;
  const sinTwilio = !(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
  if (sinPlantillaWhatsApp && (await pagina.getByRole("radio", { name: /WhatsApp/i }).count())) {
    throw new Error("ofrece WhatsApp sin plantilla configurada");
  }
  if (sinTwilio && (await pagina.getByRole("radio", { name: /mensaje de texto/i }).count())) {
    throw new Error("ofrece SMS sin Twilio configurado");
  }
  if (sinPlantillaWhatsApp && sinTwilio) {
    // Con un único canal no hay grupo de radios: una pregunta de una sola respuesta no es una pregunta.
    if (await pagina.getByRole("radio").count()) {
      throw new Error("muestra un grupo de radios con un solo canal disponible");
    }
    if (!/Te mandamos el código a tu correo electrónico verificado/.test(
      await pagina.evaluate(() => document.body.innerText),
    )) {
      throw new Error("con un solo canal no dice a dónde va el código");
    }
    ok(`a ${quien} solo le ofrecen el correo, y le dicen a dónde va`);
  }

  await pagina.getByRole("checkbox").last().check();
  await pagina.getByRole("button", { name: /Mandarme el código para firmar/i }).click();
  await pagina.waitForFunction(
    () => /Te mandamos un código a/.test(document.body.innerText),
    null,
    { timeout: 25000 },
  );

  // El asunto que `sendEmail` escribe: "Tu código para firmar: 418362".
  let codigo = null;
  for (let intento = 0; intento < 40 && !codigo; intento += 1) {
    const nuevo = readFileSync(registro, "utf8").slice(antes);
    const encontrados = [...nuevo.matchAll(/Tu código para firmar: (\d{6})/g)];
    codigo = encontrados.at(-1)?.[1] ?? null;
    if (!codigo) await pagina.waitForTimeout(250);
  }
  if (!codigo) throw new Error(`no salió el código de ${quien} en el log del servidor`);

  /*
   * El dibujo, si el panel lo ofrece: solo aparece cuando los recuadros están marcados y el
   * contrato es un PDF. Se traza con el ratón, que es lo que pidió el usuario, y `pointer` en vez
   * de `mouse` porque el componente escucha eventos de puntero para servir también al dedo.
   */
  const lienzo = pagina.locator('canvas[aria-label="Dibuja tu firma"]');
  if (await lienzo.count()) {
    const zona = await lienzo.boundingBox();
    await pagina.mouse.move(zona.x + 20, zona.y + zona.height / 2);
    await pagina.mouse.down();
    for (let paso = 1; paso <= 8; paso += 1) {
      await pagina.mouse.move(
        zona.x + 20 + (zona.width - 40) * (paso / 8),
        zona.y + zona.height / 2 + (paso % 2 ? -14 : 14),
      );
    }
    await pagina.mouse.up();
    await pagina.waitForFunction(
      () => /Se dibujará en el contrato/.test(document.body.innerText),
      null,
      { timeout: 10000 },
    );
    ok(`${quien} dibuja su firma con el ratón`);
  }

  await pagina.locator("#signature-code").fill(codigo);
  await pagina.getByRole("button", { name: /^Firmar el contrato$/i }).click();
  await pagina.waitForFunction(
    () => /firmó el/.test(document.body.innerText),
    null,
    { timeout: 25000 },
  );

  return codigo;
}

const db = adminDb();
const FieldValue = adminFieldValue();
const problemas = [];
const b = await chromium.launch();

async function cuenta(email) {
  await createAccount(API_KEY, email);
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
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
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
  throw new Error("se puede avanzar sin contrato");
}
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Sube el contrato de arrendamiento")) {
  throw new Error("no dice que falta subir el contrato");
}
ok("sin el contrato firmado no se avanza, y dice por que");

await continuar.hover();
await dueño.waitForFunction(
  () => /Sube el contrato de arrendamiento/.test(document.body.innerText),
  null,
  { timeout: 10000 },
);
ok("y el motivo esta en el tooltip del propio boton");

// ---------- lo que ve el propietario ----------
await dueño.getByRole("button", { name: /Firma del contrato/i }).first().click();
const visto = await dueño.evaluate(() => document.body.innerText);
for (const frase of ["Firma electrónica", "Se firma aquí, sin cuentas ni trámites"]) {
  if (!visto.includes(frase)) throw new Error(`el panel no dice "${frase}"`);
}
if (/ZapSign|zapsign/i.test(visto)) throw new Error("el panel todavía nombra a ZapSign");
ok("el panel dice que se firma aquí, sin cuentas");

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

/*
 * Y una imagen también, que es el caso que se reportó: se aceptaba, no se podía estampar la firma
 * sobre ella, y el panel acababa explicando una limitación en vez de ofrecer algo.
 */
await dueño.setInputFiles("#contract-file", PHOTO_1);
await dueño.waitForFunction(
  () => /tiene que ser un PDF/.test(document.body.innerText),
  null,
  { timeout: 15000 },
);
ok("una imagen se rechaza: un contrato es un PDF");

// ---------- el contrato firmado ----------
await dueño.locator("#contract-note").fill("Firmado por las dos partes el 20 de septiembre.");
await dueño.setInputFiles("#contract-file", PDF);
await dueño.waitForFunction(
  () => /documento\.pdf/.test(document.body.innerText),
  null,
  { timeout: 40000 },
);
ok("el contrato queda subido y con su nombre");

// Subido no es firmado: la compuerta sigue cerrada y ahora dice a quién falta.
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Falta que firmen las dos partes")) {
  throw new Error("con el contrato subido y sin firmas no dice que faltan las dos");
}
ok("subir no es firmar: sigue bloqueado y dice que faltan las dos firmas");

/*
 * Y se puede deshacer. Faltaba: quien subía el archivo equivocado no tenía forma de quitarlo, solo
 * de canjearlo por otro. Se comprueba que el control existe y que la confirmación dice qué se
 * pierde, sin llegar a confirmar — borrarlo aquí dejaría al resto del driver sin contrato.
 */
if (!(await dueño.getByRole("button", { name: /^Quitar$/ }).count())) {
  throw new Error("no hay forma de quitar el contrato subido");
}
await dueño.getByRole("button", { name: /^Quitar$/ }).click();
const aviso = dueño.getByRole("dialog");
await aviso.waitFor({ state: "visible", timeout: 10000 });
if (!/subir el contrato otra vez/.test(await aviso.innerText())) {
  throw new Error("la confirmación no dice qué se pierde: " + (await aviso.innerText()));
}
await dueño.keyboard.press("Escape");
await aviso.waitFor({ state: "hidden", timeout: 10000 });
ok("se puede quitar el contrato, y la confirmación dice qué se pierde");

// ---------- marcar dónde firma cada parte ----------
/*
 * Aquí se prueba lo único que justifica meter `pdfjs-dist` en el bundle: que el propietario vea las
 * páginas y pueda apuntar. Si el visor no renderiza, este bloque lo dice en vez de que el fallo
 * aparezca más tarde disfrazado de "no se dibujó la firma".
 */
await dueño.getByRole("button", { name: /Marcar dónde se firma/i }).click();
const lienzoPdf = dueño.locator('canvas[aria-label*="del contrato"]');
await lienzoPdf.waitFor({ state: "visible", timeout: 30000 });
await dueño.waitForFunction(
  () => !/Cargando el contrato/.test(document.body.innerText),
  null,
  { timeout: 30000 },
);
/*
 * La aserción fuerte: un canvas que nunca renderizó mide 300x150 —el valor por defecto del
 * elemento— así que un `> 10` pasaba con el visor roto, y pasó. Se exige que el ancho lo haya
 * fijado el viewport (coincide con el del contenedor) y que no haya mensaje de error.
 */
const medidas = await lienzoPdf.evaluate((el) => ({
  w: el.width,
  h: el.height,
  contenedor: el.parentElement?.clientWidth ?? 0,
}));
if (Math.abs(medidas.w - medidas.contenedor) > 2) {
  throw new Error(`el visor no renderizó: canvas ${medidas.w}x${medidas.h}, contenedor ${medidas.contenedor}`);
}
const visorRoto = (await dueño.evaluate(() => document.body.innerText)).includes("No pudimos mostrar el contrato");
if (visorRoto) throw new Error("el visor reporta que no pudo mostrar el contrato");
ok("el visor renderiza el contrato de verdad", `${medidas.w}x${medidas.h}`);

/*
 * Un clic por parte; el primero cambia solo al que falta, así que dos bastan.
 *
 * `locator.click({ position })` y no `mouse.click(x, y)`: las coordenadas de `boundingBox()` son
 * relativas al viewport, y este visor está al fondo de una página larga — quedaban fuera de la
 * pantalla y el clic no golpeaba nada. El locator desplaza el elemento a la vista y mide desde su
 * propia esquina.
 */
const caja = await lienzoPdf.boundingBox();
const recuadros = () => dueño.locator('[data-slot="signature-spot"]').count();
await lienzoPdf.click({ position: { x: caja.width * 0.3, y: caja.height * 0.8 } });
// Se espera la consecuencia del primero antes del segundo: dos clics inmediatos caen en el mismo
// render y el segundo pisaría al primero.
await dueño.waitForFunction(
  () => document.querySelectorAll('[data-slot="signature-spot"]').length >= 1,
  null,
  { timeout: 15000 },
);
await lienzoPdf.click({ position: { x: caja.width * 0.7, y: caja.height * 0.8 } });
await dueño.waitForFunction(
  () => document.querySelectorAll('[data-slot="signature-spot"]').length >= 2,
  null,
  { timeout: 15000 },
);
if ((await recuadros()) !== 2) throw new Error(`se esperaban 2 recuadros, hay ${await recuadros()}`);
ok("marca los dos recuadros con dos clics");

await dueño.getByRole("button", { name: /Guardar los recuadros/i }).click();
await dueño.waitForFunction(() => /Marcado/.test(document.body.innerText), null, { timeout: 25000 });
ok("los recuadros quedan guardados");
await dueño.screenshot({ path: `${SHOT_DIR}/contrato-recuadros.png`, fullPage: true });

// ---------- firma el propietario ----------
await firmar(dueño, "el propietario");
ok("el propietario firma con el código que le llega");

// Con una sola firma sigue bloqueado, y ahora falta la otra.
if ((await dueño.getByRole("button", { name: /Continuar a/i }).first().getAttribute("aria-disabled")) !== "true") {
  throw new Error("con una sola firma deja avanzar");
}
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Falta la firma del inquilino")) {
  throw new Error("no dice que falta la firma del inquilino");
}
ok("una firma no basta: falta la del inquilino y lo dice");
await dueño.screenshot({ path: `${SHOT_DIR}/contrato.png`, fullPage: true });

// ---------- el inquilino lo lee, y no lo sube ----------
await inq.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("button", { name: /Firma del contrato/i }).first().click();
const suyo = await inq.evaluate(() => document.body.innerText);
if (!suyo.includes("documento.pdf")) throw new Error("el inquilino no ve el contrato");
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

// ---------- firma el inquilino, y con eso avanza ----------
await firmar(inq, "el inquilino");
ok("el inquilino firma con su propio código");

await inq.waitForFunction(() => /Firmado/.test(document.body.innerText), null, { timeout: 20000 });
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.waitForFunction(
  () => {
    const boton = [...document.querySelectorAll("button")].find((el) => /Continuar a/.test(el.textContent ?? ""));
    return boton && boton.getAttribute("aria-disabled") !== "true";
  },
  null,
  { timeout: 25000 },
);
ok("con las dos firmas, el proceso puede avanzar");

/*
 * El PDF derivado: el original con los trazos estampados más la hoja de evidencia. Su hash es
 * propio — estampar cambia los bytes, y hashear esto como "el documento firmado" invalidaría las
 * firmas que muestra. Se comprueba que existe y que se sirve firmado, no su contenido byte a byte.
 */
// Los paneles arrancan plegados y la recarga anterior los volvió a cerrar: hay que reabrirlo.
await dueño.getByRole("button", { name: /Firma del contrato/i }).first().click();
await dueño.waitForFunction(
  () => /Contrato firmado/.test(document.body.innerText),
  null,
  { timeout: 30000 },
);
const firmado = await dueño.getByRole("link", { name: /Contrato firmado/i }).first().getAttribute("href");
const paramsFirmado = new URL(firmado).searchParams;
if (!(paramsFirmado.get("Signature") ?? paramsFirmado.get("X-Goog-Signature"))) {
  throw new Error("el PDF firmado no se sirve por una URL firmada: " + firmado);
}
const descarga = await dueño.request.get(firmado);
if (descarga.status() !== 200) throw new Error("el PDF firmado no se descarga: " + descarga.status());
const cuerpo = await descarga.body();
if (cuerpo.subarray(0, 5).toString() !== "%PDF-") throw new Error("lo descargado no es un PDF");
if (cuerpo.length <= 193) throw new Error("el PDF firmado no creció: no se estampó nada");
ok("se genera el PDF firmado, con los trazos y la hoja de evidencia", `${cuerpo.length} bytes`);

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
