import "server-only";

// Not `"use server"`: the cron route calls this, never a form. Published as an action it would let
// anybody make the platform message every tenant in the product about money.
import { FieldValue } from "firebase-admin/firestore";

import { collectionContactBlocker, notify, type ContactBlocker } from "@/features/notification";
import { getProfile } from "@/features/profile";
import { bogotaToday } from "@/shared/format/date";
import { adminDb } from "@/shared/firebase/admin";

import {
  canonReminderAudience,
  dueCanonReminder,
  remindableMonths,
  type CanonReminderId,
} from "../domain/canon-reminder";
import {
  leaseSchedule,
  type Lease,
  type LeaseDoc,
  type Period,
  type PeriodDoc,
  type ScheduledMonth,
} from "../domain/lease";

export type CanonSweep = {
  /** How many tenancies were looked at. */
  readonly checked: number;
  /** How many reminders went out. One reminder can reach two people. */
  readonly sent: number;
  /** Why nothing left, when nothing did. `null` means the window was open. */
  readonly blocked: ContactBlocker | null;
};

/**
 * Ceiling on how many tenancies one sweep reads.
 *
 * **This is the same trade `CATALOG_MAX_SCAN` makes, and it has the same expiry date.** Firestore
 * cannot answer "which tenancies have a month falling due" — the schedule is derived from
 * `startDate` and `months`, on purpose, so there is no field to index. So the sweep reads them and
 * decides in memory.
 *
 * It stops being the right shape somewhere in the low thousands of tenancies, and what it wants
 * then is **not a bigger number**: it is a `nextCanonReminderAt` cursor on the lease, indexed, so
 * the query returns only what is actually due. That is a stored field which can drift from the
 * derived schedule, which is why it is not here yet — but it is the shape to reach for.
 *
 * The set is also unbounded for a second reason worth naming: **ending a tenancy is not built**,
 * so a lease from four years ago is still a document this sweep reads. `REMINDER_HORIZON_DAYS`
 * stops it from *messaging* anybody about it; nothing stops it from reading it.
 */
const MAX_SCAN = 400;

async function tenancies(): Promise<readonly Lease[]> {
  const snapshot = await adminDb().collection("leases").limit(MAX_SCAN).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as unknown as LeaseDoc;

    return { ...data, id: doc.id, createdAt: "", updatedAt: "" } as Lease;
  });
}

/**
 * Sends the canon reminders that are due today, and records that it did.
 *
 * ## Why it asks the contact window first
 *
 * A message about money somebody owes is **collection contact** under Ley 2300 de 2023, whichever
 * side of the due date it falls on, and that statute restricts the days and hours — not only for
 * WhatsApp, which `sendWhatsApp` already guards, but for email too. So the sweep refuses outright
 * outside the window and lets the next tick handle it: an hourly cron loses nothing by waiting,
 * and a Sunday reminder is the kind of thing that arrives as a complaint rather than as a bug.
 *
 * **The bell goes quiet with it**, and that is a deliberate simplification rather than a reading of
 * the law: a notification nobody wrote is one the next tick writes an hour later, and splitting the
 * three channels here would put "may we contact this person" in two places. If that ever needs to
 * change, the bell is the half that is a record rather than an outbound message.
 *
 * ## Why it writes before it sends
 *
 * Same as the interview sweep, for the same reason: this wakes up every hour, so a crash between
 * the write and the send costs one reminder, while the other order costs the same reminder every
 * hour until the month is paid.
 *
 * ## Why no WhatsApp
 *
 * `notify()` sends one only when a phone is passed, and a business-initiated WhatsApp outside the
 * 24-hour window has to be an **approved template**. There is one for the interview reminder and
 * none for a canon, so passing a phone here would deliver the interview's words about a rent
 * payment. Stated rather than half-built: it needs `WHATSAPP_CANON_TEMPLATE` approved by Meta.
 */
export async function remindDueCanons(now: Date = new Date()): Promise<CanonSweep> {
  const blocked = collectionContactBlocker(now);
  if (blocked) return { checked: 0, sent: 0, blocked };

  const today = bogotaToday(now);
  const leases = await tenancies();
  let sent = 0;

  for (const lease of leases) {
    /*
     * **One reminder per tenancy per tick, on the oldest month that still needs one.** A sweep that
     * messaged about every unpaid month would land three emails at once on the person least able to
     * absorb them; running hourly, the next tick carries the next month. `remindableMonths` is where
     * "which months are even in scope" lives, and it is not "the current one" — see its own note.
     */
    const found = await firstDue(lease, remindableMonths(leaseSchedule(lease, today), today), today);
    if (!found) continue;

    const { month, snapshot, stored, due } = found;
    const reference = snapshot.ref;

    /*
     * `set` with a merge and not `update`: a month nobody has touched has **no document**, because
     * a period only exists once something has happened in it. A reminder going out is something
     * happening in it, so this is where September is opened — with the figure and the date the
     * schedule says, which is exactly what `PeriodDoc` stores them for.
     */
    await reference.set(
      {
        amount: stored?.amount ?? month.amount,
        dueDate: stored?.dueDate ?? month.dueDate,
        receipt: stored?.receipt ?? null,
        verdict: stored?.verdict ?? null,
        remindersSent: FieldValue.arrayUnion(due.send, ...due.alsoMark),
        ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await deliver(lease, month.id, due.send);
    sent += 1;
  }

  return { checked: leases.length, sent, blocked: null };
}

/**
 * The first month of this tenancy that is owed a reminder, with the document behind it.
 *
 * One `get` per candidate month, and the loop stops at the first hit — a tenancy that is up to
 * date reads one document and moves on, which is the common case by a long way.
 */
async function firstDue(
  lease: Lease,
  months: readonly ScheduledMonth[],
  today: string,
): Promise<{
  readonly month: ScheduledMonth;
  readonly snapshot: FirebaseFirestore.DocumentSnapshot;
  readonly stored: PeriodDoc | undefined;
  readonly due: NonNullable<ReturnType<typeof dueCanonReminder>>;
} | null> {
  for (const month of months) {
    const snapshot = await adminDb()
      .collection("leases")
      .doc(lease.id)
      .collection("periods")
      .doc(month.id)
      .get();
    const stored = snapshot.data() as PeriodDoc | undefined;

    const due = dueCanonReminder(
      month,
      (stored ?? null) as Pick<Period, "receipt" | "verdict"> | null,
      Array.isArray(stored?.remindersSent) ? stored.remindersSent : [],
      today,
    );
    if (due) return { month, snapshot, stored, due };
  }

  return null;
}

/** One reminder, to whoever `canonReminderAudience` says should hear it. */
async function deliver(lease: Lease, period: string, id: CanonReminderId): Promise<void> {
  const audience = canonReminderAudience(id);
  const type =
    id === "due_soon" ? "canon_due_soon" : id === "due_today" ? "canon_due_today" : "canon_overdue";

  const recipients = [
    ...(audience.tenant ? [lease.tenantUid] : []),
    ...(audience.landlord ? [lease.landlordUid] : []),
  ];

  const profiles = await Promise.all(recipients.map((uid) => getProfile(uid)));

  for (const [index, uid] of recipients.entries()) {
    await notify({
      recipientUid: uid,
      recipientEmail: profiles[index]?.email ?? null,
      type,
      // A lease id **is** its application id, so this is what makes the link resolve.
      applicationId: lease.id,
      stage: "first_payment",
      propertyTitle: lease.propertyTitle,
      // Nobody caused this one: it is the calendar. These three sentences name no party.
      actorName: "",
      period,
    });
  }
}
