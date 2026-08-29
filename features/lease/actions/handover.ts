"use server";

import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { rentalRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getHandover } from "../data/handover";
import { getLeaseFor } from "../data/lease";
import {
  checkoutBlocker,
  handoverAnchor,
  handoverFingerprint,
  handoverPhotoProblem,
  handoverState,
  isHandoverKind,
  isOwnHandoverPath,
  mayDo,
  type HandoverArea,
  type HandoverKind,
  type HandoverPhoto,
} from "../domain/handover";
import { handoverDraftSchema, handoverObjectionSchema } from "../validations/handover";
import type { Lease } from "../domain/lease";

export type HandoverActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The landlord writes or revises one acta.
 *
 * **The files do not come through here**, for the reason the incidents already state: a Server
 * Action's body is capped at 1 MB and a dozen photos are not. The browser uploads straight to Cloud
 * Storage and this records what landed — which makes the three checks below the real gate:
 *
 * 1. the caller is a **party to this tenancy, and its landlord** — the Storage rules see a uid and a
 *    path and cannot read Firestore, so they cannot ask either question;
 * 2. every path sits inside the caller's **own** folder, or somebody records a file that exists and
 *    is not theirs;
 * 3. every object **actually exists in the bucket**, with the type and size it claims. Without it a
 *    client writes an acta carrying six photos that were never uploaded, and the tenant is asked to
 *    accept six broken previews.
 *
 * **And the fingerprint is computed here, never accepted from the client.** That is the single line
 * the whole design rests on: a client that could send its own fingerprint could have the tenant
 * accept one version while the acceptance stays pinned to another, and the acta would read as agreed
 * to when it is not. `firestore.rules` denies every client write for exactly this reason.
 */
export async function saveHandoverDraft(
  leaseId: string,
  kind: string,
  input: unknown,
): Promise<HandoverActionResult> {
  const context = await landlordOn(leaseId, kind);
  if (!context.ok) return context;

  const { kind: which } = context;

  if (which === "checkout") {
    const checkin = await getHandover(leaseId, "checkin");
    if (checkoutBlocker(checkin)) {
      return {
        ok: false,
        message: "Primero envía el acta de entrega: la devolución se compara contra ella.",
      };
    }
  }

  const current = await getHandover(leaseId, which);
  if (!mayDo(handoverState(current), "landlord", "draft")) {
    return { ok: false, message: "Esta acta ya no se puede editar." };
  }

  const parsed = handoverDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los espacios del acta." };
  }

  const areas: HandoverArea[] = [];
  for (const area of parsed.data.areas) {
    const photos = await confirmPhotos(area.photos, context.uid);
    if (!photos.ok) return { ok: false, message: photos.message };

    areas.push({ ...area, photos: photos.files });
  }

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("handovers")
    .doc(which)
    .set(
      {
        areas,
        fingerprint: fingerprintOf(areas),
        /*
         * Preserved rather than cleared. A revision does not un-send the acta, and it does not have
         * to clear the answers either: they carry the fingerprint of the version they were given
         * for, so `handoverState` sees them stop applying on its own. That is the same "no cleanup"
         * property the contract's `documentHash` has, and the reason there is nothing here to forget.
         */
        submittedAt: current?.submittedAt ?? null,
        acceptance: current?.acceptance ?? null,
        objection: current?.objection ?? null,
        ...(current ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await touch(leaseId);
  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

/**
 * The landlord sends it to the tenant.
 *
 * Separate from saving, because they are different acts: a half-written acta is a draft nobody has
 * been asked to agree to, and a screen that notified the tenant on every keystroke would be a screen
 * whose notifications get muted. This is the moment the record starts existing for two people.
 */
export async function submitHandover(
  leaseId: string,
  kind: string,
): Promise<HandoverActionResult> {
  const context = await landlordOn(leaseId, kind);
  if (!context.ok) return context;

  const current = await getHandover(leaseId, context.kind);
  if (!current || current.areas.length === 0) {
    return { ok: false, message: "Agrega al menos un espacio antes de enviar el acta." };
  }
  if (!mayDo(handoverState(current), "landlord", "submit")) {
    return { ok: false, message: "Esta acta ya fue enviada." };
  }

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("handovers")
    .doc(context.kind)
    .update({ submittedAt: new Date().toISOString(), updatedAt: FieldValue.serverTimestamp() });

  await touch(leaseId);
  await tell(context.lease, context.lease.tenantUid, context.kind, "handover_submitted", "");
  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

/**
 * The tenant agrees that the acta matches what they see.
 *
 * The evidence recorded is `at`, `ip` and `userAgent` bound to the **fingerprint**, which is the
 * shape `acceptedClauseAt` and `checksAuthorizedAt` already use. It is not a signature and does not
 * claim to be: see the note at the top of `domain/handover.ts`.
 */
export async function acceptHandover(
  leaseId: string,
  kind: string,
): Promise<HandoverActionResult> {
  const context = await tenantOn(leaseId, kind);
  if (!context.ok) return context;

  const current = await getHandover(leaseId, context.kind);
  if (!current || !mayDo(handoverState(current), "tenant", "accept")) {
    return { ok: false, message: "No hay un acta que aceptar ahora mismo." };
  }

  const requestHeaders = await headers();

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("handovers")
    .doc(context.kind)
    .update({
      acceptance: {
        at: new Date().toISOString(),
        /*
         * The stored fingerprint, so the acceptance is about the version the tenant was actually
         * shown. Recomputing it here from the areas would be the same value — and would also be the
         * place where, one refactor later, it stopped being.
         */
        fingerprint: current.fingerprint,
        /*
         * `x-forwarded-for` carries the client address through Vercel's proxy; the first entry is
         * the caller. Empty rather than a guess when it is absent: evidence that was invented is
         * worse than evidence that is missing.
         */
        ip: (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "",
        userAgent: (requestHeaders.get("user-agent") ?? "").slice(0, 200),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await touch(leaseId);
  await tell(context.lease, context.lease.landlordUid, context.kind, "handover_accepted", "");
  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

/** The tenant says what does not match, with their own photos. */
export async function objectHandover(
  leaseId: string,
  kind: string,
  input: unknown,
): Promise<HandoverActionResult> {
  const context = await tenantOn(leaseId, kind);
  if (!context.ok) return context;

  const current = await getHandover(leaseId, context.kind);
  if (!current || !mayDo(handoverState(current), "tenant", "object")) {
    return { ok: false, message: "No hay un acta que responder ahora mismo." };
  }

  const parsed = handoverObjectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Cuenta qué no coincide." };
  }

  const photos = await confirmPhotos(parsed.data.photos, context.uid);
  if (!photos.ok) return { ok: false, message: photos.message };

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("handovers")
    .doc(context.kind)
    .update({
      objection: {
        at: new Date().toISOString(),
        fingerprint: current.fingerprint,
        note: parsed.data.note,
        photos: photos.files,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  await touch(leaseId);
  /*
   * The note travels in the notification, unlike an incident's description. It is short by
   * construction — a thousand characters at most — and it is the only thing the landlord needs to
   * decide whether to revise the acta or call. Withholding it would make the bell a message saying
   * there is a message.
   */
  await tell(context.lease, context.lease.landlordUid, context.kind, "handover_objected", parsed.data.note);
  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

// ---------------------------------------------------------------------------
// the shared half
// ---------------------------------------------------------------------------

type Authorized =
  | { readonly ok: true; readonly lease: Lease; readonly kind: HandoverKind; readonly uid: string }
  | { readonly ok: false; readonly message: string };

/**
 * Authorization and the kind, in one answer.
 *
 * One function per party rather than a `party` argument, so a call site cannot pass the wrong one:
 * the two entry points that write the acta and the two that answer it are different actions with
 * different rules, and the check reads at the top of each.
 */
async function party(leaseId: string, kind: string, who: "landlord" | "tenant"): Promise<Authorized> {
  const user = await requireCompleteProfile();

  if (!isHandoverKind(kind)) return { ok: false, message: "Ese tipo de acta no existe." };

  const lease = await getLeaseFor(leaseId, user.uid);
  if (!lease) return { ok: false, message: "Este arriendo no existe o no es tuyo." };

  const uid = who === "landlord" ? lease.landlordUid : lease.tenantUid;
  if (uid !== user.uid) {
    return {
      ok: false,
      message:
        who === "landlord"
          ? "El acta la redacta el propietario."
          : "El acta la responde el inquilino.",
    };
  }

  return { ok: true, lease, kind, uid: user.uid };
}

const landlordOn = (leaseId: string, kind: string) => party(leaseId, kind, "landlord");
const tenantOn = (leaseId: string, kind: string) => party(leaseId, kind, "tenant");

/** The fingerprint the document stores: the canonical string, hashed so it stays short. */
function fingerprintOf(areas: readonly HandoverArea[]): string {
  return createHash("sha256").update(handoverFingerprint(areas)).digest("hex");
}

async function confirmPhotos(
  claimed: readonly { readonly path: string; readonly fileName: string }[],
  uid: string,
): Promise<
  { readonly ok: true; readonly files: HandoverPhoto[] } | { readonly ok: false; readonly message: string }
> {
  const files: HandoverPhoto[] = [];

  for (const one of claimed) {
    if (!isOwnHandoverPath(one.path, uid)) {
      return { ok: false, message: "Una de las fotos no corresponde a tu cuenta." };
    }

    const confirmed = await confirmInBucket(one.path);
    if (!confirmed) {
      return { ok: false, message: "No pudimos confirmar una de las fotos. Vuelve a subirla." };
    }

    const problem = handoverPhotoProblem({ type: confirmed.contentType, size: confirmed.bytes });
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
 * A missing object is the ordinary case rather than an error: an upload that failed halfway, a path
 * somebody made up, a file the browser reported before Cloud Storage had finished. All three end the
 * same way — the acta is refused and the photo is attached again.
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

/** The tenancy's own `updatedAt`, which is what wakes the other party's live subscription. */
async function touch(leaseId: string): Promise<void> {
  try {
    await adminDb()
      .collection("leases")
      .doc(leaseId)
      .update({ updatedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    // No live update is a lesser problem than a lost acta: the record is already written.
    console.error(`could not touch the tenancy ${leaseId}:`, error);
  }
}

async function tell(
  lease: Lease,
  recipientUid: string,
  kind: HandoverKind,
  type: "handover_submitted" | "handover_accepted" | "handover_objected",
  detail: string,
): Promise<void> {
  const profile = await getProfile(recipientUid);

  await notify({
    recipientUid,
    recipientEmail: profile?.email ?? null,
    type,
    applicationId: lease.id,
    // La última etapa del proceso; en un aviso de arrendamiento el destino sale del tipo.
    stage: "first_payment",
    propertyTitle: lease.propertyTitle,
    actorName: recipientUid === lease.tenantUid ? "" : lease.tenantName || "",
    handover: kind,
    ...(detail ? { detail } : {}),
  });
}

/** Exported so the page can name the anchor a notification links to. */
export { handoverAnchor };
