/**
 * La etapa de la firma: firma electrónica propia, dentro del producto. El propietario sube el
 * contrato, cada parte pide un código a su canal ya verificado y firma con él. Hasta que las dos
 * firmas están, el proceso no avanza — y eso es lo que por fin le da una razón al botón de
 * continuar en esta etapa.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import {
  acceptLegalConsents,
  adminDb,
  adminFieldValue,
  adminStorage,
  BASE,
  config,
  createAccount,
  declareReferenceAuthorized,
  fixtures,
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
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
/**
 * Espera a que el botón de firmar esté abierto o cerrado.
 *
 * Se pregunta por el estado del control, no por un tiempo: quién lo abre es un `setState` del
 * lienzo, y un `waitForTimeout` aquí sería una carrera con el reloj de la máquina que lo escribió.
 */
async function esperarFirmar(pagina, habilitado) {
  await pagina.waitForFunction(
    (quiero) => {
      const boton = [...document.querySelectorAll("button")].find(
        (el) => /^Firmar el contrato$/.test((el.textContent ?? "").trim()),
      );
      return Boolean(boton) && !boton.disabled === quiero;
    },
    habilitado,
    { timeout: 15000 },
  );
}

async function firmar(pagina, quien, retrato) {
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

  /*
   * El lienzo tiene que estar **antes** de pedir el código, y esta aserción existe porque no lo
   * estaba: vivía dentro del segundo paso, así que quien abría la etapa veía la cláusula y un botón
   * para pedir un código y ningún sitio donde dibujar — con el trazo obligatorio, la mitad del
   * trámite escondida detrás del paso siguiente. Se reportó como "no veo la opción para dibujar la
   * firma" desde la vista del inquilino.
   */
  const bloqueAntes = pagina.locator('[data-slot="signature-sign"]');
  if (!(await bloqueAntes.locator('canvas[aria-label="Dibuja tu firma"]').count())) {
    throw new Error(`a ${quien} no le ofrecen dibujar la firma hasta después de pedir el código`);
  }
  ok(`${quien} ve el lienzo desde el primer paso, antes de pedir el código`);
  /*
   * Cómo se ve la etapa al llegar, que es la vista que faltaba. Una foto no es una aserción, y este
   * bloque se vuelve a renderizar solo —la página está suscrita a su propia postulación y llama a
   * `router.refresh()`— así que el nodo puede desprenderse justo mientras se captura. Una corrida
   * murió así. Que falle la foto no puede tumbar el driver.
   */
  await bloqueAntes
    .screenshot({ path: `${SHOT_DIR}/contrato-firma-paso1-${retrato}.png` })
    .catch(() => undefined);

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
   * El dibujo, que **las dos partes** tienen que hacer: el lienzo ya no es un añadido opcional, así
   * que su ausencia es un fallo del producto y no una rama que se salta. Se traza con el ratón, y
   * con `pointer` en vez de `mouse` porque el componente escucha eventos de puntero para servir
   * también al dedo.
   */
  const bloque = pagina.locator('[data-slot="signature-sign"]');
  const lienzo = bloque.locator('canvas[aria-label="Dibuja tu firma"]');
  if (!(await lienzo.count())) {
    throw new Error(`no le ofrecen dibujar la firma a ${quien}`);
  }
  // Y ya no se anuncia como opcional, que es justo lo que cambió.
  if (/opcional/i.test(await bloque.innerText())) {
    throw new Error(`a ${quien} todavía le dicen que la firma dibujada es opcional`);
  }

  /*
   * La aserción del nuevo requisito: con el código puesto y sin dibujo, el botón sigue cerrado. Va
   * en este orden a propósito — comprobarlo con el código vacío no diría nada del dibujo.
   */
  await pagina.locator("#signature-code").fill(codigo);
  const firmarBtn = pagina.getByRole("button", { name: /^Firmar el contrato$/i });
  if (!(await firmarBtn.isDisabled())) {
    throw new Error(`${quien} puede firmar sin dibujar la firma`);
  }
  ok(`${quien} no puede firmar sin dibujarla, ni con el código puesto`);

  /*
   * El camino de teclado, que es lo que hace que el requisito no excluya a nadie: un lienzo no se
   * opera con el teclado, así que el panel ofrece producir el trazo con el propio nombre. Se pulsa
   * con el teclado de verdad — `press` enfoca primero — y no con un clic, porque lo que se está
   * probando es justamente que se llega ahí sin ratón.
   */
  const conNombre = bloque.getByRole("button", { name: /Usar mi nombre como firma/i });
  if (!(await conNombre.count())) {
    throw new Error(`${quien} no tiene forma de firmar sin dibujar: el lienzo sería una puerta cerrada`);
  }
  await conNombre.press("Enter");
  await esperarFirmar(pagina, true);
  ok(`${quien} puede producir su firma con el teclado, sin dibujar`);

  /*
   * Y se borra para dibujarla a mano, que es el camino de esta prueba. Borrar tiene que volver a
   * cerrar la compuerta: un trazo borrado que dejara el botón abierto sería firmar sin firma.
   */
  await bloque.getByRole("button", { name: /Borrar y volver a dibujar/i }).click();
  await esperarFirmar(pagina, false);
  ok(`${quien} borra el trazo y el botón se cierra otra vez`);

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
  // El panel con el lienzo dibujado y el código puesto, que es el estado nuevo de esta etapa.
  await bloque.screenshot({ path: `${SHOT_DIR}/contrato-firma-${retrato}.png` }).catch(() => undefined);

  // Y el botón se abre con el trazo. Se espera la consecuencia, no un tiempo.
  await esperarFirmar(pagina, true);
  await firmarBtn.click();
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
  await acceptLegalConsents(p);
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
await declareReferenceAuthorized(inq);
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
await dueño.waitForFunction(() => document.body.innerText.includes("Paso 6 de 7"), null, { timeout: 20000 });
ok("el proceso esta en la firma", "paso 6 de 7");

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

/*
 * Subido no es firmado: la compuerta sigue cerrada. Y lo que falta primero son los **recuadros**, no
 * las firmas — con el dibujo obligatorio para las dos partes no hay dónde estampar hasta que estén,
 * así que el panel no ofrece firmar todavía. Antes de esto el panel decía "faltan las dos firmas" y
 * ofrecía el formulario.
 */
if (!(await dueño.evaluate(() => document.body.innerText)).includes("Marca en el PDF dónde firma cada parte")) {
  throw new Error("con el contrato subido y sin recuadros no dice que hay que marcarlos");
}
if (await dueño.locator('[data-slot="signature-sign"]').count()) {
  throw new Error("ofrece firmar antes de que haya dónde dibujar la firma");
}
ok("subir no es firmar: primero hay que marcar dónde, y no ofrece firmar antes");

/*
 * El botón de seguir vive en dos sitios —arriba y al pie de la etapa— pero el del pie **solo cuando
 * el paso ya está listo**: una tarjeta que termina en un botón deshabilitado termina en un "no", y
 * el motivo del "no" ya está escrito arriba. Con el contrato sin firmar, uno solo.
 */
const seguir = () => dueño.getByRole("button", { name: /Continuar a/i });
if ((await seguir().count()) !== 1) {
  throw new Error(
    `con la etapa bloqueada hay ${await seguir().count()} botones de continuar; debería haber solo el de arriba`,
  );
}
ok("con la etapa bloqueada, el botón de seguir solo está arriba");

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

// Y con ellos guardados, lo que falta pasa a ser lo que siempre fue: las dos firmas.
await dueño.waitForFunction(
  () => /Falta que firmen las dos partes/.test(document.body.innerText),
  null,
  { timeout: 20000 },
);
if (!(await dueño.locator('[data-slot="signature-sign"]').count())) {
  throw new Error("con los recuadros marcados todavía no ofrece firmar");
}
ok("con los recuadros marcados ya ofrece firmar, y dice que faltan las dos firmas");
await dueño.screenshot({ path: `${SHOT_DIR}/contrato-recuadros.png`, fullPage: true });

// ---------- firma el propietario ----------
await firmar(dueño, "el propietario", "propietario");
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
 * Cómo llega el contrato a quien tiene derecho a leerlo, y a nadie más.
 *
 * Esto **era** una sola aserción sobre la URL firmada, y en la suite emulada no se podía correr:
 * firmar necesita una cuenta de servicio y un proyecto `demo-` no tiene ninguna, así que el enlace
 * no existe y el driver moría aquí — con la mitad del inquilino, que es la que importa, sin correr
 * nunca. Ahora son dos:
 *
 *   1. si hay URL firmada (proyecto real), se comprueba exactamente lo de antes: que es de Storage,
 *      que viene firmada y que caduca;
 *   2. y en los dos entornos, la propiedad que esa URL defiende — que el contrato **no se lee sin
 *      ser parte del proceso** — contra la ruta del propio origen, que sí funciona aquí.
 *
 * La segunda es más fuerte que la primera: mira quién puede leer el archivo, no cómo está formada
 * la dirección.
 */
const suEnlace = await inq.locator('a:has-text("documento.pdf")').first().getAttribute("href").catch(() => null);
if (suEnlace) {
  if (!/^https:\/\/storage\.googleapis\.com\//.test(suEnlace)) {
    throw new Error("el contrato no se sirve por una URL firmada de Storage: " + suEnlace);
  }
  /*
   * Firma y caducidad, sin atarse al esquema: el SDK firma con V2 (`Signature` + `Expires`) o con
   * V4 (`X-Goog-Signature` + `X-Goog-Expires`) según cómo esté configurado, y cuál use no es lo que
   * esta prueba defiende. Lo que defiende es que el contrato no se sirve por una URL pública.
   */
  const params = new URL(suEnlace).searchParams;
  if (!(params.get("Signature") ?? params.get("X-Goog-Signature"))) {
    throw new Error("la URL del contrato no viene firmada: " + suEnlace);
  }
  if (!(params.get("Expires") ?? params.get("X-Goog-Expires"))) {
    throw new Error("la URL del contrato no caduca: " + suEnlace);
  }
  ok("y lo lee por una URL firmada que caduca, no por una pública");
} else {
  /*
   * Sin cuenta de servicio no hay enlace, y el registro tiene que seguir en pantalla: colgar el
   * bloque entero de la firma de la URL dejaba el panel diciendo "sube el contrato" con el contrato
   * subido, que es el fallo que `features/lease` ya había pagado una vez.
   */
  if (!suyo.includes("no pudimos generar el enlace")) {
    throw new Error("sin URL firmada no dice por qué no se puede abrir el contrato");
  }
  ok("sin cuenta de servicio no hay URL firmada, y el registro sigue en pantalla diciéndolo");
}

// Y la ruta del propio origen: sirve el PDF a una parte…
const rutaContrato = `${BASE}/api/arriendos/${applicationId}/contrato`;
const comoParte = await inq.request.get(rutaContrato);
if (comoParte.status() !== 200) {
  throw new Error("una parte no puede leer su propio contrato: " + comoParte.status());
}
if ((await comoParte.body()).subarray(0, 5).toString() !== "%PDF-") {
  throw new Error("la ruta del contrato no devuelve un PDF");
}
// …y a un extraño, nada: sin sesión `requireCompleteProfile()` lo manda al login.
const extraño = await b.newContext();
const comoExtraño = await extraño.request.get(rutaContrato);
if ((await comoExtraño.body()).subarray(0, 5).toString() === "%PDF-") {
  throw new Error("un extraño sin sesión se descarga el contrato");
}
await extraño.close();
ok("el contrato se lee por la ruta propia solo si eres parte; un extraño no lo baja");

if (await inq.locator("#contract-file").count()) {
  throw new Error("al inquilino le ofrecen subir el contrato");
}
ok("el inquilino no puede subirlo: eso es del propietario");

// ---------- firma el inquilino, y con eso avanza ----------
/*
 * Aquí está la mitad que faltaba: el inquilino dibuja **su** firma. `firmar` es el mismo helper que
 * usó el propietario, y eso es lo que asserta que las dos partes recorren el mismo camino en vez de
 * uno con lienzo y otro sin él.
 */
await firmar(inq, "el inquilino", "inquilino");
ok("el inquilino firma con su propio código, y dibujando su firma como el propietario");

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
/*
 * Se comprueba lo mismo por los dos caminos —que existe, que es un PDF y que creció— y el que se
 * usa depende de si el entorno puede firmar URLs. Los bytes son la aserción de verdad; la URL
 * firmada es cómo llegan a un navegador.
 */
/*
 * Y con las dos firmas puestas, marcar dónde se firma deja de existir: el PDF estampado se genera
 * una sola vez —al entrar la segunda firma— así que mover un recuadro después guardaría unas
 * coordenadas que ya nadie lee. Un control que no cambia nada es la misma mentira que un
 * "Continuar" que no continúa.
 */
const textoFirmado = await dueño.evaluate(() => document.body.innerText);
if (/Dónde firma cada parte/.test(textoFirmado)) {
  throw new Error("con el contrato firmado todavía ofrece cambiar los recuadros");
}
if (await dueño.getByRole("button", { name: /Cambiar los recuadros/i }).count()) {
  throw new Error("con el contrato firmado sigue el botón de cambiar los recuadros");
}
/*
 * Y la nota, por lo mismo: viaja dentro del `FormData` de la subida, así que con el contrato ya
 * firmado es un campo que se puede escribir y que nada guarda. La nota que sí se guardó se sigue
 * leyendo arriba, junto al archivo.
 */
if (/Nota sobre el contrato/.test(textoFirmado)) {
  throw new Error("con el contrato firmado todavía ofrece escribir la nota");
}
if (await dueño.locator("#contract-note").count()) {
  throw new Error("con el contrato firmado sigue el campo de la nota");
}
if (!/Firmado por las dos partes el 20 de septiembre/.test(textoFirmado)) {
  throw new Error("la nota que sí se guardó desapareció del registro");
}
ok("firmado por los dos: sin recuadros ni campo de nota, y la nota guardada sigue a la vista");

const enlaceFirmado = await dueño
  .getByRole("link", { name: /Contrato firmado/i })
  .first()
  .getAttribute("href")
  .catch(() => null);

let cuerpo;
if (enlaceFirmado) {
  const paramsFirmado = new URL(enlaceFirmado).searchParams;
  if (!(paramsFirmado.get("Signature") ?? paramsFirmado.get("X-Goog-Signature"))) {
    throw new Error("el PDF firmado no se sirve por una URL firmada: " + enlaceFirmado);
  }
  const descarga = await dueño.request.get(enlaceFirmado);
  if (descarga.status() !== 200) throw new Error("el PDF firmado no se descarga: " + descarga.status());
  cuerpo = await descarga.body();
} else {
  // Sin firma de URL, los bytes se leen del bucket con el Admin SDK, que es más directo todavía.
  const registro = (await db.collection("applications").doc(applicationId).get()).data();
  const ruta = registro?.contract?.stamped?.path;
  if (!ruta) throw new Error("no quedó registrado el PDF firmado en la postulación");
  if (!registro.contract.stamped.sha256) {
    throw new Error("el PDF firmado no lleva su propio hash: estampar cambia los bytes");
  }
  [cuerpo] = await adminStorage().file(ruta).download();
}
if (cuerpo.subarray(0, 5).toString() !== "%PDF-") throw new Error("lo descargado no es un PDF");
if (cuerpo.length <= 193) throw new Error("el PDF firmado no creció: no se estampó nada");
ok("se genera el PDF firmado, con los trazos y la hoja de evidencia", `${cuerpo.length} bytes`);

/*
 * Y ahora que la etapa está lista, el botón aparece también al pie de su propia tarjeta. Se
 * comprueba que son dos y que el segundo está **dentro** de la etapa, no en cualquier parte de la
 * página: lo que se pidió es tenerlo donde se termina de trabajar.
 */
if ((await seguir().count()) !== 2) {
  throw new Error(`con la etapa lista hay ${await seguir().count()} botones de continuar; deberían ser dos`);
}
const alPie = dueño.locator("#etapa-contract-signature").getByRole("button", { name: /Continuar a/i });
if ((await alPie.count()) !== 1) {
  throw new Error("el botón de seguir no está dentro de la tarjeta de la etapa");
}
ok("con la etapa lista, el mismo botón aparece al pie de su tarjeta");
await dueño
  .locator("#etapa-contract-signature")
  .screenshot({ path: `${SHOT_DIR}/contrato-continuar-al-pie.png` })
  .catch(() => undefined);

// Y avanza de verdad desde ahí, que es lo único que lo distingue de un botón decorativo.
await alPie.click();
await dueño.waitForFunction(
  () => document.body.innerText.includes("Paso 7 de 7"),
  null,
  { timeout: 30000 },
);
ok("y desde ahí el proceso avanza a la etapa siguiente", "paso 7 de 7");

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
