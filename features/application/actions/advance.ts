"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify, type NotificationType } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute, CONTRACT_ROUTE } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { canAdvance, canClose, nextStage, type Stage } from "../domain/application";

/**
 * Which notification a stage deserves.
 *
 * Most advances are a status line, but two of them are a task: landing on `tenant_data` is
 * "sube tus documentos", and landing on `approved` is the answer the tenant has been waiting
 * for. Telling them apart is the difference between a notification that gets acted on and one
 * that gets ignored along with the rest.
 */
function typeForStage(stage: Stage): NotificationType {
  if (stage === "tenant_data") return "documents_requested";
  if (stage === "approved") return "application_approved";

  return "stage_advanced";
}

export type StageResult =
  | { readonly ok: true; readonly stage: Stage }
  | { readonly ok: false; readonly message: string };

/**
 * The landlord moves the process one stage forward.
 *
 * One stage, never a jump: the target is computed here from what is stored, so a stage arriving
 * from the client cannot decide anything. And only the landlord — the tenant is a party to this
 * document, which is exactly why "is this my process?" is not the question being asked.
 */
export async function advanceApplication(id: string): Promise<StageResult> {
  const user = await requireCompleteProfile();

  const application = await getApplicationFor(id, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario avanza el proceso." };
  }
  if (!canAdvance(application)) {
    return { ok: false, message: "Este proceso ya no avanza." };
  }

  const target = nextStage(application.stage);
  if (!target) {
    return { ok: false, message: "Este proceso ya no avanza." };
  }

  await adminDb()
    .collection("applications")
    .doc(id)
    .update({
      stage: target,
      history: FieldValue.arrayUnion({ stage: target, at: new Date(), by: "landlord" }),
      updatedAt: FieldValue.serverTimestamp(),
    });

  const [landlord] = await Promise.all([getProfile(user.uid)]);
  const tenant = await getProfile(application.tenantUid);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: typeForStage(target),
    applicationId: id,
    stage: target,
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
  });

  revalidatePath(applicationRoute(id));
  revalidatePath(CONTRACT_ROUTE);

  return { ok: true, stage: target };
}

/**
 * Stops the process: the landlord rejects it, or the tenant withdraws.
 *
 * The stage is left where it was on purpose. "Rejected at the interview" and "rejected on
 * arrival" are different things to have happened, and both people deserve to see which.
 */
async function close(
  id: string,
  status: "rejected" | "withdrawn",
  note: string,
): Promise<StageResult> {
  const user = await requireCompleteProfile();

  const application = await getApplicationFor(id, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }

  const isTheirs =
    status === "rejected"
      ? application.landlordUid === user.uid
      : application.tenantUid === user.uid;
  if (!isTheirs) {
    return {
      ok: false,
      message:
        status === "rejected"
          ? "Solo el propietario puede rechazar la postulación."
          : "Solo el inquilino puede retirar su postulación.",
    };
  }
  if (!canClose(application)) {
    return { ok: false, message: "Este proceso ya no se puede detener aquí." };
  }

  await adminDb()
    .collection("applications")
    .doc(id)
    .update({
      status,
      closingNote: note.slice(0, 600),
      history: FieldValue.arrayUnion({
        stage: application.stage,
        at: new Date(),
        by: status === "rejected" ? "landlord" : "tenant",
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

  // Whoever did not do it is the one who needs to be told.
  const actor = await getProfile(user.uid);
  const recipientUid = status === "rejected" ? application.tenantUid : application.landlordUid;
  const recipient = await getProfile(recipientUid);

  await notify({
    recipientUid,
    recipientEmail: recipient?.email ?? null,
    type: status === "rejected" ? "application_rejected" : "application_withdrawn",
    applicationId: id,
    stage: application.stage,
    propertyTitle: application.propertyTitle,
    actorName: actor?.fullName ?? "",
  });

  revalidatePath(applicationRoute(id));
  revalidatePath(CONTRACT_ROUTE);

  return { ok: true, stage: application.stage };
}

export async function rejectApplication(id: string, reason: string): Promise<StageResult> {
  return close(id, "rejected", reason);
}

export async function withdrawApplication(id: string): Promise<StageResult> {
  return close(id, "withdrawn", "");
}
