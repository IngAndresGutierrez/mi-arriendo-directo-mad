"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { GUARANTEE_PROVIDER } from "../domain/guarantee";
import { guaranteePolicySchema, guaranteeRequestSchema } from "../validations/guarantee";

export type GuaranteeActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Only the landlord, only while the process is open and on this stage. */
async function landlordOn(applicationId: string) {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, error: "Este proceso no existe o no es tuyo." } as const;
  if (application.status !== "open") return { ok: false, error: "Este proceso ya está cerrado." } as const;
  if (application.stage !== "guarantee") {
    return { ok: false, error: "El proceso ya no está en la etapa de la garantía." } as const;
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, error: "Solo el propietario registra la póliza." } as const;
  }

  return { ok: true, uid: user.uid, application } as const;
}

async function tell(
  application: { tenantUid: string; propertyTitle: string; id: string },
  landlordUid: string,
  type: "guarantee_requested" | "guarantee_active",
  detail: string,
): Promise<void> {
  const [landlord, tenant] = await Promise.all([
    getProfile(landlordUid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type,
    applicationId: application.id,
    stage: "guarantee",
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail,
  });
}

/**
 * The landlord says they applied for the policy.
 *
 * It changes nothing on Sura's side — the product has no account there and does not pretend to —
 * but it is the difference between a tenant seeing "sin garantía" and seeing that the wait has
 * started. Sura writes to them directly to complete the study, and this is where they learn to
 * expect that email.
 */
export async function recordGuaranteeRequested(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa la nota." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        requestedAt: new Date().toISOString(),
        activeAt: null,
        policyNumber: "",
        note: parsed.data.note,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await tell(
    { ...context.application, id: applicationId },
    context.uid,
    "guarantee_requested",
    `Es con ${GUARANTEE_PROVIDER.name}, sin codeudor. Puede que te escriban para completar el estudio.`,
  );

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * The policy exists, and here is its number.
 *
 * This is what unblocks the stage: "ya la solicité" is a wait, not a guarantee, and signing a
 * contract on a policy the insurer may still refuse leaves the landlord with nothing behind it.
 */
export async function recordGuaranteePolicy(
  applicationId: string,
  input: unknown,
): Promise<GuaranteeActionResult> {
  const context = await landlordOn(applicationId);
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = guaranteePolicySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el número." };
  }

  const current = context.application.guarantee;

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      guarantee: {
        // Kept if it was already there: when the policy was applied for is part of the record.
        requestedAt: current?.requestedAt ?? new Date().toISOString(),
        activeAt: new Date().toISOString(),
        policyNumber: parsed.data.policyNumber,
        note: parsed.data.note || current?.note || "",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await tell(
    { ...context.application, id: applicationId },
    context.uid,
    "guarantee_active",
    `Póliza ${parsed.data.policyNumber} de ${GUARANTEE_PROVIDER.name}.`,
  );

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
