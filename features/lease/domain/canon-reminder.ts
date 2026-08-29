/**
 * When to remind somebody that a canon is due, and which reminder to send.
 *
 * **The one notification in the tenancy that nobody clicks into existence.** Every other movement
 * of a lease is somebody doing something — uploading a receipt, confirming it, reporting a leak —
 * and the product tells the other party. A month falling due is the clock, so something has to
 * wake the server up: `app/api/cron/canon-reminders`, on the same Vercel Cron the interview
 * reminders already ride.
 *
 * It is pure and unit-tested for the reason `dueReminder` is: this is a rule about **when to
 * message a person about money they owe**, and getting it wrong is either silence on the month
 * that mattered or a phone buzzing at somebody every morning. Neither is visible from a screen.
 *
 * ## What it deliberately does not do
 *
 * **It does not nag.** Each reminder goes out **once per month**, recorded on the period document,
 * and there is exactly one after the due date. A weekly chase is a different product decision with
 * a different legal weight — Ley 2300 limits the *frequency* of collection contact, not only its
 * hours — and building the recurring version without answering that question would be the kind of
 * thing that arrives as a complaint rather than as a bug.
 *
 * **It does not decide whether it is a decent hour to write.** That is
 * `collectionContactBlocker` in `features/notification`, and the sweep asks it separately: "is
 * this month due?" and "may we contact this person right now?" are two rules, and folding them
 * into one function is how the second one gets forgotten the day somebody reuses the first.
 */
import type { Period, ScheduledMonth } from "./lease";
import { periodState } from "./lease";

/**
 * The three moments, and each one is a different sentence.
 *
 * Three types rather than one `canon_reminder` carrying the day count inside, which is the rule
 * this product keeps paying for: the copy is the point. "Prepara el pago" is a note, "vence hoy"
 * is a task, and "estás en mora" is bad news the landlord also has to hear. A single reminder
 * would have to choose which of the three it is, and whichever it chose is the one somebody
 * needed the other two of.
 *
 * `daysFromDue` is signed and relative to the due date: negative is before it.
 */
export const CANON_REMINDERS = [
  { id: "due_soon", daysFromDue: -3 },
  { id: "due_today", daysFromDue: 0 },
  /*
   * The day after, not the same evening. A transfer made on the due date can land the next
   * morning, and telling somebody they are in arrears about money they already sent is the message
   * that makes them stop trusting every other one.
   */
  { id: "overdue", daysFromDue: 1 },
] as const;

export type CanonReminderId = (typeof CANON_REMINDERS)[number]["id"];

/** Whether a stored value is one of ours, so a hand-edited document cannot widen the union. */
export function isCanonReminderId(value: unknown): value is CanonReminderId {
  return CANON_REMINDERS.some((reminder) => reminder.id === value);
}

/**
 * How far past `dueDate` the day `today` is, in whole days. Negative before it.
 *
 * On the date strings rather than on `Date` arithmetic, and anchored at noon UTC: parsing
 * `2026-09-01` as an instant and subtracting gives 23 or 25 hours across a DST boundary in some
 * runtimes, and a canon reminder that fires a day early twice a year is a bug nobody can reproduce
 * on the machine that wrote it. Colombia has no DST, but the *server* is UTC and the reader's
 * browser is not, so the safe arithmetic is the one that never depends on either.
 */
export function daysFromDue(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;

  return Math.round((now - due) / 86_400_000);
}

/**
 * Beyond this many days past the due date, this sweep stops having anything useful to say.
 *
 * A month sixty days late is not a reminder problem, it is a decision the two of them have to
 * make — and a product still sending "recuerda pagar" two months on reads as a machine that has
 * not noticed. It also bounds the work: without it, every month of a tenancy that stopped paying
 * a year ago stays a candidate for ever.
 */
export const REMINDER_HORIZON_DAYS = 30;

/**
 * Which reminder this month is owed right now, and which earlier ones to write off with it.
 *
 * The **latest applicable one wins**, which is the mirror of the interview rule and the same
 * reasoning: there, the most imminent moment is the one worth somebody's attention; here it is the
 * furthest along. A tenancy whose first sweep runs a week after the due date must not open with
 * "tu canon vence en 3 días" about a month that is already in arrears — so the earlier ones are
 * marked as handled without being sent, which is also what stops them firing late on the next tick.
 *
 * Nothing is sent once the tenant has uploaded a receipt. At that point the ball is with the
 * landlord, and chasing somebody for money they have already said they sent is the product taking
 * a side it has no information to take. A **rejected** receipt is different: that month is not
 * paid, and `periodState` says so.
 */
export function dueCanonReminder(
  month: Pick<ScheduledMonth, "dueDate">,
  stored: Pick<Period, "receipt" | "verdict"> | null,
  remindersSent: readonly string[],
  today: string,
): { readonly send: CanonReminderId; readonly alsoMark: readonly CanonReminderId[] } | null {
  const state = periodState(month, stored, today);
  if (state === "paid" || state === "in_review") return null;

  const elapsed = daysFromDue(month.dueDate, today);
  if (elapsed > REMINDER_HORIZON_DAYS) return null;

  const sent = new Set(remindersSent);
  const due = CANON_REMINDERS.filter(
    (reminder) => !sent.has(reminder.id) && elapsed >= reminder.daysFromDue,
  );
  if (due.length === 0) return null;

  const latest = due.reduce((best, candidate) =>
    candidate.daysFromDue > best.daysFromDue ? candidate : best,
  );

  return {
    send: latest.id,
    alsoMark: due.filter((reminder) => reminder.id !== latest.id).map((reminder) => reminder.id),
  };
}

/**
 * The months this sweep could still have something to say about, oldest first.
 *
 * **`currentMonth` is not enough, and that was a real bug rather than a refinement.** The month a
 * tenancy is "in" is the month `today` falls in — so for a canon due on the 1st, the sweep looking
 * only at the current month would be looking at a due date already three weeks past while the
 * *next* month, the one three days away, is not a candidate at all. The "vence pronto" reminder
 * could never fire for that tenancy. It fires for a canon due on the 28th and not for one due on
 * the 1st, which is the sort of thing that looks like a delivery problem for months.
 *
 * So the window is expressed in days from each due date, not in calendar months: everything from
 * the earliest reminder's lead time up to the horizon.
 *
 * **Oldest first**, which is `focusMonth`'s rule on the tenant's side of the tenancy page and the
 * same reasoning: the debt worth naming is the one that has been sitting longest. The sweep takes
 * the first month that yields a reminder and stops, so a tenancy three months behind sends one
 * message per tick rather than three at once — and the next tick, an hour later, carries the next.
 */
export function remindableMonths<T extends { readonly dueDate: string }>(
  schedule: readonly T[],
  today: string,
): readonly T[] {
  const lead = Math.min(...CANON_REMINDERS.map((reminder) => reminder.daysFromDue));

  return schedule
    .filter((month) => {
      const elapsed = daysFromDue(month.dueDate, today);

      return elapsed >= lead && elapsed <= REMINDER_HORIZON_DAYS;
    })
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Who hears about it.
 *
 * The two before the due date are the tenant's business alone: telling a landlord that a canon is
 * due in three days is telling them the calendar, and a bell that rings for the calendar is a bell
 * that gets muted before the month it matters. **Arrears reach both**, because from that moment it
 * is a fact about the tenancy rather than a task for one person — the landlord decides what to do
 * about it, and finding out a month later from a bank statement is the failure this whole screen
 * exists to prevent.
 */
export function canonReminderAudience(id: CanonReminderId): {
  readonly tenant: boolean;
  readonly landlord: boolean;
} {
  return id === "overdue" ? { tenant: true, landlord: true } : { tenant: true, landlord: false };
}
