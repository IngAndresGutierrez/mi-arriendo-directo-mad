import "server-only";

import { cache } from "react";

import type { PaymentReceipt } from "@/features/application/client";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import {
  leaseSchedule,
  periodState,
  type Lease,
  type LeaseDoc,
  type Period,
  type PeriodDoc,
  type PeriodState,
  type ScheduledMonth,
} from "../domain/lease";

/** An hour: long enough to open and download, short enough that a forwarded link dies. */
const RECEIPT_LINK_TTL_MS = 60 * 60 * 1000;

/** A tenancy runs 6 or 12 months; ten years of them is well past anything real. */
const MAX_PERIODS = 120;

type Snapshot = { id: string; exists: boolean; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

function toLease(snapshot: Snapshot): Lease | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as LeaseDoc;

  return {
    ...doc,
    id: snapshot.id,
    // Defaulted rather than trusted: a tenancy written before the landlord could change where the
    // canon goes has no such field, and the type would be claiming an object that is `undefined`.
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
    /* Defaulted, like `receipt`: a month written before the reminders existed has no such key. */
    remindersSent: Array.isArray(doc.remindersSent) ? doc.remindersSent : [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * One tenancy, for someone who is part of it.
 *
 * A stranger gets `null` — the same answer as "there is no such tenancy", exactly as the process
 * page does it: the caller cannot tell the two apart, so a mistake at the call site leaks nothing,
 * not even the fact that this id is real.
 */
export const getLeaseFor = cache(
  async (id: string, viewerUid: string): Promise<Lease | null> => {
    const snapshot = (await adminDb().collection("leases").doc(id).get()) as unknown as Snapshot;

    const lease = toLease(snapshot);
    if (!lease) return null;

    return lease.tenantUid === viewerUid || lease.landlordUid === viewerUid ? lease : null;
  },
);

/**
 * The months this tenancy has documents for.
 *
 * **Only the ones something happened in.** The calendar is derived — `leaseSchedule` — so a month
 * with no document is not a gap, it is a month nobody has paid or been reminded about yet. Ordered
 * by the document id, which *is* the month, so `YYYY-MM` sorts chronologically for free.
 */
export const listPeriods = cache(async (leaseId: string): Promise<readonly Period[]> => {
  const snapshot = await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("periods")
    .orderBy("__name__")
    .limit(MAX_PERIODS)
    .get();

  return snapshot.docs
    .map((doc) => toPeriod(doc as unknown as Snapshot))
    .filter((period): period is Period => period !== null);
});

/**
 * The result of asking for somebody's tenancies — **"none" and "we could not tell" are different
 * answers, and this type is what keeps them apart.**
 *
 * `listNotifications()` already learned half of this lesson: it never throws, because the layout
 * that wraps every product screen reads it and an index still building took the whole product down.
 * Returning an empty array there is a mild lie — a bell with nothing in it. On a page whose *entire*
 * content is the list, the same lie is the worst bug this product has already shipped once: telling
 * somebody with three open processes that they had nothing.
 *
 * So the read does not throw and does not pretend. The page says which of the two happened.
 */
export type LeaseListing =
  | { readonly ok: true; readonly leases: readonly Lease[] }
  | { readonly ok: false };

/**
 * The tenancies someone is part of, on whichever side they are on, newest first.
 *
 * **Both queries need a composite index** (`tenantUid`+`createdAt`, `landlordUid`+`createdAt`), and
 * `firestore.indexes.json` carries them. That pair is not obvious from reading this function, which
 * is the whole problem: the emulator the drivers run against **does not enforce indexes**, so a
 * missing one survives `pnpm verify`, `pnpm build`, `pnpm test:rules` and every browser driver, and
 * announces itself as a `9 FAILED_PRECONDITION` in production.
 *
 * And a *newly deployed* index has a window of its own — minutes in which it exists and answers
 * "currently building and cannot be used yet". That window comes with **every** new composite index
 * this product will ever add, so it is not worth being a crash. `lease-indexes.test.ts` pins the
 * pair; this returns `{ ok: false }` and lets the page say so.
 */
export async function listLeasesFor(uid: string): Promise<LeaseListing> {
  const leases = adminDb().collection("leases");

  try {
    // Firestore cannot OR across two fields, so it is two queries — in parallel, because they do
    // not depend on each other and chaining them would double the latency of the page.
    const [asTenant, asLandlord] = await Promise.all([
      leases.where("tenantUid", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
      leases.where("landlordUid", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const byId = new Map<string, Lease>();
    for (const doc of [...asTenant.docs, ...asLandlord.docs]) {
      const lease = toLease(doc as unknown as Snapshot);
      if (lease) byId.set(lease.id, lease);
    }

    return {
      ok: true,
      leases: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch (error) {
    // Logged, so a screen that says "no pudimos" is still a failure somebody can go and read.
    console.error(`could not list the tenancies of ${uid}:`, error);

    return { ok: false };
  }
}

/**
 * Which of these applications already produced a tenancy.
 *
 * What it is for: the list of processes has to link an `active` one to its tenancy rather than to
 * itself, and asking one read per row would be a waterfall. `getAll` is one round trip for the lot,
 * and the ids are the application ids because that is what a lease id is.
 */
export async function leaseIdsAmong(
  applicationIds: readonly string[],
): Promise<ReadonlySet<string>> {
  if (applicationIds.length === 0) return new Set();

  const refs = applicationIds
    .slice(0, 50)
    .map((id) => adminDb().collection("leases").doc(id));
  const snapshots = await adminDb().getAll(...refs);

  return new Set(snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.id));
}

/**
 * A month's receipt with a link that works for the next hour, or `null`.
 *
 * `canon/**` is denied to every client by the explicit closure in `storage.rules`, so a URL signed
 * here is the only way either party opens it — which is what it should be: a transfer receipt
 * carries an account number and a name, and a permanent URL is one forward away from being public.
 */
export async function withReceiptUrl(
  receipt: PaymentReceipt | null,
): Promise<(PaymentReceipt & { readonly url: string }) | null> {
  if (!receipt?.path) return null;

  try {
    const [url] = await adminStorage()
      .bucket()
      .file(receipt.path)
      .getSignedUrl({ action: "read", expires: Date.now() + RECEIPT_LINK_TTL_MS });

    return { ...receipt, url };
  } catch (error) {
    // A month whose file is gone must not take the whole page down with it.
    console.error(`could not sign ${receipt.path}:`, error);

    return null;
  }
}

/**
 * Every month with its receipt already signed, keyed by month.
 *
 * The signing is what makes this worth a function: twelve months is twelve calls to Cloud Storage,
 * and awaited one after another that is twelve round trips before the page can render. Only the
 * months that actually have a file are signed.
 */
export async function periodsWithReceipts(
  periods: readonly Period[],
): Promise<ReadonlyMap<string, PaymentReceipt & { readonly url: string }>> {
  const signed = await Promise.all(
    periods.map(async (period) => [period.id, await withReceiptUrl(period.receipt)] as const),
  );

  return new Map(
    signed.filter(
      (entry): entry is [string, PaymentReceipt & { readonly url: string }] => entry[1] !== null,
    ),
  );
}

/**
 * One month of the tenancy, ready to render: the calendar entry, whatever document exists for it,
 * its state, and the receipt with a link that already works.
 *
 * Assembled here rather than in the page because it is three things that have to agree, and one of
 * them needs the server: signing twelve URLs, reading a subcollection the schedule knows nothing
 * about, and deciding a state from today's date in Bogotá. What crosses to the client is this — plain
 * objects, no `Map`, no `Timestamp` — so the panel can be a dumb list of rows.
 */
export type MonthRow = {
  readonly month: ScheduledMonth;
  readonly stored: Period | null;
  readonly state: PeriodState;
  readonly receipt: (PaymentReceipt & { readonly url: string }) | null;
};

export async function monthRows(lease: Lease, today: string): Promise<readonly MonthRow[]> {
  const [periods, schedule] = [await listPeriods(lease.id), leaseSchedule(lease, today)];
  const signed = await periodsWithReceipts(periods);
  const byId = new Map(periods.map((period) => [period.id, period]));

  return schedule.map((month) => {
    const stored = byId.get(month.id) ?? null;

    return {
      month,
      stored,
      state: periodState(month, stored, today),
      receipt: signed.get(month.id) ?? null,
    };
  });
}

/**
 * The month that deserves the screen, or `null` when nothing is owed.
 *
 * There is **one** of these on purpose: the panel that carries it is the one cyan button on the
 * page, and three CTAs is none. Overdue months come first and the oldest of them wins — the debt
 * you should clear is the one that has been sitting longest — and only then the month that is due.
 * The landlord's own version of this question is the same list read from the other side: a receipt
 * waiting for an answer is what they came here to do.
 */
export function focusMonth(rows: readonly MonthRow[], isLandlord: boolean): MonthRow | null {
  const order: readonly PeriodState[] = isLandlord
    ? ["in_review", "overdue", "rejected", "due"]
    : ["rejected", "overdue", "due", "in_review"];

  for (const state of order) {
    const match = rows.find((row) => row.state === state);
    if (match) return match;
  }

  return null;
}
