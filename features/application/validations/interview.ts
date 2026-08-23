import { z } from "zod";

import { INTERVIEW_CHANNELS, INTERVIEW_RESULTS, channelNeedsLink } from "../domain/interview";

/**
 * Colombia does not observe daylight saving, so a wall time there is always UTC-5.
 *
 * That is what makes it safe to build the instant from the two fields the form shows: with a
 * fixed offset "el 10 de septiembre a las 3:00 p. m." means one instant and only one, whatever
 * clock the server or the browser happens to be on.
 */
export const BOGOTA_OFFSET = "-05:00";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `2026-09-10` + `15:00` → the instant that is 3 p.m. in Bogotá. */
export function toInstant(day: string, time: string): Date {
  return new Date(`${day}T${time}:00${BOGOTA_OFFSET}`);
}

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

/**
 * Is the proposed time still in the future?
 *
 * Checked against an explicit reference so the rule stays pure and the server can re-check it
 * against its own clock: a browser's is whatever the person set it to.
 */
export function validateInterviewSlot(
  instant: Date,
  reference: Date,
): { ok: true } | { ok: false; error: string } {
  if (Number.isNaN(instant.getTime())) return { ok: false, error: "Elige una fecha y una hora válidas" };
  if (instant.getTime() <= reference.getTime()) {
    return { ok: false, error: "Propón una fecha y una hora que todavía no hayan pasado" };
  }
  // A year out is not a proposal, it is a typo in the year.
  const limit = new Date(reference);
  limit.setFullYear(limit.getFullYear() + 1);
  if (instant.getTime() > limit.getTime()) {
    return { ok: false, error: "Propón una fecha dentro del próximo año" };
  }
  return { ok: true };
}

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
