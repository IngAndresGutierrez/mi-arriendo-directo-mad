"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { listTenantDocuments, DOCUMENT_LABELS } from "@/features/tenant-profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";

export type ReviewResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

const inputSchema = z.object({
  documentId: z.string().trim().min(1).max(200),
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).default(""),
});

/**
 * The landlord judges one uploaded document.
 *
 * The verdict is stored **on the application**, not on the document. A payslip approved by one
 * landlord is not approved for the next one, and letting a landlord write into the tenant's own
 * profile would be letting them mark someone else's papers on a record that follows that person
 * everywhere.
 *
 * A rejection carries a note, because "rechazado" on its own tells the tenant to upload
 * something again without telling them what was wrong with it.
 */
export async function reviewTenantDocument(
  applicationId: string,
  input: unknown,
): Promise<ReviewResult> {
  const user = await requireCompleteProfile();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "No pudimos guardar la revisión." };
  }

  const application = await getApplicationFor(applicationId, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario revisa los documentos." };
  }
  if (application.status !== "open") {
    return { ok: false, message: "Este proceso ya está cerrado." };
  }

  /*
   * The id has to belong to a document this tenant actually uploaded. Without the check, a
   * landlord could write arbitrary keys into the map — harmless-looking, but it is the kind of
   * open door that later turns into "approved" appearing for a document nobody sent.
   */
  const documents = await listTenantDocuments(application.tenantUid);
  const document = documents.find((candidate) => candidate.id === parsed.data.documentId);
  if (!document) {
    return { ok: false, message: "Ese documento ya no existe." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      [`documentReviews.${parsed.data.documentId}`]: {
        status: parsed.data.status,
        note: parsed.data.status === "rejected" ? parsed.data.note : "",
        at: new Date(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * A rejection is told; an approval is not.
   *
   * The tenant has to act on a rejection — upload something else — and the reason is the only
   * thing that says what. One approval out of five is a status change nobody needs interrupting
   * for, and when the last one lands the stage moves, which announces itself already.
   */
  if (parsed.data.status === "rejected") {
    const [landlord, tenant] = await Promise.all([
      getProfile(user.uid),
      getProfile(application.tenantUid),
    ]);

    await notify({
      recipientUid: application.tenantUid,
      recipientEmail: tenant?.email ?? null,
      type: "document_rejected",
      applicationId,
      stage: application.stage,
      propertyTitle: application.propertyTitle,
      actorName: landlord?.fullName ?? "",
      detail: parsed.data.note
        ? `${DOCUMENT_LABELS[document.kind]}: ${parsed.data.note}`
        : `Se trata de: ${DOCUMENT_LABELS[document.kind]}.`,
    });
  }

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}
