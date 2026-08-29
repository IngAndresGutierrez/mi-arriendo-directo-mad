/**
 * La verificación de titularidad: la insignia de propietario verificado.
 *
 * Es **la única afirmación de la página pública que un desconocido tiene que creerse sin poder
 * comprobarla**, y su interesado es exactamente la persona con motivos para falsificarla. De ahí
 * que lo que se afirma aquí sea sobre todo lo que no se puede hacer:
 *
 * - que el propietario **no** pueda escribirse la insignia desde el cliente — eso lo fija
 *   `tests/rules/`, y aquí se comprueba la otra mitad: que la ruta de administración lo rebota;
 * - que cambiar la matrícula **tumbe la insignia sola**, que es la regla del diseño;
 * - que un rechazo no salga jamás en el anuncio, y que su motivo sí llegue al propietario;
 * - y que el certificado —que lleva la dirección completa— no aparezca en ninguna parte pública.
 */
import { chromium } from "playwright";

import {
  adminAuth,
  adminDb,
  adminFieldValue,
  assertQuiet,
  BASE,
  config,
  createAccount,
  ok,
  PASSWORD,
  signInWithPassword,
  openSession,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const db = adminDb();
const auth = adminAuth();
const FieldValue = adminFieldValue();

const MATRICULA = "050-123456";
const CALLE = `Carrera 23 # 62-${STAMP.slice(-2)}`;
const TITULO = `Apartamento verificado ${STAMP}`;
const SLUG = `apartamento-verificado-${STAMP}-manizales`;

const dueñoEmail = `ver-owner-${STAMP}@miarriendodirecto.test`;
const adminEmail = `ver-admin-${STAMP}@miarriendodirecto.test`;
const dueñoCuenta = await createAccount(API_KEY, dueñoEmail);
const adminCuenta = await createAccount(API_KEY, adminEmail);

const propiedad = await db.collection("properties").add({
  title: TITULO,
  slug: SLUG,
  description: "Apartamento remodelado con vista a la montaña y cocina integral.",
  type: "apartment",
  rent: 1_800_000,
  adminFee: 0,
  areaM2: 70,
  bedrooms: 2,
  bathrooms: 2,
  parking: "private",
  stratum: 4,
  furnished: false,
  petsAllowed: true,
  minLeaseMonths: 12,
  availableFrom: "2026-12-01",
  status: "available",
  /*
   * Con foto: `PHOTOS_MIN` es 1 y el formulario lo exige, así que un anuncio sembrado sin ninguna no
   * se puede volver a guardar — y este driver necesita guardarlo para cambiar la matrícula.
   */
  photos: [{ path: `properties/${dueñoCuenta.localId}/a.png`, url: `${BASE}/icon.png` }],
  area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
  landlordUid: dueñoCuenta.localId,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
await db.collection("propertySlugs").doc(SLUG).set({ propertyId: propiedad.id });
await db
  .collection("properties")
  .doc(propiedad.id)
  .collection("private")
  .doc("location")
  .set({ line: CALLE, registryNumber: MATRICULA });
ok("inmueble publicado con su matrícula privada", propiedad.id);

const navegador = await chromium.launch();
const problemas = [];
const dueño = await openSession(navegador, {
  email: dueñoEmail,
  name: "Ana Propietaria Pérez",
  problems: problemas,
});

const publica = () => db.collection("properties").doc(propiedad.id).get().then((d) => d.data());
const expediente = () =>
  db
    .collection("properties")
    .doc(propiedad.id)
    .collection("private")
    .doc("verification")
    .get()
    .then((d) => d.data() ?? null);

const EDITAR = `${BASE}/mis-inmuebles/${propiedad.id}/editar`;
const ANUNCIO = `${BASE}/inmuebles/${SLUG}`;

// ---------- sin verificar no hay insignia en ninguna parte ----------
const anonimo = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const visitante = await anonimo.newPage();
await visitante.goto(ANUNCIO, { waitUntil: "domcontentloaded" });
await settled(visitante);
if ((await visitante.textContent("body")).includes("Propietario verificado")) {
  throw new Error("un anuncio sin verificar ya muestra la insignia");
}
ok("un anuncio sin verificar no muestra insignia");

// ---------- el propietario la solicita ----------
await dueño.goto(EDITAR, { waitUntil: "domcontentloaded" });
await settled(dueño);
const panel = dueño.getByRole("region", { name: /Propietario verificado/i });
await panel.waitFor({ timeout: 20000 });

/*
 * El certificado se sube desde el navegador con el SDK web, como todo lo demás: el cuerpo de una
 * Server Action está topado en 1 MB. El fichero se fabrica aquí mismo — un PDF mínimo válido basta,
 * porque lo que la acción comprueba contra el bucket es el tipo y el tamaño.
 */
await dueño.setInputFiles('input[data-slot="verification-documents"]', {
  name: "certificado-tradicion.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"),
});
await dueño.getByRole("button", { name: /Solicitar la verificación/ }).click();
await dueño.waitForSelector("text=Recibimos tu solicitud", { timeout: 40000 });

const solicitada = await expediente();
if (!solicitada?.submittedAt) throw new Error("no quedó registrada la solicitud");
if (solicitada.registryNumber !== MATRICULA) {
  throw new Error(`el expediente guardó la matrícula ${solicitada.registryNumber}`);
}
if (!solicitada.documents?.[0]?.path?.startsWith(`verifications/${dueñoCuenta.localId}/`)) {
  throw new Error("el certificado quedó fuera de la carpeta del propietario");
}
/*
 * **Y la matrícula la lee el servidor de `private/location`, no de la solicitud.** Es el número al
 * que se va a atar la aprobación: un cliente que pudiera mandarlo elegiría de qué habla su insignia.
 */
if ((await publica()).ownershipVerifiedAt) {
  throw new Error("solicitar la verificación ya puso la insignia");
}
ok("el propietario la solicita, y solicitar no verifica nada");

// ---------- un propietario no entra a la cola de revisión ----------
await dueño.goto(`${BASE}/verificaciones`, { waitUntil: "domcontentloaded" });
await settled(dueño);
if (dueño.url().includes("/verificaciones")) {
  throw new Error("un propietario entró a la pantalla de revisión");
}
ok("un propietario no entra a la cola de revisión", dueño.url().replace(BASE, ""));

// ---------- el revisor aprueba ----------
/*
 * **El claim se pone DESPUÉS del onboarding, no antes.** `openSession` completa el perfil, y
 * completar el perfil es lo que escribe el rol como custom claim — así que un `admin` puesto antes
 * lo pisa el propio registro. Costó cuatro aserciones y una cola vacía que parecía un fallo de la
 * consulta.
 *
 * Y después hay que **volver a emitir la cookie**: el rol viaja dentro de ella y se firmó con el
 * anterior, que es exactamente la trampa que este producto ya documentó — "after `setCustomUserClaims`,
 * re-mint the session cookie".
 */
const revisor = await openSession(navegador, {
  email: adminEmail,
  name: "Rita Revisora Díaz",
  problems: problemas,
});
await auth.setCustomUserClaims(adminCuenta.localId, { role: "admin" });
/*
 * Un idToken **recién emitido**, porque es donde viaja el claim: el que la sesión ya tenía se firmó
 * antes de que existiera el rol. `PATCH /api/session` lo cambia por una cookie nueva con los claims
 * de ahora, que es la única forma de que el servidor deje de leer el rol viejo.
 */
const fresco = await signInWithPassword(API_KEY, adminEmail, PASSWORD);
const reemitida = await revisor.request.patch(`${BASE}/api/session`, {
  data: { idToken: fresco.idToken },
});
if (!reemitida.ok()) throw new Error(`no se pudo reemitir la cookie: ${reemitida.status()}`);
await revisor.goto(`${BASE}/verificaciones`, { waitUntil: "domcontentloaded" });
await settled(revisor);

const fila = revisor.locator('[data-slot="verification-row"]', { hasText: TITULO });
await fila.waitFor({ timeout: 20000 });
if (!(await fila.innerText()).includes(MATRICULA)) {
  throw new Error("la fila no muestra la matrícula contra la que se revisa");
}
await revisor.screenshot({ path: `${SHOT_DIR}/verificaciones.png`, fullPage: true });

await fila.getByRole("button", { name: /Figura como propietario/ }).click();
/*
 * **Se espera a que desaparezca ESTA fila, no a que la cola quede vacía.**
 *
 * La cola es compartida: cualquier corrida anterior que muriera antes de su limpieza deja su propia
 * solicitud esperando, así que "no hay solicitudes" es una afirmación sobre el emulador y no sobre
 * lo que este driver acaba de hacer. Es la misma lección que `facets` ya pagó contando tarjetas de
 * un catálogo en el que escriben otros.
 */
await fila.waitFor({ state: "detached", timeout: 30000 });

const aprobada = await publica();
if (!aprobada.ownershipVerifiedAt) throw new Error("aprobar no puso la insignia en el documento público");
ok("el revisor aprueba y la insignia queda en el documento público");

// ---------- y aparece en el anuncio, con lo que NO significa ----------
await visitante.goto(ANUNCIO, { waitUntil: "domcontentloaded" });
await settled(visitante);
const texto = await visitante.textContent("body");
if (!texto.includes("Propietario verificado")) throw new Error("la insignia no aparece en el anuncio");
if (!texto.includes("figura en él como propietario")) {
  throw new Error("la insignia no dice qué se revisó");
}
/* La frase que la acota va **a la vista**, no detrás de un hover: es lo que impide que la insignia
   signifique lo que cada quien quiera. */
if (!texto.includes("No revisamos el estado del inmueble")) {
  throw new Error("la insignia no dice lo que NO significa");
}
/* Y el certificado lleva la dirección completa: no puede asomar por ninguna parte pública. */
const html = await visitante.content();
if (html.includes(CALLE)) throw new Error("¡FUGA! la dirección salió en el anuncio");
if (html.includes(MATRICULA)) throw new Error("¡FUGA! la matrícula salió en el anuncio");
await visitante.screenshot({ path: `${SHOT_DIR}/anuncio-verificado.png`, fullPage: true });
ok("el anuncio muestra la insignia con su alcance, y sin dirección ni matrícula");

// ---------- LA REGLA: cambiar la matrícula la tumba sola ----------
await dueño.goto(EDITAR, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("060-999999");
await dueño.getByRole("button", { name: "Guardar cambios" }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);

const tumbada = await publica();
if (tumbada.ownershipVerifiedAt) {
  throw new Error("cambiar la matrícula dejó la insignia puesta: hablaba de otro inmueble");
}
/* El expediente se queda: es el registro de que sí se verificó, sobre el número anterior. */
const historia = await expediente();
if (!historia.verifiedAt) throw new Error("borró el expediente en vez de dejarlo caducar");
ok("cambiar la matrícula tumba la insignia sola, y el expediente se queda");

await visitante.goto(ANUNCIO, { waitUntil: "domcontentloaded" });
await settled(visitante);
if ((await visitante.textContent("body")).includes("Propietario verificado")) {
  throw new Error("el anuncio sigue mostrando una insignia que ya no aplica");
}
ok("y el anuncio deja de mostrarla");

// ---------- un rechazo nunca sale en el anuncio ----------
await dueño.goto(EDITAR, { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.setInputFiles('input[data-slot="verification-documents"]', {
  name: "certificado-viejo.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"),
});
await dueño.getByRole("button", { name: /Solicitar la verificación/ }).click();
await dueño.waitForSelector("text=Recibimos tu solicitud", { timeout: 40000 });

await revisor.goto(`${BASE}/verificaciones`, { waitUntil: "domcontentloaded" });
await settled(revisor);
const segunda = revisor.locator('[data-slot="verification-row"]', { hasText: TITULO });
await segunda.waitFor({ timeout: 20000 });

/* Rechazar sin motivo no pasa: el propietario no podría hacer nada con "no se pudo". */
await segunda.getByRole("button", { name: /No se pudo verificar/ }).click();
await segunda.getByRole("alert").waitFor({ timeout: 15000 });
ok("no deja rechazar sin decir por qué");

await segunda.getByLabel("Motivo, si no se puede verificar").fill(
  "El certificado tiene cuatro meses de expedido.",
);
await segunda.getByRole("button", { name: /No se pudo verificar/ }).click();
await segunda.waitFor({ state: "detached", timeout: 30000 });

if ((await publica()).ownershipVerifiedAt) throw new Error("un rechazo puso la insignia");
await visitante.goto(ANUNCIO, { waitUntil: "domcontentloaded" });
await settled(visitante);
const trasRechazo = await visitante.textContent("body");
if (/rechaz|no se pudo verificar/i.test(trasRechazo)) {
  throw new Error("¡el rechazo salió en el anuncio público!");
}
ok("un rechazo no aparece en el anuncio: no es una marca sobre una persona");

// ---------- pero su motivo sí llega al propietario ----------
await dueño.goto(EDITAR, { waitUntil: "domcontentloaded" });
await settled(dueño);
const panelTrasRechazo = await dueño.getByRole("region", { name: /Propietario verificado/i }).innerText();
if (!panelTrasRechazo.includes("cuatro meses")) {
  throw new Error("el motivo del rechazo no le llega al propietario: " + panelTrasRechazo);
}
ok("y el motivo sí le llega a quien tiene que corregirlo");

assertQuiet(problemas);
await navegador.close();

// ---------- limpieza ----------
await db.collection("properties").doc(propiedad.id).collection("private").doc("location").delete();
await db.collection("properties").doc(propiedad.id).collection("private").doc("verification").delete();
await db.collection("properties").doc(propiedad.id).delete();
await db.collection("propertySlugs").doc(SLUG).delete();
ok("datos de prueba borrados");
