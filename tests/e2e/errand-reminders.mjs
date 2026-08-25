/**
 * El recordatorio del encargo: una hora antes, y **una sola vez**.
 *
 * Se prueba contra el barrido real —la misma ruta que llama Vercel Cron— y sobre documentos
 * sembrados con el Admin SDK, porque lo que hay que provocar es el paso del tiempo: un encargo a
 * cuarenta minutos, otro a tres horas, otro sin confirmar. Conducir eso por la interfaz significaría
 * esperar de verdad.
 *
 * Las dos afirmaciones que no puede hacer una unitaria:
 *
 * - que el barrido **encuentre** el encargo, que depende de la consulta y su ventana, no de la regla;
 * - que **no lo mande dos veces**, que depende de que la marca se escriba antes que el mensaje y de
 *   que el segundo barrido la lea. El cron despierta cada cinco minutos: sin eso, doce mensajes por
 *   hora a la misma persona.
 */
import { readFileSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";

import { adminDb, BASE, config, ok } from "./lib.mjs";

const { stamp: STAMP } = config();
const RAIZ = joinPath(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SECRETO = (process.env.CRON_SECRET ?? "").trim() || leerCronSecret();
if (!SECRETO) throw new Error("falta CRON_SECRET en el entorno o en .env.local");

function leerCronSecret() {
  try {
    return (
      readFileSync(joinPath(RAIZ, ".env.local"), "utf8")
        .split("\n")
        .find((l) => l.startsWith("CRON_SECRET="))
        ?.slice("CRON_SECRET=".length)
        .replace(/^"|"$/g, "") ?? ""
    );
  } catch {
    return "";
  }
}

const db = adminDb();
const barrer = () =>
  fetch(`${BASE}/api/cron/errand-reminders`, { headers: { Authorization: `Bearer ${SECRETO}` } }).then(
    (r) => r.json(),
  );

/** Un encargo sembrado directamente: lo que importa es su hora, no cómo se creó. */
async function encargo({ minutosAntes, aceptado = true }) {
  const ref = await db.collection("errands").add({
    landlordUid: `rec-owner-${STAMP}`,
    collaboratorUid: `rec-colab-${STAMP}`,
    collaboratorName: "Carlos Colaborador",
    collaboratorPhone: "+573001234567",
    propertyId: `rec-prop-${STAMP}`,
    propertyTitle: "Apartamento en Palermo",
    propertyArea: "Palermo, Manizales",
    type: "showing",
    title: `Mostrar el apartamento ${STAMP}`,
    description: "El portero tiene la llave.",
    dueAt: new Date(Date.now() + minutosAntes * 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(aceptado ? { acceptedAt: new Date() } : {}),
  });

  return ref;
}

const recordado = async (ref) => Boolean((await ref.get()).data()?.remindedAt);

try {
  // ---------- el secreto es obligatorio ----------
  /*
   * Es un endpoint que le manda un SMS a cada colaborador con un encargo próximo. Si respondiera a
   * quien adivine la ruta, sería un emisor de mensajes gratis a costa de la cuenta de Twilio.
   */
  const sinSecreto = await fetch(`${BASE}/api/cron/errand-reminders`);
  if (sinSecreto.status !== 401) throw new Error(`sin bearer devolvió ${sinSecreto.status}, no 401`);
  const malSecreto = await fetch(`${BASE}/api/cron/errand-reminders`, {
    headers: { Authorization: "Bearer no-es-el-secreto" },
  });
  if (malSecreto.status !== 401) throw new Error(`con un bearer falso devolvió ${malSecreto.status}`);
  ok("el barrido exige el secreto del cron");

  // ---------- dentro de la hora: se manda ----------
  const enCuarenta = await encargo({ minutosAntes: 40 });
  let r = await barrer();
  if (r.sent < 1) throw new Error(`no mandó el de 40 minutos: ${JSON.stringify(r)}`);
  if (!(await recordado(enCuarenta))) throw new Error("no quedó marcado como recordado");
  ok("un encargo dentro de la hora recibe su recordatorio", JSON.stringify(r));

  // ---------- y no se repite ----------
  /*
   * La afirmación por la que existe la marca. El cron despierta cada cinco minutos; sin ella, esta
   * segunda llamada volvería a mandarlo, y la siguiente también.
   */
  r = await barrer();
  if (r.sent !== 0) throw new Error(`repitió el recordatorio: ${JSON.stringify(r)}`);
  ok("el segundo barrido no lo repite");

  // ---------- demasiado pronto ----------
  const enTresHoras = await encargo({ minutosAntes: 180 });
  r = await barrer();
  if (await recordado(enTresHoras)) throw new Error("recordó un encargo a tres horas");
  ok("un encargo a tres horas todavía no se recuerda");

  // ---------- sin confirmar, nunca ----------
  /*
   * La misma regla que la entrevista: una propuesta que nadie aceptó no es una cita, y recordarle a
   * alguien un trabajo que no tomó es ruido sobre nada.
   */
  const sinAceptar = await encargo({ minutosAntes: 30, aceptado: false });
  r = await barrer();
  if (await recordado(sinAceptar)) throw new Error("recordó un encargo que nadie confirmó");
  ok("un encargo sin confirmar no se recuerda");

  // ---------- ya pasó la hora ----------
  const yaPasó = await encargo({ minutosAntes: -20 });
  r = await barrer();
  if (await recordado(yaPasó)) throw new Error("recordó un encargo cuya hora ya pasó");
  ok("pasada la hora ya no se recuerda");

  console.log("\nerrand-reminders: OK");
} finally {
  // Los documentos sembrados se borran: son datos de prueba en una colección compartida.
  const restos = await db.collection("errands").where("landlordUid", "==", `rec-owner-${STAMP}`).get();
  await Promise.all(restos.docs.map((d) => d.ref.delete()));
}
