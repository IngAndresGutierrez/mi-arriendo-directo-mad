import type { LeaseTerm } from "@/features/property/client";
/*
 * Where the canon goes, whose proof it is and what the landlord answered — the same three shapes
 * the first canon already uses.
 *
 * Imported from the application module's public entry rather than copied, because they are
 * literally the same thing: the first canon *is* the first month of this tenancy, and the payout
 * the landlord declared there is where every following one goes. Two copies of `PaymentReceipt`
 * would be two things that can drift, and the first one to drift would be the field the landlord
 * confirms against.
 *
 * If a third domain ever needs them, they belong in `shared/`; with two, a cross-module import of
 * a public entry is the boundary working as designed.
 */
import type { PaymentReceipt, Payout, ReceiptVerdict } from "@/features/application/client";

/**
 * The tenancy, once it is running.
 *
 * **This is not the nine-stage process.** That one is the negotiation that *ends* in a signed
 * contract and it lives at `/contratos`; this is what happens afterwards, and it has a different
 * lifetime, a different rhythm and a different question to answer. The process asks "are we going
 * to do this?" once; the tenancy asks "was this month paid?" every month for a year.
 *
 * `leaseId` **is** the `applicationId`. One process produces one tenancy, so a second identifier
 * would be a second thing that can disagree with the first — the same reasoning as
 * `propertySlugs/{slug}`, whose document id is the slug.
 *
 * It could not live on the application document either: `LiveApplication` subscribes to that one,
 * so writing a monthly payment there would wake both parties and re-render the nine-stage page
 * every time somebody uploads a receipt for a month that has nothing to do with it.
 */
export type LeaseDoc = {
  readonly propertyId: string;
  /** Denormalized, like the application: a list of tenancies must not cost one read per property. */
  readonly propertySlug: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordUid: string;
  readonly tenantUid: string;
  readonly tenantName: string;
  /**
   * The canon, **as the application recorded it**.
   *
   * Labelled that way everywhere it is shown, for the reason the first-canon stage already gives:
   * the contract governs the canon and this product does not read it, so presenting this figure as
   * authoritative would be inventing one. A raise at renewal — the IPC adjustment Colombian leases
   * carry — is not built; see `leaseSchedule`.
   */
  readonly monthlyCost: number;
  /**
   * When the tenancy starts, `YYYY-MM-DD`. Taken from the move-in date on the application: it is
   * the only date in this product that says when anybody expected to hold the keys.
   */
  readonly startDate: string;
  /** 6 or 12, from the application. What one term lasts — not necessarily what the tenancy lasts. */
  readonly months: LeaseTerm;
  /**
   * Where the canon goes each month, inherited from the first one.
   *
   * Never `null` in practice: a tenancy only exists because the landlord confirmed the first canon,
   * and they could not have done that without saying where to receive it. Nullable anyway, because
   * a type that promises a value the database is not forced to hold is a type that lies once.
   */
  readonly payout: Payout | null;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type Lease = Omit<LeaseDoc, "createdAt" | "updatedAt"> & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * One month of the tenancy, at `leases/{leaseId}/periods/{YYYY-MM}`.
 *
 * **The document id is the month**, which is what makes a monthly charge idempotent: there is no
 * way to open September twice, and a sweep that runs again writes over what it already wrote
 * instead of adding a second September.
 *
 * `amount` and `dueDate` are stored rather than derived on read, even though `leaseSchedule`
 * computes both: a month that has already been paid must keep the figure it was paid against. A
 * canon that changes later would otherwise silently rewrite last year's receipts.
 */
export type PeriodDoc = {
  /** Whole pesos, as the schedule said when this month was first touched. */
  readonly amount: number;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly receipt: PaymentReceipt | null;
  readonly verdict: ReceiptVerdict | null;
  /**
   * Which canon reminders have already gone out for this month.
   *
   * On the month rather than on the tenancy, because the question is per-month: September's
   * reminders say nothing about October's. It is what makes the sweep idempotent — it runs every
   * hour, so what was sent is written **before** anything leaves, exactly as the interview
   * reminders do it. A crash between the write and the send costs one reminder; the other order
   * costs the same reminder every hour until the month is paid.
   *
   * Optional in the type and nowhere else: every period written before reminders existed has no
   * such key, and those documents are in the database now. `toPeriod` defaults it, and the rule
   * that reads it tolerates its absence anyway — a pure function that is only total because its
   * one caller is careful is a function waiting for a second caller. That lesson cost this module
   * a `Cannot read properties of undefined` on `updates` once already.
   */
  readonly remindersSent?: readonly string[];
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

export type Period = Omit<PeriodDoc, "createdAt" | "updatedAt"> & {
  /** `2026-09`. The document id, which *is* the month. */
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// ---------------------------------------------------------------------------
// calendar arithmetic, on strings
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Days in a month, without trusting `Date` to roll over the way you hoped.
 *
 * The 31st of February parses in some engines and lands in March in others, which is how a
 * schedule ends up with two documents for the same month.
 */
function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 30;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/**
 * `2026-01-31` plus one month is `2026-02-28`, not the 3rd of March.
 *
 * The day is clamped to the target month and **taken from the original date every time**, never
 * carried forward from the previous result: clamping once and then adding again would move a canon
 * due on the 31st to the 28th for the rest of the tenancy.
 */
export function shiftMonths(isoDate: string, months: number): string {
  const match = ISO_DATE.exec(isoDate.trim());
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12 + 1;

  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, daysInMonth(targetYear, targetMonth)))}`;
}

/** `2026-09-15` → `2026-09`. The period id of the month a date falls in. */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Whole months from one date's month to another's. Negative when the second is earlier. */
export function monthsBetween(from: string, to: string): number {
  const a = ISO_DATE.exec(from.trim());
  const b = ISO_DATE.exec(to.trim());
  if (!a || !b) return 0;

  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}

/**
 * The last day covered by a term that started on `startDate` and runs `months` months.
 *
 * A day *before* the anniversary: a twelve-month lease signed on the 15th of September 2026 runs
 * through the 14th of September 2027, and calling the 15th the last day would be selling
 * thirteen months of tenancy as twelve.
 */
export function termEndDate(startDate: string, months: number): string {
  const anniversary = shiftMonths(startDate, months);
  const match = ISO_DATE.exec(anniversary);
  if (!match) return "";

  const day = Number(match[3]);
  if (day > 1) return `${match[1]}-${match[2]}-${pad(day - 1)}`;

  // The 1st: step back into the previous month, which is a different length.
  const previous = shiftMonths(`${match[1]}-${match[2]}-01`, -1);
  const parts = ISO_DATE.exec(previous);
  if (!parts) return "";

  return `${parts[1]}-${parts[2]}-${pad(daysInMonth(Number(parts[1]), Number(parts[2])))}`;
}

// ---------------------------------------------------------------------------
// the term
// ---------------------------------------------------------------------------

/**
 * Where the tenancy is in its term.
 *
 * There is deliberately **no `ended`**, and that is the honest answer rather than a missing
 * feature. **Ley 820 de 2003 renews a residential lease for the same term** unless one of the
 * parties gives notice in the way and within the time the law sets out — so "the months are up" is
 * not "it ended", and a product that showed a tenancy as finished on its anniversary would be
 * telling both parties something the law says is false.
 *
 * Ending one on purpose — the notice, its deadline, who may give it and what it costs — is not
 * built. It is the piece of this domain that needs a lawyer's reading before it is written in code,
 * because getting it wrong ends somebody's housing or somebody's income.
 */
export const LEASE_TERM_STATES = ["upcoming", "running", "renewed"] as const;
export type LeaseTermState = (typeof LEASE_TERM_STATES)[number];

export const LEASE_TERM_STATE_LABELS: Readonly<Record<LeaseTermState, string>> = {
  upcoming: "Por empezar",
  running: "En curso",
  renewed: "Renovado",
};

/**
 * How many whole terms have already run out.
 *
 * `0` while the first one is still going. Past its end date it is `1`, which under Ley 820 means
 * the lease renewed for another one rather than that it stopped.
 */
export function termsElapsed(lease: Pick<Lease, "startDate" | "months">, today: string): number {
  const elapsed = monthsBetween(lease.startDate, today);
  if (elapsed < 0) return 0;

  // The day matters: a term that started on the 15th has not run out on the 1st of its anniversary
  // month, even though `monthsBetween` already says twelve.
  const completed = Math.floor(elapsed / lease.months);
  if (completed === 0) return 0;

  return today > termEndDate(lease.startDate, completed * lease.months) ? completed : completed - 1;
}

export function leaseTermState(
  lease: Pick<Lease, "startDate" | "months">,
  today: string,
): LeaseTermState {
  if (today < lease.startDate) return "upcoming";

  return termsElapsed(lease, today) > 0 ? "renewed" : "running";
}

/** The last day of the term the tenancy is currently inside. */
export function currentTermEnd(
  lease: Pick<Lease, "startDate" | "months">,
  today: string,
): string {
  return termEndDate(lease.startDate, (termsElapsed(lease, today) + 1) * lease.months);
}

// ---------------------------------------------------------------------------
// the schedule
// ---------------------------------------------------------------------------

/** One month the tenant owes a canon for. Derived, never stored. */
export type ScheduledMonth = {
  /** `2026-09` — the period id, and the document id if this month has one. */
  readonly id: string;
  /** 1-based, across the whole tenancy: month 13 of a 12-month lease is the first renewed one. */
  readonly ordinal: number;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly amount: number;
};

/**
 * Ten years. Not a business rule — a guard, so a start date typed as 1926 cannot ask the browser
 * to render fifteen hundred rows.
 */
export const MAX_SCHEDULED_MONTHS = 120;

/**
 * Every month of the tenancy so far, from the first to the end of the term it is currently in.
 *
 * **Derived, not stored**, and that is the point: a period document exists only once something has
 * happened in it, so there is nothing to backfill when Ley 820 renews the term and twelve more
 * months appear. The alternative — writing twelve documents when the tenancy starts — needs a
 * second job to write the next twelve, and a gap in that job is a month nobody can pay.
 *
 * The canon is the same figure for every month. **An IPC raise at renewal is not built**: it is a
 * negotiation between the two of them with a legal ceiling, not something to guess at here. The
 * months already touched keep the figure stored on their own document, so adding it later cannot
 * rewrite what was paid.
 */
export function leaseSchedule(
  lease: Pick<Lease, "startDate" | "months" | "monthlyCost">,
  today: string,
): readonly ScheduledMonth[] {
  if (!ISO_DATE.test(lease.startDate) || lease.months <= 0) return [];

  const terms = termsElapsed(lease, today) + 1;
  const count = Math.min(terms * lease.months, MAX_SCHEDULED_MONTHS);

  return Array.from({ length: count }, (_, index) => {
    const dueDate = shiftMonths(lease.startDate, index);

    return {
      id: periodOf(dueDate),
      ordinal: index + 1,
      dueDate,
      amount: lease.monthlyCost,
    };
  });
}

/** The month the tenancy is in right now, or `null` before it starts. */
export function currentMonth(
  schedule: readonly ScheduledMonth[],
  today: string,
): ScheduledMonth | null {
  const current = periodOf(today);

  return schedule.find((month) => month.id === current) ?? null;
}

// ---------------------------------------------------------------------------
// one month's state
// ---------------------------------------------------------------------------

/**
 * What is happening with one month.
 *
 * `upcoming` is a month whose due date has not arrived — there is nothing to chase and nothing to
 * apologise for. `overdue` is the only one that is bad news, and it says so once, on the row it
 * belongs to.
 */
export const PERIOD_STATES = [
  "upcoming",
  "due",
  "overdue",
  "in_review",
  "rejected",
  "paid",
] as const;
export type PeriodState = (typeof PERIOD_STATES)[number];

export const PERIOD_STATE_LABELS: Readonly<Record<PeriodState, string>> = {
  upcoming: "Por venir",
  due: "Por pagar",
  overdue: "En mora",
  in_review: "Comprobante en revisión",
  rejected: "Comprobante rechazado",
  paid: "Pagado",
};

/**
 * A verdict belongs to the receipt it judged.
 *
 * The same rule the first canon already follows, and the same reason: a rejection whose receipt was
 * replaced is a rejection of something that no longer exists. Without this, uploading a corrected
 * receipt would leave "rechazado" on screen with nothing left to fix.
 *
 * Kept here rather than imported so this file stays readable on its own — it is one comparison, and
 * a test weakens it on purpose to prove it is doing something.
 */
export function verdictApplies(period: Pick<Period, "receipt" | "verdict"> | null): boolean {
  if (!period?.verdict || !period.receipt) return false;

  return Date.parse(period.verdict.at) >= Date.parse(period.receipt.uploadedAt);
}

export function periodState(
  month: Pick<ScheduledMonth, "dueDate">,
  stored: Pick<Period, "receipt" | "verdict"> | null,
  today: string,
): PeriodState {
  if (stored?.receipt) {
    if (!verdictApplies(stored)) return "in_review";

    return stored.verdict?.status === "confirmed" ? "paid" : "rejected";
  }

  if (today < month.dueDate) return "upcoming";

  return today > month.dueDate ? "overdue" : "due";
}

/** Whether this month still needs somebody to do something. */
export function isOpen(state: PeriodState): boolean {
  return state !== "paid" && state !== "upcoming";
}

// ---------------------------------------------------------------------------
// the whole of it
// ---------------------------------------------------------------------------

export type LeaseSummary = {
  /** Months in the term the tenancy is currently inside, counting from the first one. */
  readonly scheduled: number;
  readonly paid: number;
  readonly overdue: number;
  /** Uploaded and waiting on the landlord. */
  readonly inReview: number;
  /** Whole pesos confirmed as received, across the whole tenancy. */
  readonly totalPaid: number;
  /** Whole pesos on months that are past their due date and not paid. */
  readonly totalOverdue: number;
};

/**
 * The tenancy at a glance, **computed from the periods** rather than kept as counters.
 *
 * Six to twelve documents are one query, and a counter is a second source of truth: the day a
 * verdict is corrected by hand, or a write lands twice, the counter and the documents disagree and
 * there is no way to tell which one is lying.
 */
export function leaseSummary(
  schedule: readonly ScheduledMonth[],
  periods: readonly Period[],
  today: string,
): LeaseSummary {
  const byId = new Map(periods.map((period) => [period.id, period]));

  let paid = 0;
  let overdue = 0;
  let inReview = 0;
  let totalPaid = 0;
  let totalOverdue = 0;

  for (const month of schedule) {
    const stored = byId.get(month.id) ?? null;
    const state = periodState(month, stored, today);

    if (state === "paid") {
      paid += 1;
      // What was actually received, not what was owed: a short transfer the landlord confirmed
      // anyway is what the landlord says arrived.
      totalPaid += stored?.receipt?.amount ?? stored?.amount ?? month.amount;
    }
    if (state === "overdue" || state === "rejected") {
      overdue += 1;
      totalOverdue += stored?.amount ?? month.amount;
    }
    if (state === "in_review") inReview += 1;
  }

  return { scheduled: schedule.length, paid, overdue, inReview, totalPaid, totalOverdue };
}

// ---------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** `2026-09` → `septiembre de 2026`. */
export function periodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;

  return `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} de ${match[1]}`;
}

/** `2026-09` → `Septiembre de 2026`, for a heading. */
export function periodTitle(period: string): string {
  const label = periodLabel(period);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The anchor of one month inside the tenancy page.
 *
 * The same job `stageAnchor` does for a stage: it is what lands a notification about September on
 * September, instead of at the top of a page with twelve months on it.
 */
export function periodAnchor(period: string): string {
  return `mes-${period}`;
}
