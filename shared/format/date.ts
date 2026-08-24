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

  return normalizeSpaces(
    new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: TIME_ZONE,
    }).format(instant),
  );
}

/**
 * Every kind of invisible space `Intl` might emit, flattened to a plain one.
 *
 * **This is a hydration fix, not typography.** `es-CO` writes an afternoon as `3:52 p. m.`, and the
 * space before `p. m.` is a *narrow no-break* space (U+202F) in some ICU builds and an ordinary one
 * in others — so Node and the browser can format the same instant into two strings that are
 * identical on screen and different to React. It shows up as a hydration mismatch whose diff prints
 * two lines that look exactly alike, which is the most confusing possible way to be told about it.
 *
 * It surfaced the day a timestamp was rendered **unfolded** in a Client Component: the stage panels
 * had been hiding theirs behind a collapsed panel, so it was never in the server's HTML to disagree
 * with. That is why the fix belongs here and not in the component that happened to find it.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

/**
 * Today's date in Bogotá, as `YYYY-MM-DD`.
 *
 * **It receives the instant instead of reading the clock**, for the same reason the greeting does:
 * a function that calls `new Date()` cannot be tested without waiting for tomorrow. And it is
 * Bogotá's day and not the server's, because on Vercel the clock is UTC — at 8 p.m. here it is
 * already the next day there, and a canon due "today" would be reported late a few hours early.
 *
 * `en-CA` is not a locale choice, it is the shortest way to get ISO order out of `Intl`: it
 * formats as `2026-09-15`, which is exactly the shape the rest of this module parses.
 */
const ISO_IN_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

export function bogotaToday(now: Date): string {
  return ISO_IN_BOGOTA.format(now);
}

/**
 * `jueves 10 de septiembre, 3:00 p. m.` — for an appointment somebody has to turn up to.
 *
 * The weekday is the point: "el 10 de septiembre" is a date you have to go and look up, and
 * "jueves" is one you already know where you are standing. No year, because an appointment more
 * than a few weeks out is not what this shape is for — `formatBogotaDateTime` is.
 *
 * It lives here and not in the stage that needed it first because **two screens now show the same
 * kind of instant**: the interview and the visit to the property. Two formatters for one fact are
 * two things that can drift, and the first to drift would be the hour somebody is expected at.
 */
export function formatBogotaWeekdayTime(value: string): string {
  const instant = instantOf(value);
  if (Number.isNaN(instant.getTime())) return "";

  const day = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(instant);

  return `${day}, ${formatBogotaTime(value)}`;
}

/**
 * `3:00 p. m.`, Colombian time.
 *
 * Goes through `normalizeSpaces` like every other formatter here, and that is not cosmetic: the
 * space before `p. m.` is a narrow no-break space in some ICU builds and an ordinary one in others,
 * which is a hydration mismatch the moment an hour is rendered unfolded.
 */
export function formatBogotaTime(value: string): string {
  const instant = instantOf(value);
  if (Number.isNaN(instant.getTime())) return "";

  return normalizeSpaces(
    new Intl.DateTimeFormat("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TIME_ZONE,
    }).format(instant),
  );
}
