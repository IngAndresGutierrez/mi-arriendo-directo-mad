import { z } from "zod";

import {
  MAX_VERIFICATION_DOCUMENTS,
  VERIFICATION_DOCUMENT_MAX_BYTES,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_NOTE_MAX,
} from "../domain/verification";

/**
 * One file the browser reports after uploading it straight to Cloud Storage.
 *
 * **The checks that matter are not here**, as with every other upload in this product: the path has
 * to sit inside the caller's own folder and the object has to exist in the bucket with the type and
 * size it claims. `requestVerification` is where the bucket is asked; a schema can only say the
 * shape is plausible.
 */
export const verificationDocumentSchema = z.object({
  path: z.string({ error: "Falta la ruta del archivo" }).trim().min(1).max(400),
  fileName: z.string({ error: "Falta el nombre del archivo" }).trim().min(1).max(200),
  contentType: z.enum(VERIFICATION_DOCUMENT_TYPES, {
    error: "Adjunta el certificado en PDF, o una foto en JPG, PNG o WebP.",
  }),
  bytes: z.number().int().positive().max(VERIFICATION_DOCUMENT_MAX_BYTES),
});

/**
 * What the landlord sends to have their ownership checked.
 *
 * **At least one document, and that is the whole request.** There is nothing to type: the matrícula
 * is already on the listing and the reviewer reads the certificate against it. A form asking the
 * landlord to restate the number would be asking them to supply the thing being checked.
 */
export const verificationRequestSchema = z.object({
  documents: z
    .array(verificationDocumentSchema)
    .min(1, "Adjunta el certificado de tradición y libertad.")
    .max(MAX_VERIFICATION_DOCUMENTS, `Hasta ${MAX_VERIFICATION_DOCUMENTS} archivos.`),
});

export type VerificationRequestInput = z.output<typeof verificationRequestSchema>;

/**
 * The reviewer's verdict.
 *
 * **The reason is required on a refusal and refused on an approval.** A refusal the landlord cannot
 * act on is a wall — "el certificado tiene cuatro meses" and "el certificado nombra a otra persona"
 * are two completely different things to do next — and this is the same rule a rejected document in
 * the process already follows. On an approval there is nothing to explain, and a free-text note
 * nobody reads is a place for something careless to end up on a record two parties keep.
 */
export const verificationVerdictSchema = z
  .object({
    approve: z.boolean(),
    note: z.string().trim().max(VERIFICATION_NOTE_MAX, `Máximo ${VERIFICATION_NOTE_MAX} caracteres.`).default(""),
  })
  .superRefine((verdict, ctx) => {
    if (!verdict.approve && verdict.note.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Explica por qué no se pudo verificar: el propietario lo lee y actúa sobre eso.",
      });
    }
  });

export type VerificationVerdictInput = z.output<typeof verificationVerdictSchema>;
