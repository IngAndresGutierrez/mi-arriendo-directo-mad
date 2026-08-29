"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireCompleteProfile } from "@/features/profile";
import { requireRole } from "@/shared/auth/session";
import {
  ADMIN_VERIFICATIONS_ROUTE,
  editPropertyRoute,
  MY_PROPERTIES_ROUTE,
  propertyDetailRoute,
} from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getOwnedProperty, getPropertyLocation } from "../data/property";
import { getVerification } from "../data/verification";
import {
  isOwnVerificationPath,
  verificationBlocker,
  verificationDocumentProblem,
  verificationState,
  type VerificationDocument,
} from "../domain/verification";
import {
  verificationRequestSchema,
  verificationVerdictSchema,
} from "../validations/verification";

export type VerificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * A landlord asks for their ownership of one listing to be checked.
 *
 * **The files do not come through here**, for the reason every upload in this product states: a
 * Server Action's body is capped at 1 MB and a scanned certificate is not. The browser uploads
 * straight to Cloud Storage and this records what landed — which makes the three checks below the
 * real gate:
 *
 * 1. the caller **owns this listing** — the Storage rules see a uid and a path and cannot read
 *    Firestore, so they cannot ask;
 * 2. every path sits inside the caller's **own** folder;
 * 3. every object **exists in the bucket** with the type and size it claims, or a reviewer opens a
 *    queue of broken previews.
 *
 * **And the matrícula is read from `private/location`, never from the request.** It is what the
 * approval will be bound to, so a client that could send its own would be choosing what its badge
 * is about — the same reason the acta's fingerprint is computed on the server.
 */
export async function requestVerification(
  propertyId: string,
  input: unknown,
): Promise<VerificationResult> {
  const user = await requireCompleteProfile();

  const property = await getOwnedProperty(propertyId, user.uid);
  if (!property) return { ok: false, message: "Este inmueble no existe o no es tuyo." };

  const location = await getPropertyLocation(propertyId, user.uid);
  const registryNumber = location?.registryNumber ?? "";
  const current = await getVerification(propertyId);
  const blocker = verificationBlocker(
    property,
    registryNumber,
    verificationState(current, registryNumber),
  );

  if (blocker) return { ok: false, message: BLOCKED[blocker] };

  const parsed = verificationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los archivos." };
  }

  const documents = await confirmDocuments(parsed.data.documents, user.uid);
  if (!documents.ok) return { ok: false, message: documents.message };

  await adminDb()
    .collection("properties")
    .doc(propertyId)
    .collection("private")
    .doc("verification")
    .set(
      {
        documents: documents.files,
        submittedAt: new Date().toISOString(),
        /*
         * A resubmission clears the previous verdict rather than stacking one: what is being asked
         * about is this set of documents, and a refusal from a month ago is about the ones that were
         * replaced. The note goes with it — leaving it would show the landlord a reason that no
         * longer refers to anything they can see.
         */
        verifiedAt: null,
        rejectedAt: null,
        note: "",
        registryNumber,
        reviewerUid: "",
        ...(current ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  revalidatePath(editPropertyRoute(propertyId));
  revalidatePath(MY_PROPERTIES_ROUTE);

  return { ok: true };
}

const BLOCKED: Readonly<Record<string, string>> = {
  not_published: "Publica el inmueble primero: la insignia es lo que lee quien mira el anuncio.",
  no_registry: "Falta la matrícula inmobiliaria del inmueble. Agrégala en el formulario y vuelve.",
  in_review: "Ya hay una solicitud en revisión para este inmueble.",
  already_verified: "Este inmueble ya está verificado.",
};

/**
 * A reviewer decides, having read the certificado de tradición y libertad.
 *
 * **`requireRole("admin")` and nothing else would do.** This is the one write in the product that
 * grants a public claim about somebody — the badge a stranger is asked to trust — and the person it
 * is about is exactly the person with a reason to write it. `firestore.rules` freezes
 * `ownershipVerifiedAt` against every client, admins included, so the Admin SDK here is the only
 * path to it.
 *
 * **Only the approval is published.** A refusal stays in the private file, between the landlord and
 * the reviewer: publishing "verificación rechazada" would be a scarlet letter this product cannot
 * justify — a certificate can be out of date, a co-owner can be missing from it, and neither is a
 * finding about a person.
 */
export async function decideVerification(
  propertyId: string,
  input: unknown,
): Promise<VerificationResult> {
  const reviewer = await requireRole("admin");

  const parsed = verificationVerdictSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el veredicto." };
  }

  const verification = await getVerification(propertyId);
  if (!verification?.submittedAt) {
    return { ok: false, message: "No hay una solicitud que revisar en este inmueble." };
  }
  if (verification.verifiedAt || verification.rejectedAt) {
    return { ok: false, message: "Esta solicitud ya fue revisada." };
  }

  const now = new Date().toISOString();
  const batch = adminDb().batch();
  const property = adminDb().collection("properties").doc(propertyId);

  batch.set(
    property.collection("private").doc("verification"),
    {
      ...(parsed.data.approve ? { verifiedAt: now } : { rejectedAt: now }),
      note: parsed.data.note,
      reviewerUid: reviewer.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  /*
   * The public half is one field and only on an approval. `FieldValue.delete()` on a refusal rather
   * than an omission: this runs on a resubmission too, and a property that had been approved before
   * must not keep the badge because the key was simply left out of the write.
   */
  batch.update(property, {
    ...(parsed.data.approve
      ? { ownershipVerifiedAt: now }
      : { ownershipVerifiedAt: FieldValue.delete() }),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  const slug = (await property.get()).data()?.slug;
  if (typeof slug === "string") revalidatePath(propertyDetailRoute(slug));
  revalidatePath(ADMIN_VERIFICATIONS_ROUTE);

  return { ok: true };
}

async function confirmDocuments(
  claimed: readonly { readonly path: string; readonly fileName: string }[],
  uid: string,
): Promise<
  | { readonly ok: true; readonly files: VerificationDocument[] }
  | { readonly ok: false; readonly message: string }
> {
  const files: VerificationDocument[] = [];

  for (const one of claimed) {
    if (!isOwnVerificationPath(one.path, uid)) {
      return { ok: false, message: "Uno de los archivos no corresponde a tu cuenta." };
    }

    const confirmed = await confirmInBucket(one.path);
    if (!confirmed) {
      return { ok: false, message: "No pudimos confirmar uno de los archivos. Vuelve a subirlo." };
    }

    const problem = verificationDocumentProblem({
      type: confirmed.contentType,
      size: confirmed.bytes,
    });
    if (problem) return { ok: false, message: problem };

    files.push({
      path: one.path,
      fileName: one.fileName,
      contentType: confirmed.contentType,
      bytes: confirmed.bytes,
      uploadedAt: new Date().toISOString(),
    });
  }

  return { ok: true, files };
}

async function confirmInBucket(
  path: string,
): Promise<{ readonly contentType: string; readonly bytes: number } | null> {
  try {
    const [metadata] = await adminStorage().bucket().file(path).getMetadata();

    return {
      contentType: String(metadata.contentType ?? ""),
      bytes: Number(metadata.size ?? 0),
    };
  } catch (error) {
    console.error(`could not confirm ${path}:`, error);

    return null;
  }
}
