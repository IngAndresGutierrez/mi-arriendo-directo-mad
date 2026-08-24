/**
 * A day and an hour, agreed between two people, checked once.
 *
 * Two stages arrange a time somebody has to turn up to — the visit to the property and the
 * interview — and the rules are the same for both: it is read as Bogotá wall time, it has to be in
 * the future, and a date a year out is a typo in the year rather than a proposal. This lives on its
 * own because a second copy of those three lines is a second thing that can drift, and the first to
 * drift would be the one that lets somebody propose an appointment in the past.
 */

/**
 * Colombia does not observe daylight saving, so a wall time there is always UTC-5.
 *
 * That is what makes it safe to build the instant from the two fields a form shows: with a fixed
 * offset "el 10 de septiembre a las 3:00 p. m." means one instant and only one, whatever clock the
 * server or the browser happens to be on.
 */
export const BOGOTA_OFFSET = "-05:00";

/** `2026-09-10` + `15:00` → the instant that is 3 p.m. in Bogotá. */
export function toInstant(day: string, time: string): Date {
  return new Date(`${day}T${time}:00${BOGOTA_OFFSET}`);
}

/**
 * Is the proposed time still in the future, and not absurdly far into it?
 *
 * Checked against an explicit reference so the rule stays pure and the server can re-check it
 * against its own clock: a browser's is whatever the person set it to.
 */
export function validateSlot(
  instant: Date,
  reference: Date,
): { ok: true } | { ok: false; error: string } {
  if (Number.isNaN(instant.getTime())) {
    return { ok: false, error: "Elige una fecha y una hora válidas" };
  }
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
