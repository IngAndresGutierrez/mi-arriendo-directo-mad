import { describe, expect, it } from "vitest";

import { formatBogotaDateTime, formatLongDate, formatShortDate } from "./date";

describe("formatShortDate", () => {
  it("writes a date-only value as the day it says", () => {
    expect(formatShortDate("2026-10-15")).toBe("15 oct 2026");
  });

  it("reads a timestamp in Bogotá time, not UTC", () => {
    // 04:30 UTC on the 16th is still 23:30 on the 15th in Bogotá.
    expect(formatShortDate("2026-10-16T04:30:00.000Z")).toBe("15 oct 2026");
  });

  it("returns nothing for a value that is not a date", () => {
    expect(formatShortDate("mañana")).toBe("");
  });
});

describe("formatLongDate", () => {
  it("spells the month out", () => {
    expect(formatLongDate("2026-10-15")).toBe("15 de octubre de 2026");
  });

  it("returns nothing for a value that is not a date", () => {
    expect(formatLongDate("")).toBe("");
  });
});

describe("formatBogotaDateTime", () => {
  it("shows the minute, because a signature's timestamp is evidence", () => {
    const formatted = formatBogotaDateTime("2026-10-15T20:42:00.000Z");
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/oct/);
    expect(formatted).toMatch(/42/);
  });

  /*
   * Lo que este formateador existe para evitar: en Vercel el reloj es UTC, y una firma de las 8 de
   * la noche en Bogotá quedaría registrada al día siguiente. 20:42 UTC son 15:42 del mismo día.
   */
  it("reads the instant in Bogotá, not in UTC", () => {
    const formatted = formatBogotaDateTime("2026-10-16T02:30:00.000Z");
    expect(formatted).toMatch(/15/);
    expect(formatted).not.toMatch(/16/);
  });

  it("returns empty for something that is not a date", () => {
    expect(formatBogotaDateTime("no soy una fecha")).toBe("");
  });
});
