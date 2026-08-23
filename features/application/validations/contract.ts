import { z } from "zod";

/**
 * The note that travels with the signed contract.
 *
 * Optional and short: the document is the record, and anything long enough to need three hundred
 * characters belongs in the contract itself, not in a comment beside it.
 */
export const contractNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .max(300, { error: "La nota es demasiado larga" })
    .default(""),
});
