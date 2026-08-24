/**
 * El arriendo en curso: lo que pasa **después** de la novena etapa.
 *
 * Lo que se maneja aquí, en este orden: que llegar a `active` abre la tenencia, que el primer canon
 * se hereda como el primer mes ya pagado, que los datos de cobro llegan con ella, que el inquilino
 * paga un mes y el propietario responde, y que un rechazo deja de aplicar cuando se sube otro
 * comprobante.
 *
 * La fecha de mudanza se retrocede con el Admin SDK antes de avanzar: el formulario pide una fecha
 * futura, y un arriendo que empieza el mes que viene no tiene ningún mes que pagar todavía. Lo que
 * este driver prueba es el calendario, no el formulario de postulación.
 */
import { chromium } from "playwright";

import {
  adminDb,
  adminFieldValue,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  fixtures,
  leaseTab,
  MONTHS,
  ok,
  settled,
  watch,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1, photo2: PHOTO_2 } = fixtures();

const db = adminDb();
const FieldValue = adminFieldValue();
const problemas = [];
const b = await chromium.launch();

/**
 * Tres meses atrás, día 10: el mes 1 queda pagado por herencia y los meses 2 y 3 vencidos, que es
 * justo la forma en la que se puede manejar "el mes más viejo en mora es el que toca".
 */
const hoy = new Date();
const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 10));
const ISO = (d) => d.toISOString().slice(0, 10);
const MES = (d) => ISO(d).slice(0, 7);
const mes = (n) => MES(new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + n, 10)));

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const titulo = (periodo) => {
  const [year, month] = periodo.split("-");
  const nombre = NOMBRE_MES[Number(month) - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} de ${year}`;
};

async function entrar(email, nombre) {
  await createAccount(API_KEY, email);
  const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
  watch(p, nombre, problemas);
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settled(p);
  await p.waitForFunction(
    () => {
      const f = document.querySelector("form");
      return f && Object.keys(f).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout: 20000 },
  );
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
  for (const [l, o] of [
    ["Género", /Femenino/i],
    ["Departamento", /Caldas/],
    ["Ciudad", /^Manizales$/],
  ]) {
    await p.getByLabel(l).click();
    await p.getByRole("option", { name: o }).first().click();
  }
  await p.getByRole("checkbox").click();
  await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
  await p.waitForURL(/\/inicio/, { timeout: 30000 });
  await settled(p);

  return p;
}


/**
 * En qué estado dejó el producto un mes, esté destacado arriba o plegado en la lista.
 *
 * Se le pregunta al producto en vez de recalcularlo aquí: una aserción que repite la regla —
 * "junio queda en revisión al subir un comprobante" — es una segunda copia de la regla, y el día
 * que cambie, la copia que nadie mire es esta.
 */
async function estadoDelMes(page, periodo) {
  return page.locator(`[data-month="${periodo}"]`).first().getAttribute("data-state");
}

/**
 * Abre la fila de un mes que no está destacado, para leer lo que guarda.
 */
async function abrirMes(page, periodo) {
  const fila = page.locator(`li[data-month="${periodo}"]`);
  if ((await fila.count()) === 0) return false;
  if ((await fila.getByRole("button").first().getAttribute("aria-expanded")) === "false") {
    await fila.getByRole("button").first().click();
  }

  return true;
}

/**
 * Espera el comprobante **o el error del panel**, lo que llegue primero.
 *
 * Sin esto un fallo de la acción se ve como un `waitForFunction` que expira a los cuarenta
 * segundos, y el motivo — que el panel ya tenía escrito en pantalla — se pierde.
 */
async function subeOFalla(page, periodo, estadoEsperado) {
  await page.waitForFunction(
    ([mes, estado]) => {
      const fila = document.querySelector(`[data-month="${mes}"]`);
      const alerta = document.querySelector('main [role="alert"]');

      return fila?.getAttribute("data-state") === estado || Boolean(alerta?.textContent?.trim());
    },
    [periodo, estadoEsperado],
    { timeout: 40000 },
  );
  const alerta = page.locator('main [role="alert"]').first();
  if ((await alerta.count()) > 0) {
    throw new Error(`el panel respondió con un error: ${(await alerta.innerText()).trim()}`);
  }
}

const dueñoEmail = `arrdueno-${STAMP}@miarriendodirecto.test`;
const inqEmail = `arrinq-${STAMP}@miarriendodirecto.test`;
const INQ_NOMBRE = "Carlos Inquilino Ramírez";
const dueño = await entrar(dueñoEmail, "Ana Propietaria Pérez");
const inq = await entrar(inqEmail, INQ_NOMBRE);

// ---------- un proceso, hasta la etapa del primer canon ----------
await dueño.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByLabel("Título del anuncio").fill(`Apartamento con patio en Palermo ${STAMP}`);
await dueño
  .getByLabel("Descripción")
  .fill("Dos habitaciones, cocina integral y zona de ropas independiente, con patio.");
await dueño.getByLabel("Área (m²)").fill("70");
await dueño.getByLabel("Habitaciones").fill("2");
await dueño.getByLabel("Baños").fill("2");
await dueño.getByLabel("Estrato").click();
await dueño.getByRole("option", { name: "Estrato 4" }).click();
await dueño.getByLabel("Parqueadero").click();
await dueño.getByRole("option", { name: "Tiene parqueadero", exact: true }).click();
await dueño.getByLabel("Departamento").click();
await dueño.getByRole("option", { name: "Caldas", exact: true }).click();
await dueño.getByLabel("Ciudad").click();
await dueño.getByRole("option", { name: "Manizales", exact: true }).click();
await dueño.getByLabel("Barrio").fill("Palermo");
await dueño.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20");
await dueño.getByLabel("Número de matrícula inmobiliaria", { exact: true }).fill("050-123456");
await dueño.getByLabel("Canon mensual (COP)").click();
await dueño.keyboard.type("1800000");
await dueño.setInputFiles('input[type="file"]', [PHOTO_1, PHOTO_2]);
await dueño.waitForSelector('img[alt="Foto de portada"]', { timeout: 30000 });
await dueño.getByRole("button", { name: /Publicar inmueble/i }).click();
await dueño.waitForURL(/\/mis-inmuebles$/, { timeout: 40000 });
await settled(dueño);
const href = await dueño
  .locator("li", { hasText: `Apartamento con patio en Palermo ${STAMP}` })
  .getByRole("link")
  .first()
  .getAttribute("href");

await inq.goto(BASE + href, { waitUntil: "domcontentloaded" });
await settled(inq);
await inq.getByRole("link", { name: "Postularme" }).click();
await inq.waitForURL(/\/postularme\//, { timeout: 20000 });
await settled(inq);
await inq.getByLabel("Número de documento").fill("1053812345");
await inq.getByLabel("Dónde trabajas").fill("Crehana");
await inq.getByLabel("Ingresos mensuales (COP)").click();
await inq.keyboard.type("6000000");
await inq.getByLabel("Personas que vivirían ahí").fill("2");
await inq.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await inq.getByLabel("Qué relación tienen").fill("Jefe directo");
await inq.getByLabel("Teléfono de tu referencia").fill("3009876543");
await inq
  .getByLabel("Cuándo te mudarías")
  .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
await inq.getByRole("button", { name: /Enviar postulación/i }).click();
await inq.waitForURL(/\/contratos\/[A-Za-z0-9]+$/, { timeout: 40000 });
await settled(inq);
const proceso = inq.url();
const id = new URL(proceso).pathname.split("/").pop();
ok("proceso creado", id);

/*
 * El proceso, puesto en la última etapa con el primer canon ya confirmado: es el estado desde el
 * que el propietario lo pone en curso, y el que decide si el mes 1 se hereda pagado.
 */
const subido = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 11)).toISOString();
await db
  .collection("applications")
  .doc(id)
  .update({
    stage: "first_payment",
    desiredMoveIn: ISO(inicio),
    firstPayment: {
      payout: {
        method: "breb",
        phone: "",
        key: "@ana2026",
        accountType: "",
        accountNumber: "",
        bankName: "",
        holderName: "Marta Propietaria Gómez",
        // Vacío como lo guarda el producto para una llave Bre-B: ahí nadie pide el documento.
        holderDocument: "",
        note: "",
      },
      receipt: {
        path: `payments/${id}/primer-canon.png`,
        fileName: "primer-canon.png",
        contentType: "image/png",
        bytes: 120000,
        uploadedAt: subido,
        amount: 1800000,
        paidOn: ISO(inicio),
        note: "Primer canon.",
      },
      verdict: {
        status: "confirmed",
        at: new Date(Date.parse(subido) + 3600000).toISOString(),
        reason: "",
      },
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

// ---------- poner el arriendo en curso ----------
await dueño.goto(proceso, { waitUntil: "domcontentloaded" });
await settled(dueño);
const continuar = dueño.getByRole("button", { name: /Continuar a/i }).first();
if ((await continuar.getAttribute("aria-disabled")) === "true") {
  throw new Error("con el primer canon confirmado sigue bloqueado");
}
await continuar.click();
/*
 * Se espera **la consecuencia**, no el rótulo: "Arriendo en curso" es la etiqueta de la novena etapa
 * y está en el DOM desde el primer render, así que esta espera se cumplía sola y el driver seguía
 * antes de que la página se hubiera refrescado. Lo que de verdad cambia al avanzar es el estado de
 * esa tarjeta.
 *
 * Y ese estado es el arreglo: el proceso queda **terminado**, no "en curso". Las nueve etapas son la
 * negociación que acaba en un contrato firmado, y llegar a la última es haberlas terminado; antes se
 * leía "En curso" para siempre, que es lo que no distingue un proceso acabado de uno atascado en su
 * último paso.
 */
const ultima = dueño.locator("#etapa-active");
await dueño.waitForFunction(
  () => /Listo/.test(document.getElementById("etapa-active")?.innerText ?? ""),
  null,
  { timeout: 30000 },
);
const insignia = (await ultima.innerText()).trim();
if (/En curso|Pendiente/.test(insignia)) {
  throw new Error("la última etapa no se lee como terminada: " + insignia.slice(0, 120));
}
ok("el propietario pone el arriendo en curso, y esa etapa queda terminada");

/*
 * Y la insignia de la línea de etapas dice lo mismo que la tarjeta: "Paso 9 de 9" era cierto y se
 * leía como un paso pendiente. Se busca dentro de la sección de las etapas, no en la página entera.
 */
const etapas = dueño.getByRole("region", { name: "Etapas del proceso" });
const cabecera = await etapas.innerText();
if (!/Proceso completado/.test(cabecera)) {
  throw new Error("la línea de etapas no dice que el proceso está completado");
}
if (/Paso 9 de 9/.test(cabecera)) {
  throw new Error("la línea de etapas sigue diciendo 'Paso 9 de 9'");
}
ok("y la línea de etapas dice 'Proceso completado', no 'Paso 9 de 9'");
await etapas
  .screenshot({ path: `${SHOT_DIR}/proceso-completado.png` })
  .catch(() => undefined);
await ultima.screenshot({ path: `${SHOT_DIR}/proceso-etapa-final.png` }).catch(() => undefined);

// Y desde ahí se va al arriendo, que es donde pasa todo lo que sigue.
const alArriendo = ultima.getByRole("link", { name: /Ir al arriendo/i });
if ((await alArriendo.count()) !== 1) {
  throw new Error("la última etapa no ofrece el enlace al arriendo");
}
await alArriendo.click();
await dueño.waitForURL(/\/arriendos\/[A-Za-z0-9]+$/, { timeout: 25000 });
await settled(dueño);
ok("y desde ahí se llega al arriendo", new URL(dueño.url()).pathname);

// ---------- la tenencia existe, y el menú lleva a ella ----------
await inq.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(inq);
const entrada = inq.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", {
  name: /Arriendos/,
});
if ((await entrada.count()) === 0) throw new Error('el menú no ofrece "Arriendos" como enlace');
await entrada.first().click();
await inq.waitForURL(/\/arriendos$/, { timeout: 25000 });
await settled(inq);
ok("el menú lleva a /arriendos");

const lista = await inq.evaluate(() => document.body.innerText);
if (!lista.includes(`Apartamento con patio en Palermo ${STAMP}`)) {
  throw new Error("la tenencia no aparece en la lista");
}
/*
 * El primer canon **es** el primer mes: si no se heredara, el inquilino abriría esta pantalla y le
 * pedirían pagar un mes que acaba de pagar, y la prueba de haberlo pagado estaría en la otra página.
 */
if (!/1 de \d+/.test(lista)) throw new Error(`no cuenta el primer canon como pagado: ${lista.slice(0, 400)}`);
ok("la tenencia aparece con el primer mes ya pagado");

// ---------- la tenencia, por dentro ----------
await inq.getByRole("link", { name: new RegExp(`Apartamento con patio en Palermo ${STAMP}`) }).first().click();
await inq.waitForURL(new RegExp(`/arriendos/${id}$`), { timeout: 25000 });
await settled(inq);

/*
 * La pantalla tiene tres pestañas — Información, Pagos e Incidentes — y abre en **Pagos**, que es la
 * pregunta con la que se entra aquí. Los datos de cobro y los meses están ahí sin tocar nada.
 */
const dentro = await inq.evaluate(() => document.body.innerText);
// Los datos de cobro llegan con la tenencia: preguntarlos otra vez el día uno sería pedir algo que
// el proceso ya tiene.
for (const frase of ["@ana2026", "Marta Propietaria Gómez", "Comprueba el nombre del titular"]) {
  if (!dentro.includes(frase)) throw new Error(`la tenencia no hereda "${frase}"`);
}
ok("la tenencia abre en Pagos y hereda los datos de cobro del primer canon");

/*
 * El resumen del término vive ahora en "Información": el canon etiquetado como el de la postulación
 * y cuántos meses van sin pagar. Antes estaban en la misma página que los meses, así que esto se
 * leía del `innerText` del documento; ahora hay que ir a su pestaña.
 */
const info = await leaseTab(inq, "Información");
const resumen = await info.innerText();

if (!/seg[úu]n la postulaci[óo]n/i.test(resumen)) {
  throw new Error("no dice que el canon es el de la postulación");
}
ok("el canon va etiquetado como el de la postulación, en Información");

// Y hay meses en mora: dos, con su plata.
if (!/sin pagar/i.test(resumen)) throw new Error("no dice que hay meses sin pagar");
ok("dice cuántos meses van sin pagar");

// De vuelta a Pagos, que es donde pasa el resto de este driver.
await leaseTab(inq, "Pagos");

/*
 * El mes que toca es el **más viejo en mora**, no el más reciente: la deuda que hay que limpiar es
 * la que lleva más tiempo ahí. Se asserta por lo que el producto pone arriba, no por una fecha
 * escrita a mano en el driver.
 */
const foco = await inq.locator("#focus-month-heading").innerText();
if (foco.trim() !== titulo(mes(1))) {
  throw new Error(`el mes destacado es "${foco}", esperaba "${titulo(mes(1))}"`);
}
ok("el mes destacado es el más viejo en mora", foco);

/*
 * Un solo acento cyan **en el contenido del arriendo**, que es el alcance de la regla: la acción de
 * esta pantalla es el mes que toca. Se cuenta dentro de `main` y no en la página entera porque el
 * armazón del producto no es de esta pantalla, y un driver que le exija la regla a la barra lateral
 * estaría manejando otra cosa. Se listan los nombres: un fallo que no dice cuáles no se puede
 * arreglar.
 */
const cyan = await inq.evaluate(() =>
  [...document.querySelectorAll("main button, main label, main a")]
    .filter((el) => el.className.split(/\s+/).includes("bg-accent"))
    .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
);
if (cyan.length > 1) {
  throw new Error(`hay ${cyan.length} acentos cyan y la regla es uno: ${JSON.stringify(cyan)}`);
}
ok("un solo acento cyan en el arriendo", cyan[0] ?? "ninguno");

// ---------- el inquilino paga ese mes ----------
await inq.locator(`#amount-${mes(1)}`).fill("1800000");
await inq.locator(`#paid-on-${mes(1)}`).fill(ISO(new Date()));
await inq.locator(`#note-${mes(1)}`).fill("Transferencia desde Nequi.");
await inq.setInputFiles(`#receipt-${mes(1)}`, PHOTO_1);
await subeOFalla(inq, mes(1), "in_review");
ok("el inquilino sube el comprobante del mes");

/*
 * Y el mes destacado pasa a ser **el siguiente en mora**: pagado junio, la atención va a julio. Eso
 * es también lo que hace que la aserción de arriba no pueda ser "el nombre del archivo está en la
 * pantalla" — junio se plega, y su registro sigue ahí dentro.
 */
if ((await inq.locator("#focus-month-heading").innerText()).trim() === titulo(mes(1))) {
  throw new Error("el mes con comprobante subido sigue reclamando la pantalla");
}
if (!(await abrirMes(inq, mes(1)))) throw new Error(`${mes(1)} no quedó en la lista`);
if (!(await inq.evaluate(() => document.body.innerText)).includes("photo-1.png")) {
  throw new Error("el registro del mes no sobrevive a dejar de estar destacado");
}
ok("la atención pasa al siguiente mes en mora y el registro se queda con su mes");

// ---------- el propietario rechaza, con motivo ----------
await dueño.goto(BASE + `/arriendos/${id}`, { waitUntil: "domcontentloaded" });
await settled(dueño);
/*
 * Al propietario le toca **ese** mes, porque un comprobante esperando respuesta es lo que vino a
 * hacer: la misma lista leída desde el otro lado.
 */
const focoDueño = await dueño.locator("#focus-month-heading").innerText();
if (focoDueño.trim() !== titulo(mes(1))) {
  throw new Error(`al propietario le destacan "${focoDueño}", esperaba "${titulo(mes(1))}"`);
}
ok("al propietario le toca el mes con comprobante por responder", focoDueño);

await dueño.getByRole("button", { name: /No llegó/i }).first().click();
await dueño.locator(`#reason-${mes(1)}`).fill("Llegaron $200.000 de menos.");
await dueño.getByRole("button", { name: /Rechazar el comprobante/i }).click();
await dueño.waitForFunction(
  (mes) => document.querySelector(`[data-month="${mes}"]`)?.getAttribute("data-state") === "rejected",
  mes(1),
  { timeout: 25000 },
);
ok("el propietario rechaza el comprobante con motivo");

// ---------- el inquilino sube otro y el rechazo deja de aplicar ----------
await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
if (!(await inq.evaluate(() => document.body.innerText)).includes("Llegaron $200.000 de menos")) {
  throw new Error("el inquilino no ve el motivo del rechazo");
}
ok("el inquilino lee el motivo del rechazo");

await inq.locator(`#paid-on-${mes(1)}`).fill(ISO(new Date()));
await inq.setInputFiles(`#receipt-${mes(1)}`, PHOTO_2);
await subeOFalla(inq, mes(1), "in_review");
/*
 * La regla que importa: un veredicto pertenece al comprobante que juzgó. Un rechazo más antiguo que
 * el comprobante nuevo deja de contar solo — si no, quedaría "rechazado" en pantalla y nada que
 * arreglar. `subeOFalla` ya esperó `in_review`, así que basta comprobar que no volvió a `rejected`.
 */
const tras = await estadoDelMes(inq, mes(1));
if (tras !== "in_review") {
  throw new Error(`el rechazo viejo sigue aplicando: el mes quedó en "${tras}"`);
}
ok("el rechazo viejo deja de aplicar al subir otro comprobante", tras);

// ---------- el propietario confirma ----------
await dueño.reload({ waitUntil: "domcontentloaded" });
await settled(dueño);
await dueño.getByRole("button", { name: /Confirmar que llegó/i }).first().click();
await dueño.waitForFunction(
  (mes) => document.querySelector(`[data-month="${mes}"]`)?.getAttribute("data-state") === "paid",
  mes(1),
  { timeout: 25000 },
);
ok("el propietario confirma que el canon llegó");

await inq.reload({ waitUntil: "domcontentloaded" });
await settled(inq);
// El contador del término está en "Información", no en la pestaña de los meses.
const final = await (await leaseTab(inq, "Información")).innerText();
if (!/2 de \d+/.test(final)) throw new Error(`no cuenta dos meses pagados: ${final.slice(0, 400)}`);
ok("el resumen cuenta dos meses pagados");

await inq.screenshot({ path: `${SHOT_DIR}/arriendo.png`, fullPage: true });

// ---------- 390px ----------
await inq.setViewportSize({ width: 390, height: 900 });
await settled(inq);
await assertNoHorizontalScroll(inq, "el arriendo a 390px");
ok("390px sin scroll horizontal");

assertQuiet(problemas);
ok("consola sin errores");
await b.close();
