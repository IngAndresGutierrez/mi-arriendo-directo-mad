"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { listTenantDocuments } from "@/features/tenant-profile";
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
  if (!documents.some((document) => document.id === parsed.data.documentId)) {
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

  revalidatePath(applicationRoute(applicationId));

  return { ok: true };
}
