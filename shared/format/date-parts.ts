/**
 * A calendar date as three things a person actually knows: a day, a month and a year.
 *
 * `<input type="date">` looks tidy and is miserable for a birth date. It opens on the current
 * month, so someone born in 1994 arrives thirty years from where they need to be; its keyboard
 * order changes with the browser's locale, not the page's; and on a phone it is a spinner that
 * has to be scrolled through decades. Three fields are typed in the order the date is said out
 * loud, and the year is just a number.
 *
 * What crosses the form boundary is still one `YYYY-MM-DD` string: the schema, the database and
 * everything downstream never learn that the input was split.
 */

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export type DateParts = {
  readonly day: string;
  /** `01`–`12`, so it can be compared and concatenated without arithmetic. */
  readonly month: string;
  readonly year: string;
};

export const EMPTY_DATE_PARTS: DateParts = { day: "", month: "", year: "" };

/** Splits a stored `YYYY-MM-DD`. Anything else comes back empty rather than half-parsed. */
export function toDateParts(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return EMPTY_DATE_PARTS;

  return { year: match[1]!, month: match[2]!, day: match[3]! };
}

/**
 * Does this day exist in this month of this year?
 *
 * The 31st of February parses in some engines and rolls over to March in others, which is how a
 * form ends up quietly storing a date nobody typed. Checked by hand instead of trusting `Date`.
 */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;

  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= lengths[month - 1]!;
}

/**
 * Joins the three fields back into `YYYY-MM-DD`, or `""` while they do not yet make a date.
 *
 * Empty rather than a guess: a half-filled date is not a date, and the schema's job is to say so
 * once, not to receive something invented here.
 */
export function fromDateParts(parts: DateParts): string {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);

  if (parts.year.trim().length !== 4 || !parts.month || !parts.day) return "";
  if (!isRealDate(year, month, day)) return "";

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Keeps only digits, capped at `max` of them. What a numeric field should accept. */
export function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}
