import { z } from "zod";

import {
  attachmentLimit,
  INCIDENT_CONTENT_TYPES,
  INCIDENT_STATES,
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_DESCRIPTION_MIN,
  INCIDENT_TITLE_MAX,
  INCIDENT_TITLE_MIN,
  INCIDENT_VIDEO_MAX_BYTES,
  MAX_INCIDENT_ATTACHMENTS,
} from "../domain/incident";

/**
 * One file the browser reports after uploading it straight to Cloud Storage.
 *
 * **All of it is re-checked on the server**, and the check that matters is not in this schema: the
 * path has to sit inside the caller's own folder, and the object has to actually exist in the bucket
 * with the type and size claimed here. See `reportIncident` — a schema can only say that the shape is
 * plausible.
 */
export const incidentAttachmentSchema = z
  .object({
    path: z.string({ error: "Falta la ruta del archivo" }).trim().min(1).max(400),
    fileName: z.string({ error: "Falta el nombre del archivo" }).trim().min(1).max(200),
    contentType: z.enum(INCIDENT_CONTENT_TYPES, {
      error: "Solo puedes adjuntar fotos o videos.",
    }),
    /** The loose bound is the video one; the per-type cap is applied below. */
    bytes: z.number().int().positive().max(INCIDENT_VIDEO_MAX_BYTES),
  })
  .superRefine((attachment, ctx) => {
    /*
     * The cap depends on the type, so it cannot be a `.max()` on the field: a 40 MB image and a 40 MB
     * video are the same number and two different answers. Checked here against the same function the
     * picker uses, so the message the tenant already saw in the browser is the rule the server holds.
     */
    if (attachment.bytes > attachmentLimit(attachment.contentType)) {
      ctx.addIssue({
        code: "custom",
        path: ["bytes"],
        message: "Ese archivo pesa más de lo permitido para su tipo.",
      });
    }
  });

/**
 * What the tenant fills in to report an incident.
 *
 * The title is what the landlord reads in a list of them, so it has to be a sentence and not "ok";
 * the description is what tells them what to send somebody to fix. Neither minimum is arbitrary —
 * but neither is large either, because **"Se rompió el sifón del lavaplatos" is a complete report**
 * and a form that demanded a paragraph would be a form that gets a paragraph of filler.
 *
 * The attachments are optional. A tenant standing in a dark bathroom with no signal should be able
 * to say what happened now and show it later; requiring a photo would make the report wait for the
 * photo.
 */
export const incidentReportSchema = z.object({
  title: z
    .string({ error: "Escribe un título" })
    .trim()
    .min(INCIDENT_TITLE_MIN, { error: "El título es demasiado corto" })
    .max(INCIDENT_TITLE_MAX, { error: "El título es demasiado largo" }),
  description: z
    .string({ error: "Cuenta qué pasó" })
    .trim()
    .min(INCIDENT_DESCRIPTION_MIN, { error: "Cuenta un poco más de qué pasó" })
    .max(INCIDENT_DESCRIPTION_MAX, { error: "La descripción es demasiado larga" }),
  attachments: z
    .array(incidentAttachmentSchema)
    .max(MAX_INCIDENT_ATTACHMENTS, {
      error: `Puedes adjuntar hasta ${MAX_INCIDENT_ATTACHMENTS} archivos`,
    })
    .default([]),
});

export type IncidentReportInput = z.output<typeof incidentReportSchema>;

/**
 * What either party sends to move an incident along, or just to say something about it.
 *
 * **The transition is not validated here**, and that is not an omission: whether this party may move
 * *this* incident to *that* state depends on where it is now, which lives in the stored thread. A
 * schema can only say the value is one of the five. `updateIncident` derives the current state from
 * the document and asks `canTransition` — so a client that posts a state it is not entitled to is
 * refused against the record, not against the shape.
 *
 * A note or a state change: an update that is neither is a row in the thread that says nothing, and
 * the form should not be able to produce one. Checked here rather than in the action because it *is*
 * a property of the shape — there is nothing to look up.
 */
export const incidentUpdateSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(1000, { error: "El mensaje es demasiado largo" })
      .default(""),
    attachments: z
      .array(incidentAttachmentSchema)
      .max(MAX_INCIDENT_ATTACHMENTS, {
        error: `Puedes adjuntar hasta ${MAX_INCIDENT_ATTACHMENTS} archivos`,
      })
      .default([]),
    /** `null` for a plain message. */
    movedTo: z.enum(INCIDENT_STATES).nullable().default(null),
  })
  .refine(
    (update) => update.movedTo !== null || update.note.length > 0 || update.attachments.length > 0,
    { error: "Escribe un mensaje o adjunta algo." },
  );

export type IncidentUpdateInput = z.output<typeof incidentUpdateSchema>;
