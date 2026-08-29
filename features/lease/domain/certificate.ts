/**
 * The two documents a tenancy produces on its own: the rent receipt and the paz y salvo.
 *
 * Neither is uploaded and neither is signed. Both are **derived entirely from what the landlord has
 * already confirmed**, which is the decision the whole feature turns on.
 *
 * ## Why the tenant can issue them
 *
 * A paz y salvo is normally a document the creditor hands over, which means it is also a document
 * the creditor can **withhold** — and a tenant with nothing to show the next landlord has no
 * defence against that. Here every month's "confirmado" is the landlord's own recorded act, so the
 * certificate does not assert anything new: it restates what they already said, and it can say it
 * to whoever asks.
 *
 * That is why the wording matters more than usual and is fixed in `certificate-pdf.ts` rather than
 * left to a template. It never says *el propietario certifica*; it says **según el registro de esta
 * plataforma, el propietario confirmó haber recibido** — which is true, checkable against the
 * screen both parties read, and not a claim this product is in a position to make on anybody's
 * behalf.
 *
 * ## The receipt is an obligation, not a convenience
 *
 * Ley 820 de 2003 puts it on the landlord to give the tenant a written receipt showing the date,
 * the amount and the period the payment covers. In practice it is a WhatsApp "listo, recibido" and
 * nothing that survives a disagreement. **The article number deserves a lawyer's eye before it is
 * quoted on the page itself**, which is why the PDF states the substance and cites nothing.
 *
 * ## What is deliberately not on either of them
 *
 * **The payout account.** Same rule the notifications already follow: a document that circulates
 * with somebody's account number in it is the shape of every payment scam there is. What the
 * receipt proves is that the money arrived, not where it was sent.
 *
 * **The street.** The lease knows the property's title and city and nothing finer — the address
 * lives in `properties/{id}/private/location`, which `features/lease` cannot read. The constraint
 * turns out to be the right answer anyway: a paz y salvo is shown to a stranger.
 */
import { periodLabel, periodState, type Period, type ScheduledMonth } from "./lease";

/**
 * A reference, and **not a fiscal consecutive**.
 *
 * Deliberately not called "número": a numbered receipt implies DIAN numbering, which is a different
 * regime with its own authorisation and its own consequences for getting it wrong. What this is for
 * is filing — so it has to be stable, readable over the phone, and derivable without a counter
 * anybody has to maintain.
 *
 * Derived, so the same month always produces the same reference and there is no document to write
 * when one is generated twice.
 */
export function certificateReference(
  kind: "receipt" | "clearance",
  leaseId: string,
  suffix: string,
): string {
  const prefix = kind === "receipt" ? "REC" : "PYS";
  /*
   * The **last** six, uppercase and stripped: it gets read out loud and typed into somebody's
   * spreadsheet. Taken from the end because a readable id is prefixed — `lease-cert-…`, and every
   * tenancy in a test run would share the first six characters. A Firestore auto-id is random at
   * both ends, so nothing is lost where it matters.
   */
  const short = leaseId.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();

  return `${prefix}-${short}-${suffix.replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// the rent receipt
// ---------------------------------------------------------------------------

/** Why this month has no receipt. */
export type ReceiptBlocker = "not_confirmed";

/**
 * Whether a month can produce a receipt.
 *
 * **Only a confirmed one**, and that is the whole rule: a receipt for a month the landlord has not
 * said they received is a document asserting something nobody asserted. `in_review` is the case
 * worth naming — the tenant has uploaded a transfer and it looks paid from their side, but what a
 * receipt certifies is that the money *arrived*, and only the person whose account it is can say
 * that. It is the same asymmetry the whole payment flow already runs on.
 */
export function receiptBlocker(
  month: Pick<ScheduledMonth, "dueDate">,
  stored: Pick<Period, "receipt" | "verdict"> | null,
  today: string,
): ReceiptBlocker | null {
  return periodState(month, stored, today) === "paid" ? null : "not_confirmed";
}

/** Everything the receipt PDF prints, resolved. */
export type RentReceipt = {
  readonly reference: string;
  /** ISO 8601 — when this copy was generated, which is not when the money arrived. */
  readonly issuedAt: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordName: string;
  readonly tenantName: string;
  /** `2026-09`, and the same in words. */
  readonly period: string;
  readonly periodLabel: string;
  /** Whole pesos, **as the landlord confirmed them**, not as the schedule expected them. */
  readonly amount: number;
  /** ISO 8601 date, as the tenant declared it. */
  readonly paidOn: string;
  /** ISO 8601 — when the landlord said it arrived. */
  readonly confirmedAt: string;
};

export function rentReceipt(input: {
  readonly leaseId: string;
  readonly month: ScheduledMonth;
  readonly stored: Period;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordName: string;
  readonly tenantName: string;
  readonly issuedAt: string;
}): RentReceipt {
  const { stored, month } = input;

  return {
    reference: certificateReference("receipt", input.leaseId, month.id),
    issuedAt: input.issuedAt,
    propertyTitle: input.propertyTitle,
    propertyCity: input.propertyCity,
    landlordName: input.landlordName,
    tenantName: input.tenantName,
    period: month.id,
    periodLabel: periodLabel(month.id),
    /*
     * What the landlord confirmed receiving, falling back to what the month asked for. The receipt
     * of a short transfer the landlord accepted anyway has to say the figure that actually arrived
     * — `leaseSummary` makes the same choice over the same field, and for the same reason.
     */
    amount: stored.receipt?.amount ?? stored.amount ?? month.amount,
    paidOn: stored.receipt?.paidOn ?? "",
    confirmedAt: stored.verdict?.at ?? "",
  };
}

// ---------------------------------------------------------------------------
// the paz y salvo
// ---------------------------------------------------------------------------

/** Why the tenancy is not up to date. */
export type ClearanceBlocker = "overdue" | "in_review" | "nothing_confirmed";

/** One month the paz y salvo covers. */
export type ClearedMonth = {
  readonly period: string;
  readonly periodLabel: string;
  readonly amount: number;
  readonly confirmedAt: string;
};

/**
 * Why a paz y salvo cannot be issued right now, or `null`.
 *
 * Three answers rather than a boolean, because they are acted on differently: an overdue month is
 * money to transfer, a month in review is a landlord to chase, and a tenancy with nothing confirmed
 * yet has nothing to certify. A single "no se puede" would be the "Continuar" that does not
 * continue, one screen over.
 *
 * **A month that is not due yet does not block it.** A paz y salvo says *al día a la fecha*, never
 * *el contrato terminó* — the tenancy renews under Ley 820 whether or not anybody wanted it to, so
 * a document claiming the second would be asserting something the law says is false. `leaseTermState`
 * makes the same refusal one level up.
 *
 * **A month in review does**, and it is the one worth stating: from the tenant's side the transfer
 * is made and the screen says so, but what a paz y salvo certifies is that the money *arrived*, and
 * only the person whose account it is can say that.
 */
export function clearanceBlocker(
  entries: readonly {
    readonly month: Pick<ScheduledMonth, "dueDate">;
    readonly stored: Pick<Period, "receipt" | "verdict"> | null;
  }[],
  today: string,
): ClearanceBlocker | null {
  const states = entries.map((entry) => periodState(entry.month, entry.stored, today));

  if (states.some((state) => state === "overdue" || state === "rejected")) return "overdue";
  if (states.some((state) => state === "in_review")) return "in_review";
  if (!states.includes("paid")) return "nothing_confirmed";

  return null;
}

/** Everything the paz y salvo prints, resolved. */
export type Clearance = {
  readonly reference: string;
  readonly issuedAt: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordName: string;
  readonly tenantName: string;
  /** The months confirmed as received, oldest first. */
  readonly months: readonly ClearedMonth[];
  /** The last month it covers, in words. What somebody reads off it in one glance. */
  readonly through: string;
  readonly totalPaid: number;
};

export function clearance(input: {
  readonly leaseId: string;
  readonly entries: readonly {
    readonly month: ScheduledMonth;
    readonly stored: Period | null;
  }[];
  readonly today: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordName: string;
  readonly tenantName: string;
  readonly issuedAt: string;
}): Clearance {
  const months: ClearedMonth[] = [];

  for (const entry of input.entries) {
    if (periodState(entry.month, entry.stored, input.today) !== "paid") continue;

    months.push({
      period: entry.month.id,
      periodLabel: periodLabel(entry.month.id),
      amount: entry.stored?.receipt?.amount ?? entry.stored?.amount ?? entry.month.amount,
      confirmedAt: entry.stored?.verdict?.at ?? "",
    });
  }

  return {
    /*
     * The issue date is part of the reference, and it has to be: a paz y salvo is true *on a date*
     * and two of them issued a month apart are different documents. A reference that ignored the
     * date would put the same identifier on both.
     */
    reference: certificateReference("clearance", input.leaseId, input.today),
    issuedAt: input.issuedAt,
    propertyTitle: input.propertyTitle,
    propertyCity: input.propertyCity,
    landlordName: input.landlordName,
    tenantName: input.tenantName,
    months,
    through: months.at(-1)?.periodLabel ?? "",
    totalPaid: months.reduce((total, month) => total + month.amount, 0),
  };
}
