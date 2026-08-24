import { z } from "zod";

import { GUARANTEE_PROVIDER, isProviderLink } from "../domain/guarantee";

/**
 * The policy number, validated loosely on purpose.
 *
 * It is Sura's format, not ours, and insurers change theirs without telling anybody. What is
 * checked is that it looks like an identifier a person copied from a document — some length, no
 * newlines — and not that it matches a pattern this repository invented and would have to keep in
 * step with somebody else's back office.
 */
export const guaranteePolicySchema = z.object({
  policyNumber: z
    .string({ error: "Escribe el número de la póliza" })
    .trim()
    .min(4, { error: "El número de la póliza es demasiado corto" })
    .max(40, { error: "El número de la póliza es demasiado largo" })
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]*[A-Za-z0-9]$/, {
      error: "Usa solo letras, números y los separadores del documento",
    }),
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
});

/**
 * The link Sura hands back for the tenant to continue with.
 *
 * Optional, because the landlord may mark the policy as applied for before the quoter has
 * produced it. What is not optional is where it points: the tenant clicks this from a page about
 * their own rental, so the host is verified (`isProviderLink`) rather than the string merely
 * checked for a shape. `.max` is generous — the quote identifier is long and percent-encoded.
 */
const tenantLinkField = z
  .string()
  .trim()
  .max(600, { error: "El enlace es demasiado largo" })
  .refine((value) => value === "" || isProviderLink(value), {
    error: `El enlace tiene que ser de ${GUARANTEE_PROVIDER.name} y empezar por https://`,
  })
  .default("");

export const guaranteeRequestSchema = z.object({
  tenantLink: tenantLinkField,
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
});

/**
 * The link and the note, saved together and on their own.
 *
 * One schema instead of two because the panel no longer has a button for either: the field saves
 * itself when it changes. That removes the "empty submit" worry a button had — there is no submit
 * — but it adds a different one, so at least one of the two must carry something. An auto-save
 * that fires on an empty form would write a `requestedAt` for a landlord who only clicked into a
 * field and left.
 */
export const guaranteeProgressSchema = z
  .object({
    tenantLink: tenantLinkField,
    note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
  })
  .refine((value) => value.tenantLink !== "" || value.note !== "", {
    error: "No hay nada que guardar",
  });

/**
 * The landlord's answer to "does this rental need a policy?".
 *
 * One boolean, because it is a switch and a switch has two positions. It arrives from a control the
 * landlord flips, so there is no note beside it: what a landlord wants to say about *why* goes in the
 * note field the panel already has, and asking for a reason to decline something the law never
 * required would be this product editorialising about their decision.
 */
export const guaranteeWaiverSchema = z.object({
  waived: z.boolean({ error: "No pudimos leer la opción del seguro" }),
});
