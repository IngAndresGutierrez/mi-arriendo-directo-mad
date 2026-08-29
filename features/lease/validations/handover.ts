import { z } from "zod";

import {
  AREA_CONDITIONS,
  AREA_NAME_MAX,
  AREA_NOTE_MAX,
  HANDOVER_PHOTO_MAX_BYTES,
  HANDOVER_PHOTO_TYPES,
  MAX_AREA_PHOTOS,
  MAX_HANDOVER_AREAS,
  MAX_OBJECTION_PHOTOS,
  OBJECTION_NOTE_MAX,
  OBJECTION_NOTE_MIN,
} from "../domain/handover";

/**
 * One photo the browser reports after uploading it straight to Cloud Storage.
 *
 * **The checks that matter are not in this schema**, exactly as with an incident's attachment: the
 * path has to sit inside the caller's own folder and the object has to exist in the bucket with the
 * type and size claimed. A schema can only say the shape is plausible; `saveHandoverDraft` is where
 * the bucket is asked.
 */
export const handoverPhotoSchema = z.object({
  path: z.string({ error: "Falta la ruta de la foto" }).trim().min(1).max(400),
  fileName: z.string({ error: "Falta el nombre de la foto" }).trim().min(1).max(200),
  contentType: z.enum(HANDOVER_PHOTO_TYPES, { error: "El acta acepta fotos JPG, PNG o WebP." }),
  bytes: z.number().int().positive().max(HANDOVER_PHOTO_MAX_BYTES),
});

/**
 * One room of the acta.
 *
 * **The note is optional and the photos are not required either**, and both of those are deliberate.
 * A landlord who has to write a sentence about the balcony to move on writes "ok" about the balcony,
 * and a form that demanded a photo of every room would be a form filled in from memory a week later.
 * What is required is the **name and the condition** — the two things a checkout can be compared
 * against six months on.
 */
export const handoverAreaSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z
    .string({ error: "Ponle nombre al espacio" })
    .trim()
    .min(1, "Ponle nombre al espacio")
    .max(AREA_NAME_MAX, `Máximo ${AREA_NAME_MAX} caracteres.`),
  condition: z.enum(AREA_CONDITIONS, { error: "Di en qué estado está." }),
  note: z.string().trim().max(AREA_NOTE_MAX, `Máximo ${AREA_NOTE_MAX} caracteres.`).default(""),
  photos: z
    .array(handoverPhotoSchema)
    .max(MAX_AREA_PHOTOS, `Hasta ${MAX_AREA_PHOTOS} fotos por espacio.`)
    .default([]),
});

/**
 * The acta as the landlord saves it.
 *
 * **At least one area**, because an acta with no rooms in it is not a draft of anything — and the
 * screen has nothing to render, so an empty save would look like a save that failed.
 */
export const handoverDraftSchema = z.object({
  areas: z
    .array(handoverAreaSchema)
    .min(1, "Agrega al menos un espacio al acta.")
    .max(MAX_HANDOVER_AREAS, `Hasta ${MAX_HANDOVER_AREAS} espacios.`),
});

export type HandoverDraftInput = z.output<typeof handoverDraftSchema>;

/**
 * What the tenant writes when the acta does not match what they see.
 *
 * **The note is required and the photos are not.** An objection with no words is a "no" the landlord
 * cannot act on — the same rule a rejected document already follows, where the reason is mandatory
 * because the tenant has to know what to fix. Here it is the other direction and the reason is the
 * same. The photos are optional because a tenant standing in a dark bathroom with no signal should
 * be able to say the grille was already broken now and show it later.
 */
export const handoverObjectionSchema = z.object({
  note: z
    .string({ error: "Escribe qué no coincide" })
    .trim()
    .min(OBJECTION_NOTE_MIN, "Cuenta qué no coincide con lo que ves.")
    .max(OBJECTION_NOTE_MAX, `Máximo ${OBJECTION_NOTE_MAX} caracteres.`),
  photos: z
    .array(handoverPhotoSchema)
    .max(MAX_OBJECTION_PHOTOS, `Hasta ${MAX_OBJECTION_PHOTOS} fotos.`)
    .default([]),
});

export type HandoverObjectionInput = z.output<typeof handoverObjectionSchema>;
