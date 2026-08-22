import { describe, expect, it } from "vitest";

import { formatLongDate, formatShortDate } from "./date";

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
