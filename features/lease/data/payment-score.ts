import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

import { leaseSchedule, type Lease, type LeaseDoc, type Period, type PeriodDoc } from "../domain/lease";
import { paymentScoreDetail, type PaymentScoreDetail } from "../domain/payment-score";

/**
 * Somebody's payment record across every tenancy they have rented, as a score.
 *
 * **Computed on read, never stored.** A stored score is a second source of truth that the day a
 * verdict is corrected by hand disagrees with the months it was derived from — the same choice
 * `leaseSummary` makes over the same documents. It also matters more here than usual: a stored
 * table of people's payment behaviour is a **credit bureau**, and that is a different legal object
 * with different obligations. Deriving it means the product holds no such table.
 *
 * Only the tenancies where this person is the **tenant** count. Being a landlord says nothing about
 * how somebody pays rent.
 */

/** Ten years of months across every tenancy: past this the read is not the right shape any more. */
const MAX_LEASES = 20;

type Snapshot = { id: string; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

/**
 * The score for one tenant, with the counts.
 *
 * **Never throws.** It is read beside a process page and on somebody's own profile, and a score
 * that could not be computed must not take either screen down — `listNotifications` and
 * `listLeasesFor` already make that call for the same reason. What comes back then is a score with
 * no history, which renders as "sin historial suficiente": the same thing a new tenant sees, and
 * the honest answer when the product does not know.
 */
export const paymentScoreFor = cache(
  async (tenantUid: string, today: string): Promise<PaymentScoreDetail> => {
    const empty: PaymentScoreDetail = {
      stars: null,
      band: "none",
      onTime: 0,
      late: 0,
      missed: 0,
      decided: 0,
    };
    if (!tenantUid) return empty;

    try {
      const leases = await adminDb()
        .collection("leases")
        .where("tenantUid", "==", tenantUid)
        .orderBy("createdAt", "desc")
        .limit(MAX_LEASES)
        .get();

      const entries = await Promise.all(
        leases.docs.map(async (snapshot) => {
          const lease = toLease(snapshot as unknown as Snapshot);
          if (!lease) return [];

          const periods = await adminDb()
            .collection("leases")
            .doc(lease.id)
            .collection("periods")
            .get();
          const byId = new Map(
            periods.docs.map((one) => [one.id, toPeriod(one as unknown as Snapshot)]),
          );

          return leaseSchedule(lease, today).map((month) => ({
            month,
            stored: byId.get(month.id) ?? null,
          }));
        }),
      );

      return paymentScoreDetail(entries.flat(), today);
    } catch (error) {
      console.error(`could not score the payment history of ${tenantUid}:`, error);

      return empty;
    }
  },
);

function toLease(snapshot: Snapshot): Lease | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as LeaseDoc;

  return {
    ...doc,
    id: snapshot.id,
    payout: doc.payout ?? null,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function toPeriod(snapshot: Snapshot): Period | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as PeriodDoc;

  return {
    ...doc,
    id: snapshot.id,
    receipt: doc.receipt ?? null,
    verdict: doc.verdict ?? null,
    remindersSent: Array.isArray(doc.remindersSent) ? doc.remindersSent : [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}
