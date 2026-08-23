"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";
import { contractFileProblem, spotProblem } from "../domain/contract";
import { contractNoteSchema, signatureSpotsSchema } from "../validations/contract";

export type ContractActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The contract, uploaded so the two parties can sign it here.
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
export async function uploadContract(
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
    return { ok: false, message: "Solo el propietario sube el contrato." };
  }

  const file = formData.get("contract");
  if (!(file instanceof File)) return { ok: false, message: "Adjunta el contrato." };

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

  const bytes = Buffer.from(await file.arrayBuffer());
  /*
   * El hash del archivo exacto, con Web Crypto para no importar `node:crypto` en un módulo que
   * entra en el grafo de páginas públicas. Es la pieza que hace detectable cualquier alteración
   * posterior (Decreto 2364): cada firma se ata a este valor, así que reemplazar el archivo
   * invalida por sí solo lo que ya estuviera firmado.
   */
  const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  try {
    await adminStorage()
      .bucket()
      .file(path)
      .save(bytes, {
        contentType: file.type,
        // Private by default; both parties read it through a short-lived signed URL.
        resumable: false,
      });
  } catch (error) {
    console.error("uploadContract failed:", error instanceof Error ? error.message : error);

    return { ok: false, message: "No pudimos guardar el contrato. Inténtalo de nuevo." };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      contract: {
        document: {
          path,
          fileName: file.name.slice(-120),
          contentType: file.type,
          bytes: file.size,
          sha256,
          uploadedAt: new Date().toISOString(),
        },
        /*
         * Un archivo nuevo empieza sin firmas. No hace falta borrar las anteriores — su
         * `documentHash` ya no coincide y dejan de contar — pero guardarlas sería conservar
         * evidencia de una firma sobre un documento que ya no es este.
         */
        signatures: [],
        /*
         * Los puntos son del archivo, no del proceso: un contrato nuevo se marca de nuevo, y el
         * PDF derivado del anterior ya no describe nada.
         */
        spots: [],
        stamped: null,
        note: parsedNote.data.note,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * The tenant is told, and this one earns the interruption: there is a contract waiting for their
   * signature, and nothing moves until they give it. The file itself never leaves in the email — it
   * is reachable from the page, behind the session, which is where it should stay.
   */
  const [landlord, tenant] = await Promise.all([
    getProfile(user.uid),
    getProfile(application.tenantUid),
  ]);

  await notify({
    recipientUid: application.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: "contract_ready",
    applicationId,
    stage: "contract_signature",
    propertyTitle: application.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: parsedNote.data.note,
  });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * Where each party signs on the page, as the landlord marked it on the preview.
 *
 * Its own action, and not part of the upload, because of the order things happen in: the landlord
 * has to *see* the pages before they can point at them, and the pages only render once the file is
 * up. Marking again replaces the pair — a spot is a position, not a history.
 *
 * **It does not touch the signatures.** Moving a box changes where a stroke is drawn, not what
 * anybody agreed to, and the document's hash is untouched by it. That is why this is allowed while
 * signatures already exist, and why replacing the *file* is the thing that voids them.
 */
export async function saveSignatureSpots(
  applicationId: string,
  input: unknown,
): Promise<ContractActionResult> {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, message: "Este proceso no existe o no es tuyo." };
  if (application.status !== "open") return { ok: false, message: "Este proceso ya está cerrado." };
  if (application.stage !== "contract_signature") {
    return { ok: false, message: "El proceso no está en la etapa de la firma." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario marca dónde se firma." };
  }
  if (!application.contract?.document) {
    return { ok: false, message: "Sube el contrato antes de marcar dónde se firma." };
  }
  if (application.contract.document.contentType !== "application/pdf") {
    return { ok: false, message: "Solo se puede marcar la firma sobre un PDF." };
  }

  const parsed = signatureSpotsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los recuadros." };
  }

  // La geometría, otra vez y con la misma función pura que usó el visor antes de dejar guardar.
  for (const spot of parsed.data.spots) {
    const problem = spotProblem(spot);
    if (problem) return { ok: false, message: problem };
  }

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      "contract.spots": parsed.data.spots,
      updatedAt: FieldValue.serverTimestamp(),
    });

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}

/**
 * Removes the contract entirely: the file, the boxes, the stamped copy and any signature over it.
 *
 * Replacing was the only way out before, which is not the same thing: somebody who uploaded the
 * wrong file wants it *gone*, not swapped for another one they may not have to hand yet. Leaving no
 * way to undo an upload is how a screen ends up with a document nobody wanted and no way back.
 *
 * The signatures go with it, and that is not a loss of evidence: a signature is bound to the hash
 * of a document, so with the document gone there is nothing it could attest to. `validSignatures`
 * would already have discarded them; clearing them keeps the record from claiming otherwise.
 */
export async function removeContract(applicationId: string): Promise<ContractActionResult> {
  const user = await requireCompleteProfile();
  const application = await getApplicationFor(applicationId, user.uid);

  if (!application) return { ok: false, message: "Este proceso no existe o no es tuyo." };
  if (application.status !== "open") return { ok: false, message: "Este proceso ya está cerrado." };
  if (application.stage !== "contract_signature") {
    return { ok: false, message: "El proceso no está en la etapa de la firma." };
  }
  if (application.landlordUid !== user.uid) {
    return { ok: false, message: "Solo el propietario puede quitar el contrato." };
  }

  const contract = application.contract;
  if (!contract?.document) return { ok: false, message: "No hay contrato que quitar." };

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({
      contract: { document: null, signatures: [], spots: [], stamped: null, note: contract.note },
      updatedAt: FieldValue.serverTimestamp(),
    });

  /*
   * Los archivos se borran después del documento: si esto falla, queda un archivo huérfano en el
   * bucket, que es un coste. Al revés quedaría un registro apuntando a un archivo que no existe,
   * que es una página rota.
   */
  const bucket = adminStorage().bucket();
  const paths = [
    contract.document.path,
    contract.stamped?.path,
    ...contract.signatures.map((signature) => signature.strokePath),
  ].filter((path): path is string => Boolean(path));

  await Promise.all(
    paths.map((path) =>
      bucket
        .file(path)
        .delete()
        .catch(() => undefined),
    ),
  );

  revalidatePath(applicationRoute(applicationId));
  return { ok: true };
}
