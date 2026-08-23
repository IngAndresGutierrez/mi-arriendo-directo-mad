"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { contractFileProblem } from "../domain/contract";
import { contractNoteSchema } from "../validations/contract";

export type ContractActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The signed contract, uploaded.
 *
 * **It goes through the server, not from the browser to the bucket**, unlike the listing photos
 * and the tenant's documents. `storage.rules` keeps `contracts/**` closed to every client, and it
 * should: the rule that has to hold here is "the landlord *of this application*, while it is on
 * *this* stage", and Security Rules cannot ask that without reading the application. So the
 * authorisation happens where the answer is available, and the bucket stays shut.
 *
 * The file is small — a signed PDF — so paying one hop for a rule that cannot be expressed the
 * other way is the right trade.
 */
export async function uploadSignedContract(
  applicationId: string,
  formData: FormData,
): Promise<ContractActionResult> {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, message: "Este proceso no existe o no es tuyo." };
  if (application.status !== "open") return { ok: false, message: "Este proceso ya está cerrado." };
  if (application.stage !== "contract_signature") {
    return { ok: false, message: "El proceso no está en la etapa de la firma." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario sube el contrato firmado." };
  }

  const file = formData.get("contract");
  if (!(file instanceof File)) return { ok: false, message: "Adjunta el contrato firmado." };

  // The same rule the browser already applied, applied again: what arrives here is a request,
  // not a promise about what the form allowed.
  const problem = contractFileProblem({ type: file.type, size: file.size });
  if (problem) return { ok: false, message: problem };

  const parsedNote = contractNoteSchema.safeParse({ note: formData.get("note") ?? "" });
  if (!parsedNote.success) {
    return { ok: false, message: parsedNote.error.issues[0]?.message ?? "Revisa la nota." };
  }

  /*
   * The name is sanitised and prefixed with a uuid: it comes from the landlord's disk, and a path
   * is not the place to find out what they called it. The original name is kept in the document
   * instead, so a download still arrives as "contrato-firmado.pdf".
   */
  const safeName = file.name.replace(/[^\w.-]/g, "-").slice(-80) || "contrato";
  const path = `contracts/${applicationId}/${crypto.randomUUID()}-${safeName}`;

  try {
    await adminStorage()
      .bucket()
      .file(path)
      .save(Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        // Private by default; both parties read it through a short-lived signed URL.
        resumable: false,
      });
  } catch (error) {
    console.error("uploadSignedContract failed:", error instanceof Error ? error.message : error);

    return { ok: false, message: "No pudimos guardar el contrato. Inténtalo de nuevo." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      contract: {
        path,
        fileName: file.name.slice(-120),
        contentType: file.type,
        bytes: file.size,
        uploadedAt: new Date().toISOString(),
        note: parsedNote.data.note,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * The tenant is told, and this one earns the interruption: it is the document that binds them,
   * and it is the first moment they can read what they signed from a place that is not their own
   * inbox. The file itself never leaves in the email — it is reachable from the page, behind the
   * session, which is where it should stay.
   */
  const [landlord, tenant] = await Promise.all([
    getProfile(user.uid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: "contract_signed",
    applicationId,
    stage: "contract_signature",
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: parsedNote.data.note,
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
