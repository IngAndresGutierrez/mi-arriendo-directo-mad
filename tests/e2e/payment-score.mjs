/**
 * La calificación de cumplimiento de pago.
 *
 * Lo que se afirma aquí es sobre todo **lo que no sale**. La promesa entera del diseño es "el
 * propietario ve la nota y nunca los pagos", y esa promesa la rompe una división: con la regla de
 * tres, "4,2 estrellas" más "12 meses" da 10 a tiempo y 2 tarde. El driver comprueba sobre el HTML
 * —y sobre la carga RSC, que es donde este producto ya se quemó dos veces— que ni los montos ni las
 * fechas ni el número de meses cruzan.
 *
 * Y la otra mitad: que **sin autorización la nota no viaja**. No que no se pinte — que no esté.
 */
import { chromium } from "playwright";

import {
  adminDb,
  adminFieldValue,
  assertQuiet,
  BASE,
  config,
  createAccount,
  ok,
  openSession,
  openStagePanel,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const db = adminDb();
const FieldValue = adminFieldValue();

const INQUILINO = "Carlos Inquilino Ramírez";
const inqEmail = `score-tenant-${STAMP}@miarriendodirecto.test`;
const viejoEmail = `score-old-${STAMP}@miarriendodirecto.test`;
const nuevoEmail = `score-new-${STAMP}@miarriendodirecto.test`;

const inq = await createAccount(API_KEY, inqEmail);
const propietarioViejo = await createAccount(API_KEY, viejoEmail);
const propietarioNuevo = await createAccount(API_KEY, nuevoEmail);

/*
 * Un arriendo terminado con **otro** propietario: es de donde sale la nota, y es justo el dato que
 * el propietario nuevo no puede ver. Empieza hace catorce meses para que haya más de un año de
 * historial confirmado.
 */
const hoy = new Date();
const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 14, 5));
const LEASE_ID = `lease-score-${STAMP}`;
const CANON = 1_800_000;
/*
 * **El arriendo anterior tiene un canon distinto al de esta postulación, y eso hace la comprobación
 * de fuga posible.** Con la misma cifra en los dos, encontrar "1.800.000" en la página no decía
 * nada: el proceso muestra legítimamente su propio canon. Un número que solo puede venir del
 * historial es lo que convierte la aserción en una afirmación.
 */
const CANON_ANTERIOR = 2_345_678;

await db
  .collection("leases")
  .doc(LEASE_ID)
  .set({
    propertyId: `property-viejo-${STAMP}`,
    propertySlug: `apartamento-anterior-${STAMP}`,
    propertyTitle: `Apartamento anterior ${STAMP}`,
    propertyCity: "Manizales",
    landlordUid: propietarioViejo.localId,
    tenantUid: inq.localId,
    tenantName: INQUILINO,
    monthlyCost: CANON_ANTERIOR,
    startDate: inicio.toISOString().slice(0, 10),
    months: 12,
    payout: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

/**
 * **Se paga cada mes que ya venció, contados desde la fecha de inicio que este driver eligió.**
 *
 * Un número fijo no sirve: el arriendo empezó hace más de un término, así que bajo la Ley 820 **se
 * prorrogó** y `leaseSchedule` extiende el calendario por un término entero. Sembrar doce meses
 * dejaba dos en mora, y catorce dejaba uno — el producto tenía razón las dos veces y la siembra no.
 * Contar los vencidos no repite ninguna regla del producto: la fecha de inicio la puso este archivo.
 */
const MESES = [];
for (let i = 0; i < 36; i += 1) {
  const vence = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 5));
  /* Con margen sobre la gracia: un mes recién vencido todavía no es evidencia de nada. */
  if (vence.getTime() > hoy.getTime() - 8 * 86_400_000) break;
  MESES.push(vence.toISOString().slice(0, 7));
}

for (const periodo of MESES) {
  await db
    .collection("leases")
    .doc(LEASE_ID)
    .collection("periods")
    .doc(periodo)
    .set({
      amount: CANON_ANTERIOR,
      dueDate: `${periodo}-05`,
      receipt: {
        path: `canon/${LEASE_ID}/${periodo}.pdf`,
        fileName: "comprobante.pdf",
        contentType: "application/pdf",
        bytes: 1000,
        amount: CANON_ANTERIOR,
        paidOn: `${periodo}-04`,
        uploadedAt: `${periodo}-04T10:00:00.000Z`,
        note: "",
      },
      verdict: { status: "confirmed", at: `${periodo}-05T10:00:00.000Z`, reason: "" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}
ok("más de un año de arriendo confirmado con otro propietario", `${MESES.length} meses`);

// ---------- una postulación nueva, con un propietario distinto ----------
const APP_ID = `app-score-${STAMP}`;
await db
  .collection("applications")
  .doc(APP_ID)
  .set({
    propertyId: `property-nuevo-${STAMP}`,
    propertySlug: `apartamento-nuevo-${STAMP}`,
    propertyTitle: `Apartamento nuevo ${STAMP}`,
    propertyCity: "Manizales",
    monthlyCost: CANON,
    landlordUid: propietarioNuevo.localId,
    tenantUid: inq.localId,
    tenantName: INQUILINO,
    stage: "tenant_data",
    status: "open",
    dossier: {
      documentType: "cc",
      documentNumber: "1053812345",
      occupation: "employee",
      employer: "Crehana",
      monthlyIncome: 6_000_000,
      householdSize: 2,
      hasPets: false,
      petsDescription: "",
      reference: {
        name: "Carolina Restrepo",
        phone: "+573009876543",
        phoneCountry: "CO",
        relationship: "Jefe directo",
      },
    },
    desiredMoveIn: "2027-01-01",
    leaseMonths: 12,
    message: "",
    closingNote: "",
    checksAuthorizedAt: null,
    scoreAuthorizedAt: null,
    documentReviews: {},
    checkResults: {},
    history: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

const navegador = await chromium.launch();
const problemas = [];
const [inquilino, propietario] = await Promise.all([
  openSession(navegador, { email: inqEmail, name: INQUILINO, problems: problemas }),
  openSession(navegador, { email: nuevoEmail, name: "Ana Propietaria Pérez", problems: problemas }),
]);

const PROCESO = `${BASE}/contratos/${APP_ID}`;

/** Todo lo que el navegador recibió: el HTML **y** la carga RSC del final del documento. */
const recibido = (page) => page.content();

/* `stageAnchor` cambia los guiones bajos por guiones: `tenant_data` es `etapa-tenant-data`. */
const ETAPA = "#etapa-tenant-data";
const ETAPA_ID = "etapa-tenant-data";

// ---------- sin autorización, la nota NO viaja ----------
await propietario.goto(PROCESO, { waitUntil: "domcontentloaded" });
await settled(propietario);
await openStagePanel(propietario, ETAPA_ID);
const sinPermiso = await propietario.locator(ETAPA).innerText();
if (!sinPermiso.includes("todavía no ha autorizado")) {
  throw new Error("al propietario no se le dice por qué no ve la nota: " + sinPermiso);
}
/*
 * **Que no esté, no que no se pinte.** Un componente que recibiera la nota y decidiera no dibujarla
 * la seguiría llevando dentro de la carga RSC — es exactamente donde este producto ya se quemó dos
 * veces con el diccionario. El corte está en el servidor.
 */
/*
 * Se busca **el prop serializado**, no la etiqueta pintada: la primera versión buscaba "estrellas en
 * cumplimiento", que no está de todas formas porque la tarjeta no se dibuja — así que la aserción
 * pasaba también con la nota viajando dentro de la carga RSC. Se comprobó quitando el corte del
 * servidor y viendo que seguía verde. `a_year_or_more` solo puede venir del objeto de la nota.
 */
const crudoSinPermiso = await recibido(propietario);
if (crudoSinPermiso.includes("a_year_or_more") || /\bstars\b/.test(crudoSinPermiso)) {
  throw new Error("¡FUGA! la nota viaja al navegador del propietario sin autorización");
}
ok("sin autorización la nota no viaja al navegador, no es que no se pinte");

// ---------- el inquilino ve la suya, con los conteos ----------
await inquilino.goto(`${BASE}/perfil-inquilino`, { waitUntil: "domcontentloaded" });
await settled(inquilino);
const suPanel = inquilino.getByRole("region", { name: /Tu cumplimiento de pago/i });
const propia = await suPanel.innerText();
/*
 * **La nota se comprueba por su nombre accesible, no por el texto.** Las estrellas son cinco iconos:
 * lo que dice "5 de 5" es el `aria-label` del grupo, que es exactamente lo que recibe quien escucha
 * la página — y por tanto lo único que de verdad garantiza que la nota se comunica.
 */
await suPanel.getByRole("img", { name: /5 de 5 estrellas/ }).waitFor({ timeout: 15000 });
if (!/más de un año/i.test(propia)) {
  throw new Error("el inquilino no ve su franja de historial: " + propia);
}
if (!propia.includes(String(MESES.length))) {
  throw new Error("el inquilino no ve sus propios conteos: " + propia);
}
/*
 * **Que la vea no es una cortesía: es la Ley 1581.** Una calificación que la persona calificada no
 * puede consultar ni controvertir es lo que el hábeas data regula — y aquí sí van los números,
 * porque son su dato.
 */
if (!propia.includes("Si algo aquí no cuadra")) {
  throw new Error("no se le dice cómo controvertirla");
}
await inquilino.screenshot({ path: `${SHOT_DIR}/cumplimiento-propio.png`, fullPage: true });
ok("el inquilino ve su propia nota, con los conteos y cómo controvertirla");

// ---------- la autoriza ----------
await inquilino.goto(PROCESO, { waitUntil: "domcontentloaded" });
await settled(inquilino);
await openStagePanel(inquilino, ETAPA_ID);
const suyo = inquilino.locator(ETAPA);
await suyo.getByText("Es opcional").waitFor({ timeout: 20000 });
await inquilino.locator("#authorize-score").click();
await suyo.getByRole("button", { name: /Compartir mi calificación/ }).click();
await suyo.getByText("Esto es exactamente lo que él ve").waitFor({ timeout: 30000 });

const guardada = (await db.collection("applications").doc(APP_ID).get()).data();
if (!guardada.scoreAuthorizedAt) throw new Error("no quedó fechada la autorización");
if (!guardada.scoreAuthorizedVersion) {
  throw new Error("no quedó la versión de la política contra la que se autorizó");
}
ok("la autorización queda fechada y con la versión de la política", `v${guardada.scoreAuthorizedVersion}`);

// ---------- ahora el propietario ve la nota, y SOLO la nota ----------
await propietario.reload({ waitUntil: "domcontentloaded" });
await settled(propietario);
await openStagePanel(propietario, ETAPA_ID);
const conPermiso = await propietario.locator(ETAPA).innerText();
await propietario
  .locator(ETAPA)
  .getByRole("img", { name: /5 de 5 estrellas/ })
  .waitFor({ timeout: 15000 });
if (!conPermiso.includes("Cumplimiento de pago")) {
  throw new Error("el propietario no ve la nota tras la autorización: " + conPermiso);
}
await propietario.screenshot({ path: `${SHOT_DIR}/cumplimiento-propietario.png`, fullPage: true });

/*
 * **La aserción que sostiene todo.** Lo que no puede cruzar: el monto del canon, ninguna fecha de
 * pago, y el número de meses — con el que la nota se despeja. Se mira el documento entero, carga RSC
 * incluida, que es donde un objeto de más se cuela sin que se vea en pantalla.
 */
const crudo = await recibido(propietario);
for (const [que, aguja] of [
  ["el monto del canon anterior", "2.345.678"],
  ["ese monto en crudo", "2345678"],
  ["el título del arriendo anterior", `Apartamento anterior ${STAMP}`],
]) {
  if (crudo.includes(aguja)) throw new Error(`¡FUGA! el propietario recibió ${que}`);
}
for (const periodo of MESES) {
  if (crudo.includes(`${periodo}-04`)) {
    throw new Error(`¡FUGA! el propietario recibió una fecha de pago (${periodo}-04)`);
  }
}
/* Y el denominador tampoco: sin él la nota no se puede invertir. */
if (new RegExp(`${MESES.length} meses|de ${MESES.length}|onTime|decided`).test(crudo)) {
  throw new Error("¡FUGA! el propietario recibió el número de meses o los conteos");
}
/*
 * Y la mitad positiva, que es lo que hace que el cero de arriba signifique "no está" y no "no sé
 * mirar": con permiso, el mismo sondeo **sí** encuentra la nota.
 */
if (!crudo.includes("a_year_or_more")) {
  throw new Error("el sondeo no sabe ver la nota ni cuando sí está: el cero anterior no probaba nada");
}
ok("ve la nota y nada más: ni montos, ni fechas, ni el número de meses");

// ---------- y se le dice qué es y qué no ----------
if (!conPermiso.includes("No verás los pagos ni las fechas")) {
  throw new Error("no se le dice al propietario qué NO incluye la nota");
}
ok("y se le dice de dónde sale y qué no incluye");

assertQuiet(problemas);
await navegador.close();

// ---------- limpieza ----------
const meses = await db.collection("leases").doc(LEASE_ID).collection("periods").get();
for (const uno of meses.docs) await uno.ref.delete();
await db.collection("leases").doc(LEASE_ID).delete();
await db.collection("applications").doc(APP_ID).delete();
ok("datos de prueba borrados");
