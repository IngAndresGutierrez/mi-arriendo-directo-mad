/**
 * Dates as a person reads them, not as they are stored.
 *
 * Always in Bogotá time, because "cerrado el 15 de octubre" has to mean the 15th here: on Vercel
 * the clock is UTC, and formatting a late-evening timestamp without a time zone moves it a day.
 *
 * A date-only value (`2026-10-15`, what an `<input type="date">` produces) has no time at all, so
 * it is read at midday: parsed as midnight UTC it would land on the 14th in Bogotá.
 */
const TIME_ZONE = "America/Bogota";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function instantOf(value: string): Date {
  return new Date(DATE_ONLY.test(value) ? `${value}T12:00:00Z` : value);
}

/** `15 oct 2026` — for a date the reader only needs to recognise. */
export function formatShortDate(value: string): string {
  const instant = instantOf(value);
  if (Number.isNaN(instant.getTime())) return "";

  // Composed from the parts rather than formatted whole: es-CO writes the short form as
  // "15 de oct de 2026", three words of glue in a line that already carries three facts.
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).formatToParts(instant);

  const of = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace(".", "") ?? "";

  return `${of("day")} ${of("month")} ${of("year")}`;
}

/** `15 de octubre de 2026` — for the one date a screen is about. */
export function formatLongDate(value: string): string {
  const instant = instantOf(value);
  if (Number.isNaN(instant.getTime())) return "";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(instant);
}

/**
 * `15 oct 2026, 3:42 p. m.` — for a moment that has to be pinned down, not just recognised.
 *
 * A signature's timestamp is evidence, so the minute matters and the time zone is the whole point:
 * on Vercel the clock is UTC, and a signature taken at 8 p.m. in Bogotá would otherwise be recorded
 * as the next day. Lives here rather than in the stage that needed it first, because the moment a
 * second screen shows the same instant, two formatters are two things that can drift.
 */
export function formatBogotaDateTime(value: string): string {
  const instant = instantOf(value);
  if (Number.isNaN(instant.getTime())) return "";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(instant);
}
