/**
 * The first canon: the landlord says where to receive it, the tenant pays and proves it.
 *
 * **This product does not move money.** No account is debited here, no payment is processed and no
 * commission is taken — the transfer happens between the two of them, in their own banks. What this
 * stage does is the part that gets lost in a chat thread: *where* to pay, *how much*, and the proof
 * that it happened, kept where both can see it.
 *
 * That is deliberate and not a stopgap. Handling the money would make this a payment institution,
 * with the licence, the custody and the liability that implies, and none of it would make the rent
 * arrive any better than a transfer the two of them already know how to make.
 */

/** How the landlord wants to be paid. */
export const PAYOUT_METHODS = [
  "nequi",
  "daviplata",
  "breb",
  "bancolombia",
  "davivienda",
  "other_bank",
] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABELS: Readonly<Record<PayoutMethod, string>> = {
  nequi: "Nequi",
  daviplata: "Daviplata",
  breb: "Llave Bre-B",
  bancolombia: "Bancolombia",
  davivienda: "Davivienda",
  other_bank: "Otro banco",
};

/** Bank accounts come in two kinds and the number alone does not say which. */
export const ACCOUNT_TYPES = ["savings", "checking"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  savings: "Ahorros",
  checking: "Corriente",
};

/**
 * Which fields a method actually needs.
 *
 * The stored shape is **flat**, with an empty string where a field does not apply, rather than a
 * true union: Firestore rejects `undefined`, and a document whose keys change with the method is a
 * document every reader has to narrow before touching. The union lives in the Zod schema, which is
 * where the narrowing belongs, and this function is what the form and the summary agree on.
 */
export function payoutShape(method: PayoutMethod): {
  readonly phone: boolean;
  readonly key: boolean;
  readonly account: boolean;
  readonly bankName: boolean;
} {
  switch (method) {
    case "nequi":
    case "daviplata":
      return { phone: true, key: false, account: false, bankName: false };
    case "breb":
      return { phone: false, key: true, account: false, bankName: false };
    case "other_bank":
      return { phone: false, key: false, account: true, bankName: true };
    default:
      return { phone: false, key: false, account: true, bankName: false };
  }
}

/**
 * Where the first canon goes.
 *
 * The holder is a field of its own and not read from the profile: the account may be a spouse's, an
 * agency's or a company's, and a tenant who transfers to a name that does not match what the screen
 * said is a tenant who thinks they have been scammed.
 */
export type Payout = {
  readonly method: PayoutMethod;
  /** E.164, for Nequi and Daviplata. Empty otherwise. */
  readonly phone: string;
  /** A Bre-B key, in any of its five shapes. Empty otherwise. */
  readonly key: string;
  readonly accountType: AccountType | "";
  readonly accountNumber: string;
  /** Only for `other_bank`; the rest carry their name in the method. */
  readonly bankName: string;
  readonly holderName: string;
  /** Type and number, as the landlord wrote it. */
  readonly holderDocument: string;
  /** Anything the tenant needs to know. Both sides read it. */
  readonly note: string;
};

/** The receipt the tenant uploads: a screenshot or a PDF of the transfer. */
export const RECEIPT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

export type PaymentReceipt = {
  /** `payments/{applicationId}/…` — written by the server, never reachable by a client. */
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
  /** What the tenant says they transferred, in whole pesos. */
  readonly amount: number;
  /** ISO 8601 date, as the tenant states it. */
  readonly paidOn: string;
  readonly note: string;
};

/** The landlord's answer to the receipt. */
export type ReceiptVerdict = {
  readonly status: "confirmed" | "rejected";
  /** ISO 8601. */
  readonly at: string;
  /** Mandatory on a rejection: the tenant has to know what to fix. */
  readonly reason: string;
};

export type FirstPayment = {
  readonly payout: Payout | null;
  readonly receipt: PaymentReceipt | null;
  readonly verdict: ReceiptVerdict | null;
};

export const FIRST_PAYMENT_STATES = [
  "no_payout",
  "awaiting_receipt",
  "awaiting_confirmation",
  "rejected",
  "confirmed",
] as const;
export type FirstPaymentState = (typeof FIRST_PAYMENT_STATES)[number];

export const FIRST_PAYMENT_STATE_LABELS: Readonly<Record<FirstPaymentState, string>> = {
  no_payout: "Sin datos de pago",
  awaiting_receipt: "Esperando el pago",
  awaiting_confirmation: "Comprobante en revisión",
  rejected: "Comprobante rechazado",
  confirmed: "Canon recibido",
};

/**
 * A verdict belongs to the receipt it judged.
 *
 * The same idea as a signature bound to a document hash: a rejection whose receipt was replaced is
 * a rejection of something that no longer exists, so it stops counting on its own. Without this,
 * uploading a corrected receipt would leave the old "rechazado" on screen with nothing to fix.
 */
export function verdictApplies(payment: FirstPayment | null): boolean {
  if (!payment?.verdict || !payment.receipt) return false;

  return Date.parse(payment.verdict.at) >= Date.parse(payment.receipt.uploadedAt);
}

export function firstPaymentState(payment: FirstPayment | null): FirstPaymentState {
  if (!payment?.payout) return "no_payout";
  if (!payment.receipt) return "awaiting_receipt";
  if (!verdictApplies(payment)) return "awaiting_confirmation";

  return payment.verdict?.status === "confirmed" ? "confirmed" : "rejected";
}

/**
 * Why the process cannot close.
 *
 * Only the landlord confirming the money arrived lets it through, and that is the whole point of
 * the stage: a receipt is what the tenant can prove, and whether the money landed is something only
 * the person whose account it is can say.
 */
export type FirstPaymentBlocker =
  | "no_payout"
  | "awaiting_receipt"
  | "awaiting_confirmation"
  | "rejected"
  | null;

export function firstPaymentBlocker(payment: FirstPayment | null): FirstPaymentBlocker {
  const state = firstPaymentState(payment);

  return state === "confirmed" ? null : state;
}

export function firstPaymentBlockerMessage(
  blocker: FirstPaymentBlocker,
  isLandlord: boolean,
): string | null {
  switch (blocker) {
    case "no_payout":
      return isLandlord
        ? "Escribe por dónde quieres recibir el primer canon."
        : "El propietario va a indicar por dónde recibir el primer canon.";
    case "awaiting_receipt":
      return isLandlord
        ? "Falta que el inquilino pague y suba el comprobante."
        : "Paga el primer canon y sube el comprobante.";
    case "awaiting_confirmation":
      return isLandlord
        ? "Revisa el comprobante y confirma si el dinero llegó."
        : "El propietario está revisando tu comprobante.";
    case "rejected":
      return isLandlord
        ? "Rechazaste el comprobante. El inquilino tiene que subir otro."
        : "El propietario rechazó el comprobante. Revisa el motivo y sube otro.";
    default:
      return null;
  }
}

/**
 * Why a receipt file was refused, or `null` when it is fine.
 *
 * A screenshot is the normal case here, so images come first and a PDF is allowed because some
 * banks hand one. Pure so the browser can say it before spending the upload and the action can say
 * it again without trusting that it did.
 */
export function receiptFileProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!RECEIPT_CONTENT_TYPES.includes(file.type as (typeof RECEIPT_CONTENT_TYPES)[number])) {
    return "El comprobante tiene que ser una imagen (JPG, PNG o WEBP) o un PDF.";
  }
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > RECEIPT_MAX_BYTES) return "El archivo pesa más de 8 MB.";

  return null;
}

/**
 * The payout as one line, for the tenant to check against what their bank shows.
 *
 * Never used in a notification or a log: it carries an account number, and an email with somebody's
 * bank details in it is the shape of every payment scam there is. It renders on the page, behind
 * the session, and nowhere else.
 */
export function payoutSummary(payout: Payout): string {
  const shape = payoutShape(payout.method);
  const name = payout.method === "other_bank" ? payout.bankName : PAYOUT_METHOD_LABELS[payout.method];

  if (shape.phone) return `${name} · ${payout.phone}`;
  if (shape.key) return `${name} · ${payout.key}`;

  const kind = payout.accountType ? ACCOUNT_TYPE_LABELS[payout.accountType] : "";

  return [name, kind, payout.accountNumber].filter(Boolean).join(" · ");
}
