import { z } from "zod";

import { CONTRACT_PARTIES, OTP_LENGTH, SIGNATURE_CHANNELS, SIGNATURE_CLAUSE_VERSION, spotProblem } from "../domain/contract";

/**
 * The note that travels with the contract.
 *
 * Optional and short: the document is the record, and anything needing three hundred characters
 * belongs in the contract itself, not in a comment beside it.
 */
export const contractNoteSchema = z.object({
  note: z.string().trim().max(300, { error: "La nota es demasiado larga" }).default(""),
});

/**
 * Asking for the code that will act as a signature.
 *
 * The clause is accepted **here**, at the moment the code is requested, and not when it is
 * entered: Decreto 2364's presumption rests on the method having been agreed, so the agreement has
 * to come before the mechanism runs, not alongside the result.
 *
 * `z.literal(true)` is deliberately avoided — its input type is `true`, and a checkbox starts at
 * `false`, so the form would never typecheck against it.
 */
export const signatureRequestSchema = z.object({
  channel: z.enum(SIGNATURE_CHANNELS, { error: "Elige por dónde quieres recibir el código" }),
  acceptedClause: z
    .boolean()
    .refine((value) => value === true, { error: "Tienes que aceptar firmar por medios electrónicos" }),
  /**
   * Which wording was accepted. Sent by the client and **checked against the server's own
   * constant**, so a stale page cannot record consent to a clause that no longer exists.
   */
  clauseVersion: z
    .number()
    .int()
    .refine((value) => value === SIGNATURE_CLAUSE_VERSION, {
      error: "La página está desactualizada. Recárgala para firmar.",
    }),
});

/**
 * The drawn signature, as a PNG data URL.
 *
 * This schema checks the **shape** and nothing else, and it still accepts the empty string — that
 * is deliberate. Whether a stroke is *required* depends on the contract (a PDF, with a box marked
 * for this party) and a schema does not have the contract in front of it: `strokeRequired` answers
 * that, and `confirmSignature` enforces it. Encoding the requirement here would have made a legacy
 * image contract unsignable.
 *
 * The cap is generous for a signature and small for an image — a 200 KB canvas is somebody sending
 * something that is not a signature.
 */
export const signatureStrokeSchema = z
  .string()
  .trim()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { error: "El trazo no es válido" })
  .max(200_000, { error: "El trazo es demasiado grande" })
  .optional()
  .or(z.literal(""));

/**
 * Entering the code.
 *
 * Digits only and exactly the expected length: anything else is not a code this product issued, and
 * rejecting it here means it never reaches the comparison — one fewer attempt burned on a typo, and
 * one fewer shape of input the hashing path has to survive.
 */
export const signatureConfirmSchema = z.object({
  code: z
    .string({ error: "Escribe el código" })
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
      error: `El código son ${OTP_LENGTH} dígitos`,
    }),
  /**
   * El trazo dibujado, en el mismo envío que el código: se firma una vez, así que es una sola
   * petición. Antes llegaba por fuera del esquema y la acción lo volvía a parsear con un `as`; que
   * viaje aquí es lo que hace que un trazo con mala forma se rechace **antes** de comparar el
   * código, sin gastar uno de los cinco intentos en algo que no es el código.
   */
  stroke: signatureStrokeSchema,
});

/**
 * Where each party signs, as the landlord marked it on the preview.
 *
 * The geometry is checked by `spotProblem`, the same pure function the viewer uses before letting
 * the landlord save — so the sentence they read is the one the server would have said. Exactly one
 * spot per party: two boxes for the same signature is a drawing stamped twice, and a missing one is
 * a party with nowhere to sign.
 */
export const signatureSpotsSchema = z.object({
  spots: z
    .array(
      z.object({
        party: z.enum(CONTRACT_PARTIES, { error: "La parte no es válida" }),
        page: z.number(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .refine((spots) => spots.length === CONTRACT_PARTIES.length, {
      error: "Marca dónde firma cada una de las dos partes",
    })
    .refine((spots) => new Set(spots.map((spot) => spot.party)).size === spots.length, {
      error: "Hay dos recuadros para la misma parte",
    })
    .superRefine((spots, context) => {
      for (const spot of spots) {
        const problem = spotProblem(spot);
        if (problem) context.addIssue({ code: "custom", message: problem });
      }
    }),
});
