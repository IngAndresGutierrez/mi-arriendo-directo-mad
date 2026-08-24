import { z } from "zod";

import { ACCOUNT_TYPES, PAYOUT_METHODS } from "../domain/payout";

/**
 * Who receives the money. Asked for every method, because the account may not be the landlord's.
 *
 * A tenant who transfers to a name that does not match what the screen said is a tenant who thinks
 * they have been scammed — so the name is required, and it is theirs to check against their bank.
 */
const holder = {
  holderName: z
    .string({ error: "Escribe a nombre de quién está la cuenta" })
    .trim()
    .min(3, { error: "El nombre es demasiado corto" })
    .max(120, { error: "El nombre es demasiado largo" }),
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
};

/**
 * The holder's identity document, **only on the branches that are a bank transfer**.
 *
 * Registering an account in a Colombian bank asks for it; paying a Nequi or Daviplata number does
 * not, and neither does a Bre-B key — the app shows the recipient's name and the directory resolves
 * the rest. Asking for it there would collect an identity number nothing on the other side uses,
 * and the cheapest way not to leak a piece of personal data is not to hold it. `payoutShape` says
 * the same thing to the form, so the field is not even rendered.
 */
const holderDocument = z
  .string({ error: "Escribe el documento del titular" })
  .trim()
  .min(5, { error: "El documento es demasiado corto" })
  .max(60, { error: "El documento es demasiado largo" });

/**
 * A Colombian mobile, for Nequi and Daviplata.
 *
 * Both are tied to a phone line, and both are Colombian only, so this is the one field in this form
 * that can be checked strictly: ten digits starting with 3. Written without the country code
 * because that is how somebody reads it off their own app.
 */
const mobile = z
  .string({ error: "Escribe el número" })
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine((value) => /^3\d{9}$/.test(value), {
    error: "Es un celular colombiano de 10 dígitos que empieza por 3",
  });

/**
 * A Bre-B key, validated **loosely and on purpose**.
 *
 * A key is one of five shapes — an `@alias`, a phone, an email, a document number, or a merchant
 * code — and the only real check is against the directory the banks share, which this product does
 * not query. A regex per shape would reject valid keys the day an issuer formats one differently,
 * and rejecting a key that works is worse than accepting one that does not: the transfer simply
 * fails in their own bank, where it is visible.
 *
 * The same reasoning the registry number in a listing already follows.
 */
const brebKey = z
  .string({ error: "Escribe tu llave" })
  .trim()
  .min(3, { error: "La llave es demasiado corta" })
  .max(60, { error: "La llave es demasiado larga" })
  .refine((value) => !/\s/.test(value), { error: "Una llave no tiene espacios" });

const account = {
  accountType: z.enum(ACCOUNT_TYPES, { error: "Elige si es de ahorros o corriente" }),
  accountNumber: z
    .string({ error: "Escribe el número de la cuenta" })
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .refine((value) => /^\d{5,20}$/.test(value), {
      error: "El número de la cuenta son entre 5 y 20 dígitos",
    }),
};

/**
 * Where the first canon goes.
 *
 * A **discriminated union**, so a method can only arrive with the fields it actually uses: a flat
 * schema with everything optional would accept a Nequi payout carrying an account number, and then
 * the summary would have to decide which of the two to believe.
 *
 * What is stored is flat, with an empty string where a field does not apply — Firestore rejects
 * `undefined` — and `payoutShape` is what the form and the summary agree on. The narrowing lives
 * here, which is the only place that sees the outside world.
 */
export const payoutSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("nequi"), phone: mobile, ...holder }),
  z.object({ method: z.literal("daviplata"), phone: mobile, ...holder }),
  z.object({ method: z.literal("breb"), key: brebKey, ...holder }),
  z.object({ method: z.literal("bancolombia"), ...account, ...holder, holderDocument }),
  z.object({ method: z.literal("davivienda"), ...account, ...holder, holderDocument }),
  z.object({
    method: z.literal("other_bank"),
    bankName: z
      .string({ error: "Escribe el nombre del banco" })
      .trim()
      .min(3, { error: "El nombre del banco es demasiado corto" })
      .max(60, { error: "El nombre del banco es demasiado largo" }),
    ...account,
    ...holder,
    holderDocument,
  }),
]);

export type PayoutInput = z.output<typeof payoutSchema>;

/** Every method this product offers has a branch. A new one fails to typecheck without it. */
export const PAYOUT_SCHEMA_METHODS: readonly string[] = PAYOUT_METHODS;

/**
 * What the tenant states about the transfer they made.
 *
 * The amount and the date are **what the tenant declares**, not what this product verified: nothing
 * here reads a bank. That is exactly why the landlord confirms afterwards — and why the receipt is
 * kept, so the claim and the proof sit together.
 */
export const receiptSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((value) => Number(String(value).replace(/[^\d]/g, "")))
    .refine((value) => Number.isInteger(value) && value > 0, {
      error: "Escribe cuánto transferiste",
    })
    .refine((value) => value <= 100_000_000, { error: "Ese monto es demasiado alto" }),
  /** `<input type="date">` gives `YYYY-MM-DD` and nothing else. */
  paidOn: z
    .string({ error: "Escribe la fecha del pago" })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "La fecha no es válida" }),
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
});

/**
 * The landlord's answer.
 *
 * A rejection **requires a reason**: the tenant has to upload another receipt and the only thing
 * that tells them what to fix is this sentence. A confirmation needs none — the money arrived.
 */
export const receiptVerdictSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmed") }),
  z.object({
    status: z.literal("rejected"),
    reason: z
      .string({ error: "Escribe por qué lo rechazas" })
      .trim()
      .min(10, { error: "Explica en una frase qué tiene que corregir" })
      .max(300, { error: "El motivo es demasiado largo" }),
  }),
]);
