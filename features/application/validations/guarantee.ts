import { z } from "zod";

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

export const guaranteeRequestSchema = z.object({
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
});
