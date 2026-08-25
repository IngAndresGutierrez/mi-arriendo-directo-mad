"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import type { Application } from "../domain/application";
import { visitWhen, type Visit, type VisitHost } from "../domain/visit";
import {
  declineVisitSchema,
  proposeVisitSchema,
  toInstant,
  validateSlot,
  visitVerdictSchema,
} from "../validations/visit";

export type VisitActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Both sides need the process open and on this stage; neither can act on somebody else's. */
type PartyContext =
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly uid: string; readonly application: Application };

async function partyOn(applicationId: string): Promise<PartyContext> {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);
  if (!application) return { ok: false, error: "Este proceso no existe o no es tuyo." };
  if (application.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." };
  if (application.stage !== "visit") {
    return { ok: false, error: "El proceso ya no está en la etapa de la visita." };
  }

  return { ok: true, uid: user.uid, application };
}

/**
 * Who is arranging this visit: the owner, or somebody they asked to help.
 *
 * Two entry points, one body. A collaborator is **not a party**, so `partyOn` above cannot see them
 * at all — `getApplicationFor` answers `null` by design — and the errand's own gate is what
 * authorizes them: a live `show_property` grant on this property, and not being a party to this
 * application. Sharing the write is what keeps the two paths from drifting on the thing that
 * matters, which is that proposing replaces the whole arrangement.
 */
type HostContext =
  | { readonly ok: false; readonly error: string }
  | {
      readonly ok: true;
      readonly uid: string;
      readonly application: Application;
      /** Filled in for a collaborator, `null` when the owner shows it themselves. */
      readonly shownBy: VisitHost | null;
    };

async function hostOn(applicationId: string): Promise<HostContext> {
  const user = await requireCompleteProfile();

  const own = await getApplicationFor(applicationId, user.uid);
  if (own) {
    if (own.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." };
    if (own.stage !== "visit") {
      return { ok: false, error: "El proceso ya no está en la etapa de la visita." };
    }
    if (own.landlordUid !== user.uid) {
      return { ok: false, error: "Solo el propietario propone la visita." };
    }

    return { ok: true, uid: user.uid, application: own, shownBy: null };
  }

  /*
   * **There is no second way in any more.** A collaborator used to reach this through an errand that
   * granted `show_property` on the property, and that whole mechanism is gone: a collaborator is no
   * longer a user of this product, so they are not a party to a process and cannot move one.
   *
   * Showing a flat is still delegated — it is an errand of type `showing` in
   * `features/collaboration` — but the errand is a job with its own accept/decline/done, not a seat
   * at the process. `shownBy` stays in the type because the notification copy for a visit shown by
   * somebody else is worth keeping for the day that comes back, and because there are stored
   * notifications of that type already.
   */
  return { ok: false, error: "Este proceso no existe o no es tuyo." };
}

/**
 * The landlord proposes a day, an hour and where to meet.
 *
 * Proposing again **replaces the whole arrangement, the verdict included**. A confirmation belongs
 * to the day it was given for — the interview's rule — and here so does the conclusion: "no me
 * interesa" was said about a visit that happened, and carrying it onto a second one would show the
 * tenant refusing a flat they have not been back to. It is also the way out of a "no" that both
 * parties want to reconsider: propose again, and the stage starts over.
 */
export async function proposeVisit(
  applicationId: string,
  input: unknown,
): Promise<VisitActionResult> {
  const context = await hostOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application, shownBy } = context;

  const parsed = proposeVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const instant = toInstant(parsed.data.day, parsed.data.time);
  // Against the server's clock, not the browser's: a client can say it is any date it likes.
  const slot = validateSlot(instant, new Date());
  if (!slot.ok) return { ok: false, message: slot.error };

  const visit: Visit = {
    at: instant.toISOString(),
    meetingPoint: parsed.data.meetingPoint,
    note: parsed.data.note,
    proposedAt: new Date().toISOString(),
    confirmedAt: null,
    declinedAt: null,
    declineNote: "",
    verdict: null,
    shownBy,
  };

  await adminDb().collection("applications").doc(applicationId).update({
    visit,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [host, tenant] = await Promise.all([
    getProfile(uid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    /*
     * A different type when somebody other than the owner is coming, because the copy is the point:
     * the tenant is being told a **stranger** will meet them somewhere, and "Carlos propone el
     * jueves" without saying who Carlos is reads like a wrong number.
     */
    type: shownBy ? "visit_proposed_by_collaborator" : "visit_proposed",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: host?.fullName ?? "",
    /*
     * When, and **never where**. The meeting point is the one field in this process that gives away
     * the address, and an email is forwarded, quoted and left open on a laptop — the same rule that
     * keeps the payout account details out of a notification. The bell says there is a visit; the
     * address is read on the page, behind the session.
     */
    detail: visitWhen(visit),
  });

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}

/** The tenant confirms. This is what turns a proposal into an appointment. */
export async function confirmVisit(applicationId: string): Promise<VisitActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.tenantUid !== uid) {
    return { ok: false, message: "Solo el inquilino confirma la visita." };
  }
  if (!application.visit) {
    return { ok: false, message: "Todavía no hay un día propuesto." };
  }
  if (application.visit.confirmedAt) return { ok: true };

  await adminDb().collection("applications").doc(applicationId).update({
    "visit.confirmedAt": new Date().toISOString(),
    "visit.declinedAt": null,
    "visit.declineNote": "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [tenant, landlord] = await Promise.all([
    getProfile(uid),
    getProfile(application.landlordUid),
  ]);

  await notify({
    recipientUid: application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "visit_confirmed",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: visitWhen(application.visit),
  });

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}

/**
 * The tenant cannot make it, and says so.
 *
 * Without this the only honest thing left is not turning up — and here that means a landlord
 * standing outside their own building waiting for somebody who was never coming.
 */
export async function declineVisit(
  applicationId: string,
  input: unknown,
): Promise<VisitActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.tenantUid !== uid) {
    return { ok: false, message: "Solo el inquilino responde a la propuesta." };
  }
  if (!application.visit) {
    return { ok: false, message: "Todavía no hay un día propuesto." };
  }

  const parsed = declineVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }

  await adminDb().collection("applications").doc(applicationId).update({
    "visit.declinedAt": new Date().toISOString(),
    "visit.declineNote": parsed.data.note,
    "visit.confirmedAt": null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [tenant, landlord] = await Promise.all([
    getProfile(uid),
    getProfile(application.landlordUid),
  ]);

  await notify({
    recipientUid: application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "visit_declined",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: parsed.data.note,
  });

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}

/**
 * The tenant says whether the property is for them, which is what unblocks the stage — or stops it.
 *
 * **Only the tenant**, because whether a flat is right is something only the person who walked
 * through it can say. It is the same rule that lets only the landlord confirm that the money
 * arrived and only the tenant close an incident: the product asks the question of whoever holds
 * the answer, instead of letting the other party record an opinion that is not theirs.
 *
 * Only after a confirmed visit: a verdict on a day nobody agreed to is a verdict on a visit that
 * did not happen. It can be given again — somebody who slept on it and changed their mind should
 * not have to ask the landlord to re-propose the whole thing — and **the landlord is told either
 * way**, unlike the interview's conclusion. There the landlord writes the note and then advances,
 * which announces itself; here the news travels the other way, and without it the landlord would
 * be waiting on a page for something that already happened.
 */
export async function recordVisitVerdict(
  applicationId: string,
  input: unknown,
): Promise<VisitActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.tenantUid !== uid) {
    return { ok: false, message: "Solo el inquilino dice si el inmueble le interesa." };
  }
  if (!application.visit?.confirmedAt) {
    return { ok: false, message: "La visita todavía no está confirmada." };
  }

  const parsed = visitVerdictSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa lo que escribiste." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      "visit.verdict": {
        result: parsed.data.result,
        note: parsed.data.note,
        at: new Date().toISOString(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  const [tenant, landlord] = await Promise.all([
    getProfile(uid),
    getProfile(application.landlordUid),
  ]);

  await notify({
    recipientUid: application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    /*
     * Un tipo por respuesta y no uno solo con el resultado dentro, que es la lección de los
     * incidentes: la copia *es* el punto. "Le interesó, ya puedes seguir" es una tarea y "no le
     * interesó" es el final del proceso, y un aviso que no distingue las dos se ignora junto con
     * el resto.
     */
    type: parsed.data.result === "interested" ? "visit_interested" : "visit_not_interested",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: parsed.data.note,
  });

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}
