import { z } from "zod";

/**
 * The word somebody has to type to delete their account.
 *
 * Every other delete in this product goes through `ConfirmDialog` and one click, which is right
 * for a listing: publish it again and you have lost a few minutes. This one destroys the account,
 * the dossier and every uploaded document, and there is no "again". A typed word is the cheapest
 * way to make the action deliberate rather than merely confirmed — and unlike a second dialog, it
 * cannot be dismissed by muscle memory.
 *
 * Uppercase and accent-free on purpose: it has to be typable on a phone keyboard without
 * hunting for a long-press, or the safeguard becomes the reason somebody gives up and writes to
 * support instead.
 */
export const ERASURE_CONFIRMATION = "ELIMINAR";

export const deleteAccountSchema = z.object({
  /**
   * Compared after trimming and upper-casing: "eliminar " is the same intention, and rejecting it
   * would be pedantry dressed up as safety. What it must not accept is an empty string or
   * something else entirely.
   */
  confirmation: z
    .string({ error: "Escribe ELIMINAR para confirmar" })
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => value === ERASURE_CONFIRMATION, {
      error: `Escribe ${ERASURE_CONFIRMATION} para confirmar`,
    }),
});

export type DeleteAccountInput = z.output<typeof deleteAccountSchema>;
export type DeleteAccountFormValues = z.input<typeof deleteAccountSchema>;
