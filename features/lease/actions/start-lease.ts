import "server-only";

// Not `"use server"`: this is called *by* the action that advances a process, never from a form.
// Published as an action it would let anyone conjure a tenancy for an application they can name.
import { FieldValue } from "firebase-admin/firestore";

import type { Application } from "@/features/application/client";
import { adminDb } from "@/shared/firebase/admin";
import { bogotaToday } from "@/shared/format/date";

import { periodOf, shiftMonths } from "../domain/lease";

/**
 * Opens the tenancy the moment a process reaches its ninth stage.
 *
 * **The first canon is the first month.** The landlord confirmed it before the process could get
 * here, so the tenancy starts with September already paid: the receipt and the verdict are carried
 * over verbatim onto `periods/{first}`. Without that, the tenant would open this screen and be
 * asked to pay a month they had just paid — and the only record of having paid it would be on the
 * other page.
 *
 * **Idempotent by construction.** The tenancy's id *is* the application's, so `create()` is what
 * makes running this twice impossible rather than a thing to remember; a second advance to `active`
 * cannot exist, but a retried request can.
 *
 * It never throws. Like `notify()`, it runs after the write that matters — the stage moved — and a
 * failure here must not undo it or show the landlord an error about work that succeeded. What it
 * costs is a tenancy that has to be opened by the next attempt, and what it logs is why.
 */
export async function startLease(application: Application, now: Date = new Date()): Promise<void> {
  /*
   * The start date is the move-in date **from the application**, and it is labelled that way
   * wherever it is shown. The contract is what governs the term and this product does not read it,
   * so presenting this as the legal start would be inventing one — but it is the only date in the
   * product that says when anybody expected to hold the keys, and a tenancy with no start date has
   * no calendar at all.
   *
   * A move-in date already in the past is left alone rather than pushed to today: it is what the
   * two of them agreed, and the months should be counted from it.
   */
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(application.desiredMoveIn)
    ? application.desiredMoveIn
    : bogotaToday(now);

  const lease = adminDb().collection("leases").doc(application.id);
  const firstPayment = application.firstPayment;

  try {
    await lease.create({
      propertyId: application.propertyId,
      propertySlug: application.propertySlug,
      propertyTitle: application.propertyTitle,
      propertyCity: application.propertyCity,
      landlordUid: application.landlordUid,
      tenantUid: application.tenantUid,
      tenantName: application.tenantName,
      monthlyCost: application.monthlyCost,
      startDate,
      months: application.leaseMonths,
      // Where the first canon went is where the next eleven go. Asking again on day one would be
      // asking for something the process already has.
      payout: firstPayment?.payout ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // ALREADY_EXISTS is the expected shape of a retry and not worth a line in the log; anything
    // else is, and neither is worth failing the advance that already happened.
    const code = (error as { code?: number | string }).code;
    if (code !== 6 && code !== "already-exists") {
      console.error(`could not open the tenancy for ${application.id}:`, error);
    }

    return;
  }

  if (!firstPayment?.receipt) return;

  /*
   * The first month, with the proof that it was paid and the landlord's own confirmation.
   *
   * Written after the tenancy and not inside a transaction on purpose: if this one fails the
   * tenancy still exists and the month reads as unpaid, which is a wrong screen somebody can fix
   * by uploading the receipt again. A transaction would instead leave the process at `active` with
   * no tenancy at all, which is a screen nobody can fix.
   */
  try {
    await lease
      .collection("periods")
      .doc(periodOf(startDate))
      .create({
        amount: application.monthlyCost,
        dueDate: shiftMonths(startDate, 0),
        receipt: firstPayment.receipt,
        verdict: firstPayment.verdict,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code !== 6 && code !== "already-exists") {
      console.error(`could not carry the first canon into ${application.id}:`, error);
    }
  }
}
