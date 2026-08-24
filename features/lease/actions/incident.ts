"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { notify, type NotificationType } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { rentalRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getLeaseFor } from "../data/lease";
import {
  attachmentProblem,
  canTransition,
  incidentState,
  isOwnAttachmentPath,
  transitionRequiresNote,
  MAX_INCIDENT_UPDATES,
  type IncidentAttachment,
  type IncidentState,
  type IncidentUpdate,
} from "../domain/incident";
import { incidentReportSchema, incidentUpdateSchema } from "../validations/incident";

export type IncidentActionResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string };

/**
 * The tenant reports something wrong with the property.
 *
 * **The files do not come through here, and that is not an optimisation.** A Server Action's request
 * body is capped at 1 MB by default in Next, and a video is tens of megabytes — so the browser
 * uploads straight to Cloud Storage with the web SDK (the route the listing photos and the identity
 * documents already take) and this records what landed. Raising `serverActions.bodySizeLimit` to fit
 * a video would raise it for *every* action in the product, which is the opposite of what a limit
 * that exists to bound request parsing is for.
 *
 * That split is what makes the checks below the real gate rather than a formality:
 *
 * 1. the caller has to be a **party to this tenancy**, and the tenant of it — the Storage rules can
 *    only see a uid and a path, because they cannot read Firestore;
 * 2. every path has to sit inside the caller's **own** folder, or somebody could record a file that
 *    exists but is not theirs (the rules would have refused the upload, not the reference);
 * 3. every object has to **actually exist in the bucket**, with the type and size it claims. This is
 *    the one check the schema cannot do: without it a client can write a report carrying five
 *    attachments that were never uploaded, and the landlord opens a report of five broken previews.
 *    The bucket's own metadata is used for the record, so the numbers on screen are not the client's
 *    word for them.
 */
export async function reportIncident(
  leaseId: string,
  input: unknown,
): Promise<IncidentActionResult> {
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(leaseId, user.uid);
  if (!lease) return { ok: false, message: "Este arriendo no existe o no es tuyo." };

  /*
   * The tenant reports; the landlord reads. Not an arbitrary asymmetry — an incident is what the
   * person living there finds, and a landlord "reporting" one about a property they do not occupy
   * would be a note about their own tenant with no way for the tenant to answer it. When there is
   * something for the landlord to say, it will be a reply on the report, not a report of their own.
   */
  if (lease.tenantUid !== user.uid) {
    return { ok: false, message: "Los incidentes los reporta el inquilino." };
  }

  const parsed = incidentReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Revisa el título y la descripción.",
    };
  }

  const attachments = await confirmAttachments(parsed.data.attachments, user.uid);
  if (!attachments.ok) return { ok: false, message: attachments.message };

  const reference = await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("incidents")
    .add({
      title: parsed.data.title,
      description: parsed.data.description,
      attachments: attachments.files,
      reporterUid: user.uid,
      reporterName: lease.tenantName || "",
      // Empty, not absent: the state is derived from this list, so a report is `reported` because
      // nothing has happened to it yet rather than because a field is missing.
      updates: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  await touch(leaseId);

  const landlord = await getProfile(lease.landlordUid);

  /*
   * The title, never the description, and no attachment.
   *
   * The same reasoning as the payout details: what leaves the product in an email is the least that
   * still gets somebody to the page. A description is what the tenant wrote about their home with the
   * door broken, and an email is forwarded, quoted and left open on a laptop; the title says what
   * happened and the link says where to read the rest, behind the session.
   */
  await notify({
    recipientUid: lease.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "incident_reported",
    applicationId: leaseId,
    // La última etapa del proceso; en una notificación de arrendamiento el destino sale del tipo.
    stage: "first_payment",
    incident: reference.id,
    propertyTitle: lease.propertyTitle,
    actorName: lease.tenantName || "",
    detail: parsed.data.title,
  });

  revalidatePath(rentalRoute(leaseId));

  return { ok: true, id: reference.id };
}

/**
 * Either party moves an incident along, or says something about it.
 *
 * **The transition is checked against the state derived from the stored thread**, never against
 * anything the client sends. That is the whole authorization step here: `canTransition` knows that
 * only the tenant resolves, that only the tenant withdraws their own report, and that a landlord who
 * has already said "ya lo arreglé" has nothing left to press. A client that posts `resolved` as the
 * landlord is refused because the record says they may not, not because a form did not offer it.
 *
 * Appended with `arrayUnion`? No — **read, append, write**, inside no transaction and deliberately
 * so. `arrayUnion` de-duplicates by value, which would silently drop the second identical "sigue
 * roto" a tenant sends twice; and the cap has to be counted anyway. Two updates landing in the same
 * millisecond can lose one, which for a two-person thread is a risk worth the simplicity — the same
 * trade the rest of this module makes.
 */
export async function updateIncident(
  leaseId: string,
  incidentId: string,
  input: unknown,
): Promise<IncidentActionResult> {
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(leaseId, user.uid);
  if (!lease) return { ok: false, message: "Este arriendo no existe o no es tuyo." };

  const isLandlord = lease.landlordUid === user.uid;

  const parsed = incidentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Revisa lo que escribiste.",
    };
  }

  const reference = adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("incidents")
    .doc(incidentId);

  const snapshot = await reference.get();
  const stored = snapshot.data();
  if (!snapshot.exists || !stored) {
    return { ok: false, message: "Ese incidente ya no existe." };
  }

  const updates = Array.isArray(stored.updates)
    ? (stored.updates as IncidentUpdate[])
    : [];
  if (updates.length >= MAX_INCIDENT_UPDATES) {
    return {
      ok: false,
      message: "Este incidente ya tiene demasiados mensajes. Escríbenos por soporte.",
    };
  }

  const state = incidentState({ updates });
  const movedTo = parsed.data.movedTo;

  if (movedTo && !canTransition(state, movedTo, isLandlord)) {
    return { ok: false, message: "Eso no se puede hacer con este incidente ahora mismo." };
  }
  if (movedTo && transitionRequiresNote(state, movedTo) && !parsed.data.note) {
    return { ok: false, message: "Cuéntale qué sigue mal: es lo único que dice qué corregir." };
  }

  const attachments = await confirmAttachments(parsed.data.attachments, user.uid);
  if (!attachments.ok) return { ok: false, message: attachments.message };

  const update: IncidentUpdate = {
    by: isLandlord ? "landlord" : "tenant",
    authorUid: user.uid,
    authorName: (isLandlord ? await landlordName(lease.landlordUid) : lease.tenantName) || "",
    // The server's clock. A browser's is the one thing on this page neither party controls.
    at: new Date().toISOString(),
    note: parsed.data.note,
    attachments: attachments.files,
    movedTo: movedTo ?? null,
  };

  await reference.update({
    updates: [...updates, update],
    updatedAt: FieldValue.serverTimestamp(),
  });

  await touch(leaseId);

  const recipientUid = isLandlord ? lease.tenantUid : lease.landlordUid;
  const recipient = await getProfile(recipientUid);

  await notify({
    recipientUid,
    recipientEmail: recipient?.email ?? null,
    type: NOTIFICATION_FOR_MOVE[movedTo ?? "comment"],
    applicationId: leaseId,
    // La última etapa del proceso; en una notificación de arrendamiento el destino sale del tipo.
    stage: "first_payment",
    incident: incidentId,
    propertyTitle: lease.propertyTitle,
    actorName: update.authorName,
    /*
     * The note, and never the description. It is what the other party has to read to act — "sigue
     * goteando por el mismo sitio" is the whole message — and it is what they wrote *for* them,
     * unlike the original report's description.
     */
    detail: parsed.data.note || String(typeof stored.title === "string" ? stored.title : ""),
  });

  revalidatePath(rentalRoute(leaseId));

  return { ok: true, id: incidentId };
}

/**
 * Which notification each move sends.
 *
 * A type per move rather than one `incident_updated`, because the copy is the point: "dicen que ya
 * está arreglado" is a task — the tenant has to go and look — while "hay un mensaje nuevo" is news.
 * A notification that does not say which of the two it is gets ignored, which is the lesson
 * `documents_requested` already paid for.
 */
const NOTIFICATION_FOR_MOVE: Readonly<Record<IncidentState | "comment", NotificationType>> = {
  comment: "incident_comment",
  reported: "incident_comment",
  in_progress: "incident_in_progress",
  awaiting_confirmation: "incident_awaiting_confirmation",
  resolved: "incident_resolved",
  withdrawn: "incident_withdrawn",
};

/** The landlord's own name, which the tenancy does not denormalize (it only carries the tenant's). */
async function landlordName(uid: string): Promise<string> {
  return (await getProfile(uid))?.fullName ?? "";
}

/**
 * Every claimed file, checked and turned into what actually gets stored.
 *
 * Shared by the report and by every update, because the three checks are the same three and the day
 * they differ is the day one of the two paths is the weak one: the path is inside the caller's own
 * folder, the object exists in the bucket, and what the bucket says it is passes the same rule the
 * picker applied. **What gets written is the bucket's metadata**, never the client's numbers.
 */
async function confirmAttachments(
  claimed: readonly { readonly path: string; readonly fileName: string }[],
  uid: string,
): Promise<
  | { readonly ok: true; readonly files: IncidentAttachment[] }
  | { readonly ok: false; readonly message: string }
> {
  const files: IncidentAttachment[] = [];

  for (const one of claimed) {
    if (!isOwnAttachmentPath(one.path, uid)) {
      return { ok: false, message: "Uno de los archivos no corresponde a tu cuenta." };
    }

    const confirmed = await confirmInBucket(one.path);
    if (!confirmed) {
      return {
        ok: false,
        message: "No pudimos confirmar uno de los archivos. Vuelve a adjuntarlo.",
      };
    }

    const problem = attachmentProblem({ type: confirmed.contentType, size: confirmed.bytes });
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

/**
 * What the bucket says about an object, or `null` if it is not there.
 *
 * A missing object is the ordinary case here, not an error: an upload that failed halfway, a path
 * somebody made up, a file the browser reported before Cloud Storage had finished. All three end the
 * same way — the report is refused and the tenant attaches it again.
 */
async function confirmInBucket(
  path: string,
): Promise<{ readonly contentType: string; readonly bytes: number } | null> {
  try {
    const [metadata] = await adminStorage().bucket().file(path).getMetadata();

    return {
      contentType: String(metadata.contentType ?? ""),
      // The bucket reports it as a string; a size that will not parse is not a size.
      bytes: Number(metadata.size ?? 0),
    };
  } catch (error) {
    console.error(`could not confirm ${path}:`, error);

    return null;
  }
}

/**
 * One timestamp on the tenancy, so the landlord's screen learns that a report arrived.
 *
 * The same trick the months play, one level down and for the same reason: `useLiveRefresh`
 * subscribes to a single document, and the incidents live in a subcollection. It is the tenancy's own
 * `updatedAt` rather than a field of its own, because that is the one the hook already watches.
 */
async function touch(leaseId: string): Promise<void> {
  try {
    await adminDb()
      .collection("leases")
      .doc(leaseId)
      .update({ updatedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    // No live update is a lesser problem than a lost report: the incident is already written.
    console.error(`could not touch the tenancy ${leaseId}:`, error);
  }
}
