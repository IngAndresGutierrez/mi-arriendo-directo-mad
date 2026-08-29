/**
 * Los incidentes de un arriendo en curso: el inquilino reporta, las dos partes leen.
 *
 * Lo que se maneja, en este orden: que la sección existe vacía y dice qué hacer, que el propietario
 * **no** tiene el formulario, que un archivo que no es foto ni video se rechaza antes de salir del
 * navegador, que un reporte con una foto y un video queda escrito con sus dos adjuntos, que el
 * propietario lo ve con el video como video, que **las dos partes lo gestionan** hasta cerrarlo, que
 * le llega la notificación apuntando al reporte, y que la pantalla sigue teniendo **un solo acento
 * cyan** — el mes que se debe, no el incidente.
 *
 * De la gestión, lo que se maneja es la asimetría que sostiene el dominio: el propietario puede
 * ponerlo en arreglo y decir que lo arregló, y **no puede resolverlo ni cerrarlo**; el inquilino
 * confirma o dice que sigue mal, y para decir que sigue mal tiene que decir por qué.
 *
 * Y la mitad que las pestañas hacen frágil: que un enlace a `#incidente-<id>` **abre la pestaña de
 * incidentes por sí solo**. Los meses y los reportes viven en paneles distintos y Radix desmonta el
 * que no se ve, así que un ancla cuyo destino no está montado no lleva a ninguna parte y no se queja:
 * el correo se ve bien y el clic parece no hacer nada.
 *
 * **La tenencia se siembra con el Admin SDK en vez de recorrer las ocho etapas.** Que llegar a
 * `active` abre el arriendo ya lo maneja `rental.mjs`, y repetirlo aquí serían noventa segundos de
 * formularios para llegar al punto donde empieza esta prueba. Lo que este driver necesita del
 * proceso es únicamente su resultado: un documento en `leases` con dos partes de verdad.
 */
import {
  adminDb,
  adminFieldValue,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fixtures,
  launch,
  leaseTab,
  ok,
  reactReady,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO, pdf: PDF, video: VIDEO } = fixtures();

const db = adminDb();
const FieldValue = adminFieldValue();
const { browser, problems } = await launch();

const TITULO = "Se rompió el sifón del lavaplatos";
const DESCRIPCION =
  "Desde anoche gotea debajo del mueble de la cocina. Puse una olla para recoger el agua, pero el mueble ya está mojado.";

/** Los incidentes que el producto escribió de verdad, no lo que la pantalla dice. */
async function incidentesEscritos(leaseId) {
  const snapshot = await db.collection("leases").doc(leaseId).collection("incidents").get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ---------- dos cuentas y una tenencia en curso ----------
const dueñoEmail = `incdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `incinq-${STAMP}@miarriendodirecto.test`;
const INQ_NOMBRE = "Carlos Inquilino Ramírez";

// `createAccount` devuelve el `localId`, que es el uid: es lo que la tenencia necesita nombrar.
const dueñoCuenta = await createAccount(API_KEY, dueñoEmail);
const inqCuenta = await createAccount(API_KEY, inqEmail);

const [dueño, inq] = await Promise.all([
  openSession(browser, { email: dueñoEmail, name: "Ana Propietaria Pérez", problems }),
  openSession(browser, { email: inqEmail, name: INQ_NOMBRE, problems }),
]);
ok("dos sesiones abiertas");

/*
 * Empieza dos meses atrás: así hay un mes vencido y la pantalla tiene su acción en cyan, que es
 * contra la que se comprueba que los botones de los incidentes son `brand` y no otro acento.
 */
const hoy = new Date();
const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 10));
const LEASE_ID = `lease-incidents-${STAMP}`;

await db
  .collection("leases")
  .doc(LEASE_ID)
  .set({
    propertyId: `property-${STAMP}`,
    propertySlug: `apartamento-con-patio-en-palermo-manizales-${STAMP}`,
    propertyTitle: `Apartamento con patio en Palermo ${STAMP}`,
    propertyCity: "Manizales",
    landlordUid: dueñoCuenta.localId,
    tenantUid: inqCuenta.localId,
    tenantName: INQ_NOMBRE,
    monthlyCost: 1_800_000,
    startDate: inicio.toISOString().slice(0, 10),
    months: 12,
    payout: {
      method: "breb",
      phone: "",
      key: "@ana2026",
      accountType: "",
      accountNumber: "",
      bankName: "",
      holderName: "Ana Propietaria Pérez",
      holderDocument: "",
      note: "",
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
ok("tenencia en curso sembrada", LEASE_ID);

const URL_ARRIENDO = `${BASE}/arriendos/${LEASE_ID}`;

// ---------- la sección vacía, y quién tiene el formulario ----------
await inq.goto(URL_ARRIENDO, { waitUntil: "domcontentloaded" });
await settled(inq);

/*
 * Abre en "Pagos", así que hay que ir a Incidentes.
 *
 * **Se afirma que la pestaña existe, no cuántas hay.** La versión anterior contaba tres y se puso
 * roja el día que llegó el acta de entrega — que es una cuarta sección legítima y no tiene nada que
 * ver con este driver. Contar era una segunda copia de "de cuántas partes se compone un arriendo",
 * exactamente la clase de regla del producto que un driver no debe repetir.
 */
const rail = inq.getByRole("tablist", { name: /Secciones del arriendo/i });
if ((await rail.getByRole("tab", { name: /Incidentes/i }).count()) !== 1) {
  throw new Error(`el arriendo no ofrece la pestaña de incidentes: ${await rail.innerText()}`);
}
await leaseTab(inq, "Incidentes");

const seccion = inq.getByRole("region", { name: /Incidentes/i });
if ((await seccion.count()) !== 1) {
  throw new Error("la pantalla del arriendo no tiene una sección de incidentes");
}
if (!/No has reportado nada/i.test(await seccion.innerText())) {
  throw new Error(`el estado vacío del inquilino no dice qué hacer: ${await seccion.innerText()}`);
}
ok("el inquilino ve la sección vacía y qué hacer con ella");

await dueño.goto(URL_ARRIENDO, { waitUntil: "domcontentloaded" });
await settled(dueño);
await leaseTab(dueño, "Incidentes");
const seccionDueño = dueño.getByRole("region", { name: /Incidentes/i });
if ((await seccionDueño.getByRole("button", { name: /Reportar un incidente/i }).count()) !== 0) {
  throw new Error("al propietario se le ofrece reportar un incidente, y eso lo hace el inquilino");
}
if (!/El inquilino no ha reportado nada/i.test(await seccionDueño.innerText())) {
  throw new Error("el propietario no ve el estado vacío desde su lado");
}
ok("el propietario lee la sección pero no puede reportar");

// ---------- un archivo que no es foto ni video ----------
await reactReady(inq, "#incidentes button");
await inq.getByRole("button", { name: /Reportar un incidente/i }).click();
await reactReady(inq, "#incident-files");

await inq.setInputFiles("#incident-files", PDF);
const rechazo = seccion.locator('[role="alert"]');
await rechazo.waitFor({ state: "visible", timeout: 15000 });
if (!/fotos.*videos|videos.*fotos/i.test(await rechazo.innerText())) {
  throw new Error(`el rechazo del PDF no dice qué se acepta: ${await rechazo.innerText()}`);
}
/*
 * Y **no se subió nada**: el juicio ocurre antes de que el fichero salga del navegador, que es lo
 * que hace que un PDF de 3 MB no gaste una subida para ser rechazado después.
 */
if ((await seccion.locator("video, img").count()) !== 0) {
  throw new Error("el PDF rechazado dejó una vista previa en el formulario");
}
ok("un PDF se rechaza en el navegador, sin subir nada");

// ---------- el reporte, con una foto y un video ----------
await inq.locator("#incident-title").fill(TITULO);
await inq.locator("#incident-description").fill(DESCRIPCION);
await inq.setInputFiles("#incident-files", [PHOTO, VIDEO]);

// Las dos vistas previas se hacen en el navegador, sin red: si no aparecen, el `change` se perdió.
await seccion.locator("video").first().waitFor({ state: "visible", timeout: 15000 });
if ((await seccion.locator("img").count()) < 1) {
  throw new Error("la foto elegida no dejó vista previa");
}
ok("las dos vistas previas se ven antes de enviar");

await seccion.screenshot({ path: `${SHOT_DIR}/incidente-formulario.png` }).catch(() => undefined);

await inq.getByRole("button", { name: /Reportar el incidente/i }).click();

/*
 * Se espera **la consecuencia**, no el rótulo: el documento escrito con sus dos adjuntos. Y se
 * espera también el error del panel, porque si la acción falla, esperar solo el documento son
 * cuarenta segundos hasta un timeout que no dice nada y un motivo que ya estaba en pantalla.
 */
let escritos = [];
const limite = Date.now() + 60000;
while (Date.now() < limite) {
  escritos = await incidentesEscritos(LEASE_ID);
  if (escritos.length > 0) break;

  const alerta = seccion.locator('[role="alert"]');
  if ((await alerta.count()) > 0 && (await alerta.first().innerText()).trim()) {
    throw new Error(`el panel respondió con un error: ${(await alerta.first().innerText()).trim()}`);
  }
  await inq.waitForTimeout(500);
}
if (escritos.length !== 1) {
  throw new Error(`se esperaba un incidente escrito y hay ${escritos.length}`);
}

const escrito = escritos[0];
if (escrito.title !== TITULO) throw new Error(`el título guardado es "${escrito.title}"`);
if (escrito.description !== DESCRIPCION) throw new Error("la descripción no se guardó igual");
if (escrito.reporterUid !== inqCuenta.localId) {
  throw new Error("el reporte no quedó a nombre del inquilino que lo escribió");
}
if (escrito.attachments?.length !== 2) {
  throw new Error(`se esperaban 2 adjuntos y hay ${escrito.attachments?.length}`);
}
/*
 * Y los dos ficheros están **en la carpeta del inquilino**: es la única cosa que las reglas de
 * Storage pueden comprobar, porque no pueden leer Firestore para saber quién es parte de qué.
 */
for (const adjunto of escrito.attachments) {
  if (!adjunto.path.startsWith(`incidents/${inqCuenta.localId}/`)) {
    throw new Error(`un adjunto quedó fuera de la carpeta del inquilino: ${adjunto.path}`);
  }
  if (!(adjunto.bytes > 0)) throw new Error(`un adjunto quedó sin tamaño: ${adjunto.path}`);
}
const tipos = escrito.attachments.map((one) => one.contentType).sort();
if (tipos.join(",") !== "image/png,video/mp4") {
  throw new Error(`los tipos guardados son ${JSON.stringify(tipos)}`);
}
ok("el reporte queda escrito con sus dos adjuntos, confirmados contra el bucket");

// ---------- lo que el inquilino ve después ----------
const fila = inq.locator(`li[data-incident="${escrito.id}"]`);
await fila.waitFor({ state: "visible", timeout: 20000 });
if ((await fila.getAttribute("data-attachments")) !== "2") {
  throw new Error("la fila no dice que el reporte trae dos archivos");
}
if (!/1 foto · 1 video/.test(await fila.innerText())) {
  throw new Error(`la cabecera no cuenta los archivos: ${await fila.innerText()}`);
}
ok("el reporte aparece en la lista contando sus archivos");

// ---------- el propietario lo lee, con el video como video ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await leaseTab(dueño, "Incidentes");

const filaDueño = dueño.locator(`li[data-incident="${escrito.id}"]`);
await filaDueño.waitFor({ state: "visible", timeout: 20000 });
await reactReady(dueño, `li[data-incident="${escrito.id}"] button`);
await filaDueño.getByRole("button").first().click();

const cuerpo = dueño.locator(`#incidente-panel-${escrito.id}`);
await cuerpo.waitFor({ state: "visible", timeout: 15000 });
if (!(await cuerpo.innerText()).includes(DESCRIPCION)) {
  throw new Error("el propietario no lee la descripción del reporte");
}
if (!(await cuerpo.innerText()).includes(INQ_NOMBRE)) {
  throw new Error("el reporte no dice quién lo reportó");
}
/*
 * Un video se trata como video y una foto como foto, que es la razón entera por la que esta etapa
 * acepta los dos: un fotograma no puede llevar "solo gotea con el agua abierta". Esa decisión se
 * toma con el `contentType` del documento, así que se puede exigir siempre.
 */
if ((await cuerpo.locator('[data-attachment="video"]').count()) !== 1) {
  throw new Error("el adjunto de video no se distingue del de foto en el lado del propietario");
}
if ((await cuerpo.locator('[data-attachment="image"]').count()) !== 1) {
  throw new Error("la foto no aparece como foto en el lado del propietario");
}
/*
 * Y el **registro se lee del documento**: el nombre y el peso están en pantalla tanto si se pudo
 * firmar la URL como si no. Es la regla que este módulo ya pagó dos veces — en el panel del canon y
 * en la etapa del contrato —, y lo que protege es justo esto: firmar puede fallar (un fichero
 * borrado, Cloud Storage caído, un entorno sin cuenta de servicio) y lo único que se pierde es poder
 * *abrir* el archivo.
 */
const textoAdjuntos = await cuerpo.locator('[data-attachment="video"]').innerText();
if (!textoAdjuntos.includes("video.mp4")) {
  throw new Error(`el adjunto no muestra su nombre: ${textoAdjuntos}`);
}

/*
 * El enlace, que es la otra mitad: con URL firmada tiene que ser un `<video>` de verdad; sin ella,
 * el aviso de que no se pudo abrir. Se comprueba **cuál de las dos pasó** en vez de suponerlo,
 * porque la suite emulada no tiene cuenta de servicio y por tanto no puede firmar nada — y una
 * aserción que solo mira el `<video>` sería verde en producción y roja aquí por el motivo correcto,
 * que es la peor clase de driver: el que hay que recordar por qué falla.
 */
const conVideo = await cuerpo.locator('[data-attachment="video"] video').count();
const sinFirma = await cuerpo
  .locator('[data-attachment="video"]')
  .getByText(/No pudimos abrir/i)
  .count();
if (conVideo === 1) {
  ok("el propietario lee el reporte y el video se pinta como <video>");
} else if (sinFirma === 1) {
  ok("sin URL firmada (emulador sin cuenta de servicio) el registro del video sigue completo");
} else {
  throw new Error(
    `el adjunto de video no es ni un <video> ni el aviso de que no se pudo abrir: ${await cuerpo
      .locator('[data-attachment="video"]')
      .innerHTML()}`.slice(0, 400),
  );
}
await cuerpo.screenshot({ path: `${SHOT_DIR}/incidente-propietario.png` }).catch(() => undefined);

// ---------- gestionarlo: las dos partes, hasta cerrarlo ----------
/**
 * Qué estado dejó el producto en un incidente. Se le pregunta a él en vez de recalcularlo aquí: el
 * estado se deriva del hilo, y una aserción que repitiera esa derivación sería una segunda copia de
 * la regla — y la que nadie mira sería esta.
 */
const estadoIncidente = (page) =>
  page.locator(`li[data-incident="${escrito.id}"]`).getAttribute("data-state");

/** Abre la ficha de un incidente si está plegada. */
async function abrirIncidente(page) {
  const fila = page.locator(`li[data-incident="${escrito.id}"]`);
  await fila.waitFor({ state: "visible", timeout: 20000 });
  await reactReady(page, `li[data-incident="${escrito.id}"] button`);
  if ((await fila.getByRole("button").first().getAttribute("aria-expanded")) === "false") {
    await fila.getByRole("button").first().click();
  }

  return fila;
}

/**
 * Pulsa un movimiento y espera **la consecuencia**: que el producto diga que el incidente quedó en
 * ese estado. Y espera también el error del panel, porque si la acción falla, esperar sólo el estado
 * son cuarenta segundos hasta un timeout que no dice nada y un motivo que ya estaba en pantalla.
 */
async function mover(page, to, esperado, nota) {
  const fila = await abrirIncidente(page);
  if (nota) await page.locator(`#incident-note-${escrito.id}`).fill(nota);
  await fila.locator(`[data-move-to="${to}"]`).click();

  await page.waitForFunction(
    ([id, state]) => {
      const li = document.querySelector(`li[data-incident="${id}"]`);
      const alerta = document.querySelector('main [role="alert"]');
      return li?.getAttribute("data-state") === state || Boolean(alerta?.textContent?.trim());
    },
    [escrito.id, esperado],
    { timeout: 40000 },
  );
  const alerta = page.locator('main [role="alert"]').first();
  if ((await alerta.count()) > 0 && (await alerta.innerText()).trim()) {
    throw new Error(`el panel respondió con un error: ${(await alerta.innerText()).trim()}`);
  }
}

if ((await estadoIncidente(dueño)) !== "reported") {
  throw new Error(`un incidente nuevo no queda "reported": ${await estadoIncidente(dueño)}`);
}

/*
 * **El propietario no puede resolverlo, en ningún estado.** Es la regla que mantiene honesto el
 * dominio entero: si la ducha funciona lo sabe quien se ducha, igual que si el dinero llegó lo sabe
 * el dueño de la cuenta. Se comprueba en el producto, no sólo en el dominio: la ficha no ofrece el
 * botón.
 */
const fichaDueño = await abrirIncidente(dueño);
if ((await fichaDueño.locator('[data-move-to="resolved"]').count()) !== 0) {
  throw new Error("al propietario se le ofrece resolver el incidente, y eso lo confirma el inquilino");
}
if ((await fichaDueño.locator('[data-move-to="withdrawn"]').count()) !== 0) {
  throw new Error("al propietario se le ofrece cerrar un reporte que no es suyo");
}
ok("el propietario no puede resolver ni cerrar: sólo el inquilino");

await mover(dueño, "in_progress", "in_progress", "Mando al plomero el martes en la mañana.");
ok("el propietario lo pone en arreglo");

await mover(dueño, "awaiting_confirmation", "awaiting_confirmation", "Cambié el sifón completo.");
ok("y dice que ya lo arregló");

// Ya dijo que lo arregló: no le queda nada que pulsar más que esperar.
const trasArreglar = await abrirIncidente(dueño);
if ((await trasArreglar.locator("[data-move-to]").count()) !== 0) {
  throw new Error("el propietario sigue teniendo botones después de decir que lo arregló");
}
ok("y desde ahí no le queda nada que pulsar");

// ---------- el inquilino dice que sigue mal, y hace falta decir por qué ----------
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await leaseTab(inq, "Incidentes");
const fichaInq = await abrirIncidente(inq);

// Sin nota, el producto se niega: decir "sigue roto" obliga a decir qué sigue roto.
await fichaInq.locator('[data-move-to="in_progress"]').click();
const exige = inq.locator('main [role="alert"]').first();
await exige.waitFor({ state: "visible", timeout: 15000 });
if (!/qu[ée] sigue mal|qu[ée] corregir/i.test(await exige.innerText())) {
  throw new Error(`no exige el motivo al decir que sigue mal: ${await exige.innerText()}`);
}
if ((await estadoIncidente(inq)) !== "awaiting_confirmation") {
  throw new Error("se movió el incidente sin motivo");
}
ok("decir 'sigue mal' sin motivo se rechaza, y el incidente no se mueve");

await mover(inq, "in_progress", "in_progress", "Revisé y sigue goteando por el mismo sitio.");
ok("con el motivo, el inquilino lo devuelve a arreglo");

// ---------- y lo cierra confirmando ----------
await mover(inq, "resolved", "resolved", "");
ok("el inquilino confirma que quedó arreglado");

/*
 * Una gotera que vuelve es la misma gotera: el inquilino puede reabrirla y la historia del primer
 * arreglo se queda. Lo que se comprueba es que el hilo conserva lo anterior.
 */
const reabrible = await abrirIncidente(inq);
if ((await reabrible.locator('[data-move-to="in_progress"]').count()) !== 1) {
  throw new Error("un incidente resuelto no se puede reabrir");
}
const historial = await inq.getByRole("list", { name: /Historial del incidente/i }).innerText();
for (const frase of ["Mando al plomero", "Cambié el sifón", "sigue goteando"]) {
  if (!historial.includes(frase)) throw new Error(`el historial perdió "${frase}"`);
}
ok("el historial guarda las cuatro cosas que pasaron, en orden");

// Y lo que quedó escrito en Firestore es exactamente eso.
const [finalDoc] = await incidentesEscritos(LEASE_ID);
if (finalDoc.updates?.length !== 4) {
  throw new Error(`se esperaban 4 movimientos en el hilo y hay ${finalDoc.updates?.length}`);
}
const movimientos = finalDoc.updates.map((one) => `${one.by}:${one.movedTo}`);
if (
  movimientos.join(" ") !==
  "landlord:in_progress landlord:awaiting_confirmation tenant:in_progress tenant:resolved"
) {
  throw new Error(`el hilo no quedó como se manejó: ${JSON.stringify(movimientos)}`);
}
ok("el hilo escrito dice quién movió qué, en orden", movimientos.join(" → "));

await reabrible.screenshot({ path: `${SHOT_DIR}/incidente-gestionado.png` }).catch(() => undefined);

// ---------- la notificación, apuntando al reporte ----------
const avisos = await db
  .collection("notifications")
  .where("recipientUid", "==", dueñoCuenta.localId)
  .where("type", "==", "incident_reported")
  .get();
if (avisos.empty) throw new Error("no se notificó al propietario del incidente");
const aviso = avisos.docs[0].data();
if (aviso.incident !== escrito.id) {
  throw new Error(`la notificación no apunta al reporte: ${JSON.stringify(aviso.incident)}`);
}
/*
 * Y lleva el **título**, nunca la descripción: es lo que el inquilino escribió sobre su casa con
 * algo roto dentro, y un correo se reenvía y se queda abierto en un portátil.
 */
if (aviso.detail !== TITULO) throw new Error("la notificación no lleva el título");
if (JSON.stringify(aviso).includes("goteando") || JSON.stringify(aviso).includes(DESCRIPCION)) {
  throw new Error("la notificación se llevó la descripción del incidente");
}
ok("al propietario le llega el aviso, con el título y apuntando al reporte");

// Y la campana lo enlaza al reporte, que es la mitad que el producto de verdad enseña.
const campana = dueño.getByRole("button", { name: /Notificaciones/i }).first();
if ((await campana.count()) > 0) {
  await reactReady(dueño, "header button, [data-slot] button");
  await campana.click();
  const enlace = dueño.getByRole("link", { name: /incidente/i }).first();
  if ((await enlace.count()) > 0) {
    const href = await enlace.getAttribute("href");
    if (!href?.includes(`#incidente-${escrito.id}`)) {
      throw new Error(`la campana no enlaza al reporte: ${href}`);
    }
    ok("y la campana enlaza directo al reporte", href);
  }
}

// ---------- un incidente de antes de que existiera el hilo ----------
/*
 * Escrito **sin la clave `updates`**, que es exactamente la forma que tienen los incidentes
 * reportados antes de que se pudieran gestionar. La lista se cayó con "Cannot read properties of
 * undefined (reading 'length')" por uno de estos, así que esto se maneja en el navegador y no sólo
 * en el dominio: lo que se rompió fue la página, con la fila plegada y todo.
 */
const VIEJO_ID = "incident-sin-hilo";
await db
  .collection("leases")
  .doc(LEASE_ID)
  .collection("incidents")
  .doc(VIEJO_ID)
  .set({
    title: "Gotera en el techo del cuarto",
    description: "Cada vez que llueve entra agua por la esquina, junto a la ventana.",
    attachments: [],
    reporterUid: inqCuenta.localId,
    reporterName: INQ_NOMBRE,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await leaseTab(inq, "Incidentes");

const viejo = inq.locator(`li[data-incident="${VIEJO_ID}"]`);
await viejo.waitFor({ state: "visible", timeout: 20000 });
if ((await viejo.getAttribute("data-state")) !== "reported") {
  throw new Error(`un incidente sin hilo no se lee como reportado: ${await viejo.getAttribute("data-state")}`);
}
await reactReady(inq, `li[data-incident="${VIEJO_ID}"] button`);
await viejo.getByRole("button").first().click();
if (!(await viejo.innerText()).includes("Cada vez que llueve")) {
  throw new Error("un incidente sin hilo no muestra su descripción");
}
ok("un incidente de antes del hilo se lee y se abre sin romper la lista");

await db.collection("leases").doc(LEASE_ID).collection("incidents").doc(VIEJO_ID).delete();
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);

// ---------- el ancla abre su pestaña ----------
/*
 * Sin pulsar nada: el enlace de la notificación es lo único que decide. Es la aserción que las
 * pestañas hicieron necesaria — antes todo estaba en la misma página y cualquier ancla resolvía.
 *
 * **Se pasa por la lista primero, y eso no es adorno.** Un `goto` a la misma URL que sólo cambia de
 * fragmento es una navegación *en el mismo documento*: el navegador desplaza y no recarga nada, así
 * que el efecto de montaje no vuelve a correr y el driver esperaba una pestaña que nadie había
 * cambiado. Falló una vez de tres por eso. Venir de otra pantalla es además lo que de verdad hace
 * quien abre el enlace de un correo.
 */
await inq.goto(`${BASE}/arriendos`, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.goto(`${URL_ARRIENDO}#incidente-${escrito.id}`, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.waitForFunction(
  (id) => {
    const active = document.querySelector('[data-slot="tabs-trigger"][data-state="active"]');
    return (
      Boolean(active?.textContent?.includes("Incidentes")) &&
      Boolean(document.getElementById(`incidente-${id}`))
    );
  },
  escrito.id,
  { timeout: 20000 },
);
ok("un enlace a #incidente-<id> abre la pestaña de incidentes por sí solo");

// ---------- un solo acento cyan ----------
/*
 * La regla es uno por vista, y con pestañas eso hay que comprobarlo en las dos que importan: en
 * "Pagos" tiene que haber **exactamente uno** — el mes que se debe — y en "Incidentes" **ninguno**,
 * porque sus botones son `brand`. Contar sólo en la pestaña de incidentes daría cero y pasaría sin
 * demostrar nada.
 */
const acentos = async () =>
  inq.evaluate(() =>
    [...document.querySelectorAll("main button, main label, main a")]
      .filter((el) => el.className.split(/\s+/).includes("bg-accent"))
      .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
  );

const enIncidentes = await acentos();
if (enIncidentes.length !== 0) {
  throw new Error(`los incidentes traen acento cyan y tienen que ir en brand: ${JSON.stringify(enIncidentes)}`);
}

await leaseTab(inq, "Pagos");
const enPagos = await acentos();
if (enPagos.length !== 1) {
  throw new Error(`en Pagos hay ${enPagos.length} acentos cyan y la regla es uno: ${JSON.stringify(enPagos)}`);
}
ok("un solo acento cyan, y está en el mes que se debe", enPagos[0]);

// ---------- 390px ----------
await inq.setViewportSize({ width: 390, height: 844 });
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
await assertNoHorizontalScroll(inq, "el arriendo a 390px");
await leaseTab(inq, "Incidentes");
await assertNoHorizontalScroll(inq, "los incidentes a 390px");
await reactReady(inq, "#incidentes button");
await inq.getByRole("button", { name: /Reportar un incidente/i }).click();
await reactReady(inq, "#incident-files");
await assertNoHorizontalScroll(inq, "el formulario de incidentes a 390px");
await inq
  .locator("#incidentes")
  .screenshot({ path: `${SHOT_DIR}/incidentes-390.png` })
  .catch(() => undefined);
ok("sin scroll horizontal a 390px, con el formulario abierto");

// ---------- limpieza ----------
/*
 * **El navegador se cierra antes de borrar**, y ese orden no es aseo: las dos pestañas tienen una
 * suscripción viva a `leases/{id}` — es lo que refresca la pantalla del otro cuando algo cambia — y
 * borrar el documento debajo de ellas hace que la regla lea `resource.data.tenantUid` de un
 * documento que ya no existe. El resultado es un `permission-denied` legítimo en la consola de las
 * dos, que `assertQuiet` cuenta como error del producto. En producción no pasa porque una tenencia
 * no se borra; aquí lo provocaba el propio arnés.
 */
await browser.close();

for (const uno of escritos) {
  await db.collection("leases").doc(LEASE_ID).collection("incidents").doc(uno.id).delete();
}
await db.collection("leases").doc(LEASE_ID).delete();

/*
 * Los avisos de las dos partes, no sólo los del reporte: gestionar el incidente manda uno por cada
 * movimiento, y `avisos` es sólo la consulta de `incident_reported`. Se borran por destinatario, que
 * es lo que abarca los cinco tipos sin tener que listarlos aquí — una lista que se queda corta el día
 * que se añade el sexto.
 */
for (const uid of [dueñoCuenta.localId, inqCuenta.localId]) {
  const suyos = await db.collection("notifications").where("recipientUid", "==", uid).get();
  for (const aviso of suyos.docs) await aviso.ref.delete();
}
ok("datos de prueba borrados");

assertQuiet(problems);
