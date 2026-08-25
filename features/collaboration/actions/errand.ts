"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { notify, sendSms, sendWhatsAppTwilio } from "@/features/notification";
import type { NotificationType } from "@/features/notification";
import { requireUser } from "@/shared/auth/session";
import { getProfile } from "@/features/profile";
import { COLLABORATOR_ROUTE, ERRANDS_ROUTE, collaboratorErrandRoute } from "@/shared/auth/routes";
import { formatBogotaWeekdayTime } from "@/shared/format/date";
import { adminDb } from "@/shared/firebase/admin";
import { resolveSiteUrl } from "@/shared/lib/site-url";

import { availableActions, errandMessage, errandState } from "../domain/errand";
import type { Errand } from "../domain/errand";
import { getErrandFor } from "../data/errand";
import {
  acceptErrandSchema,
  cancelErrandSchema,
  completeErrandSchema,
  declineErrandSchema,
} from "../validations/errand";

/** Every action answers the same shape, so a form never has to guess which field to read. */
export type ErrandActionResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const COLLECTION = "errands";

const REFUSED: ErrandActionResult = {
  ok: false,
  error: "Ese encargo ya no admite esa acción. Recarga la página para ver cómo está.",
};

/**
 * Announces an errand on both channels.
 *
 * **Both, not one with the other as a fallback**, and that is what was asked for: a collaborator who
 * has WhatsApp muted still gets the SMS, and one whose SMS is eaten by a carrier filter still gets
 * the WhatsApp. Neither sender throws — they answer `false` — so a channel that is not configured
 * costs the message on that channel and nothing else.
 *
 * `Promise.all` because the two are independent: sending them in sequence would make the landlord's
 * click wait for two round trips to Twilio for no reason.
 */
async function announce(errand: Errand): Promise<void> {
  const requestHeaders = await headers();
  const origin = resolveSiteUrl({
    host: requestHeaders.get("host"),
    proto: requestHeaders.get("x-forwarded-proto"),
    configured: process.env.NEXT_PUBLIC_SITE_URL,
  });

  const body = errandMessage(
    errand,
    formatBogotaWeekdayTime(errand.dueAt),
    `${origin}${collaboratorErrandRoute(errand.id)}`,
  );

  await Promise.all([
    sendSms({ to: errand.collaboratorPhone, body }),
    sendWhatsAppTwilio({
      to: errand.collaboratorPhone,
      body,
      // The order matches the template's {{1}}, {{2}}, {{3}}. A list, so a call site cannot reorder
      // them silently the way an object's keys can be rearranged without anybody noticing.
      variables: [errand.title, errand.propertyArea, formatBogotaWeekdayTime(errand.dueAt)],
      template: process.env.TWILIO_WHATSAPP_ERRAND_TEMPLATE_SID,
    }),
  ]);
}

/**
 * The collaborator takes the job.
 *
 * Authenticate → validate → authorize against the real document → check the invariant → write. The
 * invariant here is `availableActions`, the **same function the screen uses to decide which buttons
 * to draw**: that is what stops the two from drifting, and it is why a client that posts `accept` on
 * an errand it has already accepted is refused rather than quietly writing a second timestamp.
 */
export async function acceptErrand(input: unknown): Promise<ErrandActionResult> {
  return transition(
    input,
    acceptErrandSchema,
    "accept",
    (parsed) => ({ acceptedAt: new Date(), updatedAt: new Date(), _id: parsed.errandId }),
    (errand) => ({ type: "errand_accepted", detail: errand.title }),
  );
}

/** The collaborator cannot make it. The reason is required — see the schema's note. */
export async function declineErrand(input: unknown): Promise<ErrandActionResult> {
  return transition(
    input,
    declineErrandSchema,
    "decline",
    (parsed) => ({
      declinedAt: new Date(),
      declineReason: parsed.reason,
      updatedAt: new Date(),
      _id: parsed.errandId,
    }),
    /*
     * El motivo va dentro del aviso, no solo en la pantalla: es lo único con lo que el propietario
     * decide qué hacer ahora, y obligarle a abrir la app para leerlo convierte el aviso en un recado.
     */
    (_errand, parsed) => ({ type: "errand_declined", detail: parsed.reason }),
  );
}

/** The collaborator is done. The note is optional; evidence is whatever they uploaded. */
export async function completeErrand(input: unknown): Promise<ErrandActionResult> {
  return transition(
    input,
    completeErrandSchema,
    "complete",
    (parsed) => ({
      completedAt: new Date(),
      completionNote: parsed.note,
      updatedAt: new Date(),
      _id: parsed.errandId,
    }),
    (errand, parsed) => ({ type: "errand_completed", detail: parsed.note || errand.title }),
  );
}

/**
 * One shape for the three collaborator transitions.
 *
 * They differ only in which timestamp they write, and writing the guard three times is writing three
 * chances to forget the ownership check — which is the one that matters here, because a collaborator
 * who could act on somebody else's errand would be reading a property's address and schedule.
 */
async function transition<Parsed extends { errandId: string }>(
  input: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: Parsed } | { success: false } },
  action: "accept" | "decline" | "complete",
  patch: (parsed: Parsed) => Record<string, unknown> & { _id: string },
  /** What the landlord is told. `detail` is what makes it say *which* errand. */
  announcement: (errand: Errand, parsed: Parsed) => { type: NotificationType; detail: string },
): Promise<ErrandActionResult> {
  const user = await requireUser();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa lo que escribiste." };

  const errand = await getErrandFor(parsed.data.errandId, user.uid);
  // `null` is both "does not exist" and "not yours", deliberately — see `getErrandFor`.
  if (!errand) return REFUSED;

  // The collaborator acts; the landlord watches. A landlord pressing "terminado" would be marking
  // somebody else's work done, which is the one thing this record exists to keep honest.
  if (errand.collaboratorUid !== user.uid) return REFUSED;
  if (!availableActions(errand).includes(action)) return REFUSED;

  const { _id, ...fields } = patch(parsed.data);
  await adminDb().collection(COLLECTION).doc(_id).update(fields);

  /*
   * **El propietario se entera, y esto faltaba.** Las tres transiciones escribían la marca de
   * tiempo y no avisaban a nadie: quien repartió el encargo no sabía que lo habían confirmado ni
   * —peor— que lo habían rechazado, que es justo la que hay que saber a tiempo para buscar a otro.
   *
   * `notify()` nunca lanza y corre después de que lo que importa ya está escrito, así que un fallo
   * al avisar deja a alguien sin enterarse pero no deshace la aceptación. El correo sale del mismo
   * sitio, con la misma copia: se deriva del tipo, no se escribe dos veces.
   */
  const { type, detail } = announcement(errand, parsed.data);
  const landlord = await getProfile(errand.landlordUid);

  await notify({
    recipientUid: errand.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type,
    // Un encargo no cuelga de ningún proceso: viaja por `collaboration`, como los cuatro tipos que
    // ya existían sin `applicationId` detrás.
    applicationId: "",
    stage: "submitted",
    propertyTitle: errand.propertyTitle,
    actorName: errand.collaboratorName,
    detail,
    collaboration: _id,
  });

  revalidatePath(COLLABORATOR_ROUTE);
  revalidatePath(collaboratorErrandRoute(_id));
  revalidatePath(ERRANDS_ROUTE);

  return { ok: true };
}

/**
 * The landlord calls it off.
 *
 * Allowed at any point that is not already closed — plans change, and a cancellation the
 * collaborator can see is far better than one they find out about by turning up. It notifies for
 * exactly that reason: this is the one transition whose whole value is arriving before the person
 * gets in a taxi.
 */
export async function cancelErrand(input: unknown): Promise<ErrandActionResult> {
  const user = await requireUser();

  const parsed = cancelErrandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa lo que escribiste." };

  const errand = await getErrandFor(parsed.data.errandId, user.uid);
  if (!errand) return REFUSED;
  if (errand.landlordUid !== user.uid) return REFUSED;

  const state = errandState(errand);
  if (state === "done" || state === "cancelled" || state === "declined") return REFUSED;

  await adminDb().collection(COLLECTION).doc(parsed.data.errandId).update({
    cancelledAt: new Date(),
    cancelReason: parsed.data.reason,
    updatedAt: new Date(),
  });

  /*
   * Told on both channels, like the assignment itself. It is the same `announce` shape rather than a
   * second sender because the two messages differ only in their words, and a cancellation that went
   * out on one channel while the assignment went out on two is how somebody turns up anyway.
   */
  const requestHeaders = await headers();
  const origin = resolveSiteUrl({
    host: requestHeaders.get("host"),
    proto: requestHeaders.get("x-forwarded-proto"),
    configured: process.env.NEXT_PUBLIC_SITE_URL,
  });
  const body = `Se canceló un encargo en miarriendoDIRECTO: ${errand.title} · ${errand.propertyArea}. No hace falta que vayas. ${origin}${COLLABORATOR_ROUTE}`;

  await Promise.all([
    sendSms({ to: errand.collaboratorPhone, body }),
    sendWhatsAppTwilio({ to: errand.collaboratorPhone, body }),
  ]);

  revalidatePath(COLLABORATOR_ROUTE);
  revalidatePath(collaboratorErrandRoute(parsed.data.errandId));

  return { ok: true };
}

export { announce as announceErrand };
