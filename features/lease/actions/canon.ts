"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { receiptFileProblem } from "@/features/application/client";
import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { rentalRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";
import { bogotaToday } from "@/shared/format/date";

import { getLeaseFor, listPeriods } from "../data/lease";
import { leaseSchedule, verdictApplies, type Period } from "../domain/lease";
import { canonReceiptSchema, canonVerdictSchema, periodIdSchema } from "../validations/lease";

export type CanonActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Either party, on a month this tenancy actually has.
 *
 * **The month is checked against the schedule, not against the request.** A period id arriving from
 * the client is a document id, so accepting one the calendar does not contain would let either
 * party invent months — a canon for 2031, or a second September under a different spelling — and
 * every total on the page is computed over the schedule, so an invented month would be a document
 * nobody could ever see or correct.
 */
async function partyOn(leaseId: string, period: unknown, now: Date) {
  const user = await requireCompleteProfile();

  const parsedPeriod = periodIdSchema.safeParse(period);
  if (!parsedPeriod.success) return { ok: false, error: "Ese mes no es válido." } as const;

  const lease = await getLeaseFor(leaseId, user.uid);
  if (!lease) return { ok: false, error: "Este arriendo no existe o no es tuyo." } as const;

  const month = leaseSchedule(lease, bogotaToday(now)).find(
    (scheduled) => scheduled.id === parsedPeriod.data,
  );
  if (!month) {
    return { ok: false, error: "Ese mes no hace parte de este arriendo." } as const;
  }

  const stored = (await listPeriods(leaseId)).find((one) => one.id === month.id) ?? null;

  return {
    ok: true,
    uid: user.uid,
    lease,
    month,
    stored,
    isLandlord: lease.landlordUid === user.uid,
  } as const;
}

/**
 * The tenant uploads proof that they paid one month.
 *
 * Through the server, like every other file in this product: `canon/**` is denied to every client by
 * the explicit closure in `storage.rules`, and the rule that has to hold — "the tenant *of this
 * tenancy*, on a month it *has*" — is not something Security Rules can ask without reading two
 * documents and a calendar.
 *
 * The amount and the date are **what the tenant declares**. Nothing here reads a bank, which is
 * exactly why the landlord answers afterwards and why the file is kept beside the claim.
 */
export async function uploadCanonReceipt(
  leaseId: string,
  period: string,
  formData: FormData,
): Promise<CanonActionResult> {
  const context = await partyOn(leaseId, period, new Date());
  if (!context.ok) return { ok: false, message: context.error };
  if (context.isLandlord) {
    return { ok: false, message: "El comprobante lo sube el inquilino." };
  }
  if (!context.lease.payout) {
    return { ok: false, message: "El propietario todavía no ha indicado por dónde pagar." };
  }

  const file = formData.get("receipt");
  if (!(file instanceof File)) return { ok: false, message: "Adjunta el comprobante." };

  const problem = receiptFileProblem({ type: file.type, size: file.size });
  if (problem) return { ok: false, message: problem };

  const parsed = canonReceiptSchema.safeParse({
    amount: formData.get("amount") ?? "",
    paidOn: formData.get("paidOn") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  }

  const safeName = file.name.replace(/[^\w.-]/g, "-").slice(-80) || "comprobante";
  const path = `canon/${leaseId}/${context.month.id}/${crypto.randomUUID()}-${safeName}`;

  try {
    await adminStorage()
      .bucket()
      .file(path)
      .save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false });
  } catch (error) {
    console.error("uploadCanonReceipt failed:", error instanceof Error ? error.message : error);

    return { ok: false, message: "No pudimos guardar el comprobante. Inténtalo de nuevo." };
  }

  /*
   * `set` with a merge, not `update`: this may be the first thing that ever happens in this month,
   * and the document id *is* the month, so there is no way to end up with two Septembers. `amount`
   * and `dueDate` are written from the schedule the first time and then left alone — a month that
   * has been paid keeps the figure it was paid against.
   *
   * The previous verdict is kept as it is and **stops applying on its own**, because it is older
   * than this receipt — `verdictApplies` compares the two dates. Deleting it would lose the record
   * of a rejection, which is exactly what explains why there is a second receipt.
   */
  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("periods")
    .doc(context.month.id)
    .set(
      {
        amount: context.stored?.amount ?? context.month.amount,
        dueDate: context.stored?.dueDate ?? context.month.dueDate,
        receipt: {
          path,
          fileName: file.name.slice(-120),
          contentType: file.type,
          bytes: file.size,
          uploadedAt: new Date().toISOString(),
          amount: parsed.data.amount,
          paidOn: parsed.data.paidOn,
          note: parsed.data.note,
        },
        verdict: context.stored?.verdict ?? null,
        /*
         * `createdAt` only on the way in. The converter reads it back as an ISO string, so writing
         * that value again on a merge would quietly replace a `Timestamp` with text — and the next
         * read would answer the epoch. A merge leaves the field alone by not naming it.
         */
        ...(context.stored ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await touch(leaseId);

  const [tenant, landlord] = await Promise.all([
    getProfile(context.uid),
    getProfile(context.lease.landlordUid),
  ]);

  await notify({
    recipientUid: context.lease.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "canon_receipt_uploaded",
    applicationId: leaseId,
    stage: "active",
    period: context.month.id,
    propertyTitle: context.lease.propertyTitle,
    actorName: tenant?.fullName ?? "",
    detail: parsed.data.note,
  });

  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

/**
 * The landlord says whether that month's money arrived.
 *
 * This is what the month exists for. A receipt is what the tenant can prove; whether the money
 * landed is something only the person whose account it is can say, and no screenshot substitutes for
 * it — a transfer can be reversed, mistyped or sent to the wrong key and still photograph well.
 *
 * A rejection **needs a reason**, and the tenant reads it: it is the only thing that tells them what
 * to fix before uploading another one.
 */
export async function recordCanonVerdict(
  leaseId: string,
  period: string,
  input: unknown,
): Promise<CanonActionResult> {
  const context = await partyOn(leaseId, period, new Date());
  if (!context.ok) return { ok: false, message: context.error };
  if (!context.isLandlord) {
    return { ok: false, message: "Solo el propietario confirma que recibió el canon." };
  }

  const stored: Period | null = context.stored;
  if (!stored?.receipt) return { ok: false, message: "Todavía no hay comprobante que revisar." };
  if (verdictApplies(stored)) {
    return { ok: false, message: "Ya respondiste a este comprobante." };
  }

  const parsed = canonVerdictSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el motivo." };
  }

  const verdict = {
    status: parsed.data.status,
    at: new Date().toISOString(),
    reason: parsed.data.status === "rejected" ? parsed.data.reason : "",
  };

  await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("periods")
    .doc(context.month.id)
    .update({ verdict, updatedAt: FieldValue.serverTimestamp() });

  await touch(leaseId);

  const [landlord, tenant] = await Promise.all([
    getProfile(context.uid),
    getProfile(context.lease.tenantUid),
  ]);

  await notify({
    recipientUid: context.lease.tenantUid,
    recipientEmail: tenant?.email ?? null,
    type: verdict.status === "confirmed" ? "canon_paid" : "canon_receipt_rejected",
    applicationId: leaseId,
    stage: "active",
    period: context.month.id,
    propertyTitle: context.lease.propertyTitle,
    actorName: landlord?.fullName ?? "",
    detail: verdict.reason,
  });

  revalidatePath(rentalRoute(leaseId));

  return { ok: true };
}

/**
 * One timestamp on the tenancy, so the other party's screen learns that a month changed.
 *
 * The months live in a subcollection, and `useLiveRefresh` subscribes to a single document —
 * subscribing to twelve would be twelve listeners for a page somebody has open for a minute. So a
 * write inside a month nudges its parent, which is the same trick `touchApplicationDocuments()`
 * plays for a file that lands where the other side cannot read it.
 *
 * It is the tenancy's own `updatedAt` and not a field of its own: the hook already watches that one,
 * and a second timestamp would be a second thing to remember to write.
 */
async function touch(leaseId: string): Promise<void> {
  try {
    await adminDb()
      .collection("leases")
      .doc(leaseId)
      .update({ updatedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    // No live update is a lesser problem than a failed payment: the month is already written.
    console.error(`could not touch the tenancy ${leaseId}:`, error);
  }
}
