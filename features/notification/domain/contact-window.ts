/**
 * When Colombian law allows a message about money to be sent, and when it does not.
 *
 * **Ley 2300 de 2023** — the *"dejen de fregar"* law — restricts contact made for **commercial or
 * collection purposes** to Monday–Friday 07:00–19:00 and Saturday 08:00–15:00, and forbids it on
 * Sundays and public holidays. It covers calls, SMS, email and messaging apps alike, and it
 * applies to the channels the person actually authorised. Enforcement sits with the SIC and the
 * Superintendencia Financiera.
 *
 * **Nothing this product sends today is collection or commercial.** The interview reminders are
 * transactional — an appointment both parties agreed to, at a time they chose — and the ten-minute
 * one deliberately arrives ten minutes before a call, which is outside these windows more often
 * than not. Applying the restriction to those would break the one message whose whole value is
 * arriving late.
 *
 * It exists because of what comes next. `CLAUDE.md` lists the daily cron that would tell a tenant
 * their canon is due as planned-and-not-built, and **that one is collection**: it is a demand for
 * money, it goes out on a schedule nobody supervises, and it is exactly what this law was written
 * about. Wiring the rule in before the cron exists is what stops it being remembered afterwards.
 *
 * Pure, and it takes its instant rather than reading the clock.
 */

/**
 * Colombia is `UTC-05:00` all year: it has never observed daylight saving.
 *
 * That is what lets this module work on offsets instead of on a timezone database, and it is the
 * same fixed offset `interviewWhen()` already relies on.
 */
const BOGOTA_OFFSET_MINUTES = -5 * 60;

/** A day and a wall-clock time in Bogotá. */
type BogotaMoment = {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** 0 = Sunday, matching `Date.prototype.getUTCDay`. */
  readonly weekday: number;
  /** Minutes since midnight. */
  readonly minutes: number;
};

/**
 * The instant, as a clock in Bogotá reads it.
 *
 * Shifting the instant and then reading the **UTC** parts is what keeps this independent of the
 * server's own timezone — on Vercel that is UTC, and reading the local parts would answer a
 * different question in development than in production.
 */
function inBogota(instant: Date): BogotaMoment {
  const shifted = new Date(instant.getTime() + BOGOTA_OFFSET_MINUTES * 60_000);

  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** The window for one weekday, in minutes since midnight, or `null` when there is none. */
function windowFor(weekday: number): { readonly from: number; readonly to: number } | null {
  // Sunday: nothing at all.
  if (weekday === 0) return null;
  // Saturday: 08:00–15:00.
  if (weekday === 6) return { from: 8 * 60, to: 15 * 60 };

  // Monday to Friday: 07:00–19:00.
  return { from: 7 * 60, to: 19 * 60 };
}

/** Why a collection message cannot go out right now. */
export type ContactBlocker = "sunday" | "holiday" | "outside_hours";

/**
 * Whether a **collection or commercial** message may be sent at this instant.
 *
 * `null` means it may. Anything else is the reason it may not, because a sweep that only knows
 * "no" cannot log why it stayed quiet — and a reminder silently not sent is the failure mode that
 * takes longest to notice.
 *
 * The boundaries are inclusive at the start and **exclusive at the end**: 19:00 sharp is outside
 * the window. A statute that says *hasta las 7:00 p.m.* is not an invitation to send at 19:00:00,
 * and being a minute early costs nothing.
 */
export function collectionContactBlocker(instant: Date): ContactBlocker | null {
  const moment = inBogota(instant);

  if (moment.weekday === 0) return "sunday";
  if (isColombianHoliday(moment.date)) return "holiday";

  const window = windowFor(moment.weekday);
  if (!window) return "sunday";

  return moment.minutes >= window.from && moment.minutes < window.to ? null : "outside_hours";
}

/** `true` when a collection message may be sent. The blocker carries the reason. */
export function canContactForCollection(instant: Date): boolean {
  return collectionContactBlocker(instant) === null;
}

/* ------------------------------------------------------------------------------------------- *
 * Colombian public holidays
 * ------------------------------------------------------------------------------------------- */

/**
 * Easter Sunday, by the Gregorian computus (Meeus/Jones/Butcher).
 *
 * Six of Colombia's eighteen holidays are defined relative to it, so there is no table to keep:
 * a hard-coded list would be right until the year it silently ran out, and a cron reading it
 * would then send collection messages on Jueves Santo.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

/** `YYYY-MM-DD` of a UTC date, which is how the whole table is keyed. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * The **Ley Emiliani** shift (Ley 51 de 1983): these holidays are observed on the following
 * Monday whenever they do not already fall on one.
 *
 * Getting this wrong is not a rounding error — it moves a holiday by up to six days, so a sweep
 * would treat a working Monday as a holiday and the actual holiday as a working day.
 */
function nextMonday(date: Date): Date {
  const weekday = date.getUTCDay();

  return weekday === 1 ? date : addDays(date, (8 - weekday) % 7);
}

/** Every Colombian public holiday of one year, as `YYYY-MM-DD`. */
export function colombianHolidays(year: number): readonly string[] {
  const easter = easterSunday(year);

  /** Fixed by date, never moved. */
  const fixed = [
    [1, 1], // Año Nuevo
    [5, 1], // Día del Trabajo
    [7, 20], // Independencia
    [8, 7], // Batalla de Boyacá
    [12, 8], // Inmaculada Concepción
    [12, 25], // Navidad
  ] as const;

  /** Fixed by date, moved to the following Monday. */
  const moved = [
    [1, 6], // Reyes Magos
    [3, 19], // San José
    [6, 29], // San Pedro y San Pablo
    [8, 15], // Asunción de la Virgen
    [10, 12], // Día de la Raza
    [11, 1], // Todos los Santos
    [11, 11], // Independencia de Cartagena
  ] as const;

  return [
    ...fixed.map(([month, day]) => isoDate(new Date(Date.UTC(year, month - 1, day)))),
    ...moved.map(([month, day]) => isoDate(nextMonday(new Date(Date.UTC(year, month - 1, day))))),
    // Holy Week: relative to Easter and **not** moved.
    isoDate(addDays(easter, -3)), // Jueves Santo
    isoDate(addDays(easter, -2)), // Viernes Santo
    // Relative to Easter and moved to the following Monday — which they always already are.
    isoDate(nextMonday(addDays(easter, 43))), // Ascensión del Señor
    isoDate(nextMonday(addDays(easter, 64))), // Corpus Christi
    isoDate(nextMonday(addDays(easter, 71))), // Sagrado Corazón
  ].sort();
}

/** Cached per year: a sweep runs every few minutes and the answer changes once a year. */
const holidaysByYear = new Map<number, ReadonlySet<string>>();

/** Whether a `YYYY-MM-DD` in Bogotá is a public holiday. */
export function isColombianHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year)) return false;

  let holidays = holidaysByYear.get(year);
  if (!holidays) {
    holidays = new Set(colombianHolidays(year));
    holidaysByYear.set(year, holidays);
  }

  return holidays.has(date);
}
