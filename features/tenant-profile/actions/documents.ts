"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { RENTALS_ROUTE, TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { DOCUMENT_CONTENT_TYPES, DOCUMENT_KINDS, DOCUMENT_MAX_BYTES } from "../domain/documents";

export type DocumentResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * What the browser reports after uploading straight to Cloud Storage.
 *
 * All of it is re-checked here. The upload itself is guarded by the Storage rules — size, type,
 * and a path inside the owner's folder — but this document is what the product then trusts, and
 * a client that lied about the type would have a PDF rendered as an image forever.
 */
const recordSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  path: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  contentType: z.enum(DOCUMENT_CONTENT_TYPES),
  size: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
});

/**
 * Records a document the tenant just uploaded.
 *
 * The path has to sit inside **their own** folder. Without that check, a caller could register
 * somebody else's file as theirs — the Storage rules would have stopped them uploading it, but
 * not from pointing at one that was already there.
 */
export async function recordTenantDocument(input: unknown): Promise<DocumentResult> {
  const user = await requireCompleteProfile();

  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "No pudimos guardar ese archivo. Vuelve a intentarlo." };
  }

  if (!parsed.data.path.startsWith(`applicants/${user.uid}/`)) {
    return { ok: false, message: "Ese archivo no corresponde a tu cuenta." };
  }

  await adminDb()
    .collection("tenantProfiles")
    .doc(user.uid)
    .collection("documents")
    .add({ ...parsed.data, uploadedAt: FieldValue.serverTimestamp() });

  revalidatePath(TENANT_PROFILE_ROUTE);
  revalidatePath(RENTALS_ROUTE);

  return { ok: true };
}

/**
 * Removes a document the tenant uploaded — the wrong file, an unreadable photo.
 *
 * The Storage rules deny `delete` to the client on purpose, so this is the only way a document
 * leaves: the record first, then the file. In that order, because a record pointing at nothing
 * renders as a broken link, while a file with no record is invisible and merely wastes bytes.
 */
export async function deleteTenantDocument(documentId: string): Promise<DocumentResult> {
  const user = await requireCompleteProfile();

  const reference = adminDb()
    .collection("tenantProfiles")
    .doc(user.uid)
    .collection("documents")
    .doc(documentId);

  const snapshot = await reference.get();
  const path = snapshot.data()?.path;
  if (!snapshot.exists || typeof path !== "string") {
    return { ok: false, message: "Ese documento ya no existe." };
  }

  await reference.delete();
  await adminStorage()
    .bucket()
    .file(path)
    .delete()
    .catch(() => undefined);

  revalidatePath(TENANT_PROFILE_ROUTE);
  revalidatePath(RENTALS_ROUTE);

  return { ok: true };
}
