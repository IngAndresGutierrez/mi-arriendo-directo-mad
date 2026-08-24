import { z } from "zod";

import { INTERVIEW_CHANNELS, INTERVIEW_RESULTS, channelNeedsLink } from "../domain/interview";

/*
 * The day, the hour and the "is it in the future" check are shared with the visit to the property:
 * two stages arrange a time somebody has to turn up to, and two copies of that rule are two things
 * that can drift. Re-exported here so this module's own callers do not have to know that.
 */
export { BOGOTA_OFFSET, toInstant, validateSlot } from "./slot";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const proposeInterviewSchema = z
  .object({
    day: z.string({ error: "Elige una fecha" }).regex(DAY, { error: "Elige una fecha" }),
    time: z.string({ error: "Elige una hora" }).regex(TIME, { error: "Elige una hora" }),
    channel: z.enum(INTERVIEW_CHANNELS, { error: "Elige por dónde será" }),
    link: z.string().trim().max(300, { error: "El enlace es demasiado largo" }).default(""),
    note: z.string().trim().max(300, { error: "El mensaje es demasiado largo" }).default(""),
  })
  .superRefine((value, ctx) => {
    // Cross-field: only a Meet has something to paste, and a Meet without it is an invitation
    // to a room nobody can open.
    if (!channelNeedsLink(value.channel)) return;

    if (!value.link) {
      ctx.addIssue({ code: "custom", message: "Pega el enlace de la reunión", path: ["link"] });
      return;
    }
    let url: URL;
    try {
      url = new URL(value.link);
    } catch {
      ctx.addIssue({ code: "custom", message: "Ese enlace no es válido", path: ["link"] });
      return;
    }
    if (url.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "El enlace tiene que ser https", path: ["link"] });
    }
  });

export type ProposeInterviewInput = z.output<typeof proposeInterviewSchema>;

export const interviewFeedbackSchema = z.object({
  result: z.enum(INTERVIEW_RESULTS, { error: "Elige cómo te fue" }),
  note: z
    .string({ error: "Escribe cómo fue la entrevista" })
    .trim()
    .min(10, { error: "Cuenta en una frase cómo fue: el inquilino también lo lee" })
    .max(600, { error: "El texto es demasiado largo" }),
});

export const declineInterviewSchema = z.object({
  note: z.string().trim().max(300, { error: "El mensaje es demasiado largo" }).default(""),
});
