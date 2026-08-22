"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { CHECK_SOURCES, CHECK_SOURCE_IDS } from "../domain/background-check";

export type CheckRecordResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

const inputSchema = z.object({
  source: z.enum(CHECK_SOURCE_IDS as [string, ...string[]]),
  status: z.enum(["clean", "findings"]),
  note: z.string().trim().max(300).default(""),
});

/**
 * The landlord writes down what one search turned up.
 *
 * It requires the tenant's authorisation to already be on the application — recording the result
 * of a search nobody was allowed to run would be recording an admission. Ley 1581 again, and the
 * check is here rather than only in the interface because an interface is not where consent is
 * enforced.
 */
export async function recordBackgroundCheck(
  applicationId: string,
  input: unknown,
): Promise<CheckRecordResult> {
  const user = await requireCompleteProfile();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "No pudimos guardar esa consulta." };
  }

  const application = await getApplicationFor(applicationId, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario registra las consultas." };
  }
  if (application.status !== "open") {
    return { ok: false, message: "Este proceso ya está cerrado." };
  }
  if (!application.checksAuthorizedAt) {
    return { ok: false, message: "El inquilino todavía no autorizó la consulta." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      [`checkResults.${parsed.data.source}`]: {
        status: parsed.data.status,
        note: parsed.data.note,
        at: new Date(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * A finding is told; a clean result is not.
   *
   * "No encontré nada" needs no interrupting — and there are four of these, so announcing each
   * would make the tenant's bell useless on the day it matters. A finding is different: it is
   * about them, it is written down, and they should not learn of it by opening the page later.
   */
  if (parsed.data.status === "findings") {
    const source = CHECK_SOURCES.find((candidate) => candidate.id === parsed.data.source);
    const [landlord, tenant] = await Promise.all([
      getProfile(user.uid),
      getProfile(application.tenantUid),
    ]);

    await notify({
      recipientUid: application.tenantUid,
      recipientEmail: tenant?.email ?? null,
      type: "check_findings",
      applicationId,
      stage: application.stage,
      propertyTitle: application.propertyTitle,
      actorName: landlord?.fullName ?? "",
      detail: parsed.data.note
        ? `${source?.name ?? "Una consulta"}: ${parsed.data.note}`
        : `Se trata de: ${source?.name ?? "una de las consultas"}.`,
    });
  }

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}
