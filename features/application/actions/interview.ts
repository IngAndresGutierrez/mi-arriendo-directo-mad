"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import type { Application } from "../domain/application";
import { interviewWhen, type Interview } from "../domain/interview";
import {
  declineInterviewSchema,
  interviewFeedbackSchema,
  proposeInterviewSchema,
  toInstant,
  validateInterviewSlot,
} from "../validations/interview";

export type InterviewActionResult =
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
  if (application.stage !== "interview") {
    return { ok: false, error: "El proceso ya no está en la etapa de la entrevista." };
  }
  return { ok: true, uid: user.uid, application };
}

/**
 * The landlord proposes a time.
 *
 * Proposing again **replaces** the whole arrangement: a confirmation belongs to the time it was
 * given for, and carrying it over to a new one would show an appointment nobody agreed to.
 */
export async function proposeInterview(
  applicationId: string,
  input: unknown,
): Promise<InterviewActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.landlordUid !== uid) {
    return { ok: false, message: "Solo el propietario propone la entrevista." };
  }

  const parsed = proposeInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const instant = toInstant(parsed.data.day, parsed.data.time);
  // Against the server's clock, not the browser's: a client can say it is any date it likes.
  const slot = validateInterviewSlot(instant, new Date());
  if (!slot.ok) return { ok: false, message: slot.error };

  const interview: Interview = {
    at: instant.toISOString(),
    channel: parsed.data.channel,
    link: parsed.data.link,
    note: parsed.data.note,
    proposedAt: new Date().toISOString(),
    confirmedAt: null,
    declinedAt: null,
    declineNote: "",
    feedback: null,
  };

  await adminDb().collection("applications").doc(applicationId).update({
    interview,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [landlord, tenant] = await Promise.all([
    getProfile(uid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: "interview_proposed",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: interviewWhen(interview),
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/** The tenant confirms. This is what turns a proposal into an appointment. */
export async function confirmInterview(applicationId: string): Promise<InterviewActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.tenantUid !== uid) {
    return { ok: false, message: "Solo el inquilino confirma la entrevista." };
  }
  if (!application.interview) {
    return { ok: false, message: "Todavía no hay una hora propuesta." };
  }
  if (application.interview.confirmedAt) return { ok: true };

  await adminDb().collection("applications").doc(applicationId).update({
    "interview.confirmedAt": new Date().toISOString(),
    "interview.declinedAt": null,
    "interview.declineNote": "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [tenant, landlord] = await Promise.all([
    getProfile(uid),
    getProfile(application.landlordUid),
  ]);

  await notify({
    recipientUid: application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "interview_confirmed",
    applicationId,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: interviewWhen(application.interview),
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The tenant cannot make it, and says so.
 *
 * Without this the only honest thing left is not turning up: the landlord picked a time out of
 * the air, and the person on the other side has a job, a commute and their own week.
 */
export async function declineInterview(
  applicationId: string,
  input: unknown,
): Promise<InterviewActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.tenantUid !== uid) {
    return { ok: false, message: "Solo el inquilino responde a la propuesta." };
  }
  if (!application.interview) {
    return { ok: false, message: "Todavía no hay una hora propuesta." };
  }

  const parsed = declineInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }

  await adminDb().collection("applications").doc(applicationId).update({
    "interview.declinedAt": new Date().toISOString(),
    "interview.declineNote": parsed.data.note,
    "interview.confirmedAt": null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const [tenant, landlord] = await Promise.all([
    getProfile(uid),
    getProfile(application.landlordUid),
  ]);

  await notify({
    recipientUid: application.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "interview_declined",
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
 * The landlord writes down how it went, which is what unblocks the next stage.
 *
 * Only after a confirmed interview: a conclusion about a conversation that was never agreed to
 * is a conclusion about a conversation that did not happen.
 */
export async function recordInterviewFeedback(
  applicationId: string,
  input: unknown,
): Promise<InterviewActionResult> {
  const context = await partyOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };
  const { uid, application } = context;

  if (application.landlordUid !== uid) {
    return { ok: false, message: "Solo el propietario registra cómo fue la entrevista." };
  }
  if (!application.interview?.confirmedAt) {
    return { ok: false, message: "La entrevista todavía no está confirmada." };
  }

  const parsed = interviewFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa lo que escribiste." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      "interview.feedback": {
        result: parsed.data.result,
        note: parsed.data.note,
        at: new Date().toISOString(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * No notification here on purpose. The tenant reads this on the page, and what they need
   * telling about is the process moving — which the advance already announces. Two bells for
   * one action is how a bell stops being read.
   */
  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
