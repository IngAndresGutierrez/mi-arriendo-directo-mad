import { z } from "zod";

/**
 * What the tenant declares about the transfer they made for one month.
 *
 * The same three facts the first canon asks for, and for the same reason: **nothing here reads a
 * bank**. The amount and the date are a claim, the file is the proof of the claim, and the landlord
 * is the only party who can say whether the money actually landed in their account.
 *
 * The month is not in this schema. It arrives as the period id and is checked against the
 * *schedule* in the action — a month the tenancy does not have is not a validation error about a
 * field, it is a request for a document that should not exist.
 */
export const canonReceiptSchema = z.object({
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
 * A period id, as it arrives from the client.
 *
 * `YYYY-MM` and nothing else: it becomes a **document id**, so a value with a slash in it would
 * address a different path than the one the caller thinks they are writing to. Checked here rather
 * than trusted, and checked again against the schedule in the action.
 */
export const periodIdSchema = z
  .string({ error: "Falta el mes" })
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Ese mes no es válido" });

/**
 * The landlord's answer to a month's receipt.
 *
 * A rejection **requires a reason**, and the tenant reads it: they have to upload another one, and
 * this sentence is the only thing that says what to fix. A confirmation needs none — the money
 * arrived, which is the whole message.
 */
export const canonVerdictSchema = z.discriminatedUnion("status", [
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
