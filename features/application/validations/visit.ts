import { z } from "zod";

import { VISIT_OUTCOMES } from "../domain/visit";

export { BOGOTA_OFFSET, toInstant, validateSlot } from "./slot";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The landlord's proposal: a day, an hour and where to meet.
 *
 * **The meeting point is required**, and it is the one field this stage could not do without: a
 * visit is somebody travelling across a city, and "el jueves a las 3" with no address is an
 * appointment nobody can keep. Ten characters is the shortest thing that is actually a place —
 * "Cra 23 #14-08" is thirteen — and it stops a landlord from getting past this with "allá".
 */
export const proposeVisitSchema = z.object({
  day: z.string({ error: "Elige una fecha" }).regex(DAY, { error: "Elige una fecha" }),
  time: z.string({ error: "Elige una hora" }).regex(TIME, { error: "Elige una hora" }),
  meetingPoint: z
    .string({ error: "Escribe dónde se encuentran" })
    .trim()
    .min(10, { error: "Escribe la dirección o el punto de encuentro completo" })
    .max(300, { error: "El punto de encuentro es demasiado largo" }),
  note: z.string().trim().max(300, { error: "El mensaje es demasiado largo" }).default(""),
});

export type ProposeVisitInput = z.output<typeof proposeVisitSchema>;

/**
 * What the tenant made of the property.
 *
 * **The note is optional, unlike the interview's**, and the asymmetry is deliberate. The
 * interview's conclusion is written by the landlord about a conversation, and a verdict with no
 * words behind it tells the tenant nothing they can act on. This one is a person saying whether
 * they want to live somewhere, and demanding an essay before they may say "no me interesa" is a
 * toll on the answer this stage exists to collect — the one that stops the process. What the
 * placeholder asks for instead is the reason, because a landlord who is told why keeps the listing
 * honest.
 */
export const visitVerdictSchema = z.object({
  result: z.enum(VISIT_OUTCOMES, { error: "Dinos si te interesa el inmueble" }),
  note: z.string().trim().max(600, { error: "El texto es demasiado largo" }).default(""),
});

export const declineVisitSchema = z.object({
  note: z.string().trim().max(300, { error: "El mensaje es demasiado largo" }).default(""),
});
