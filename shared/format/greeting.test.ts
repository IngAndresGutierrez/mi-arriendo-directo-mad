import { describe, expect, it } from "vitest";

import { firstName, greetingForHour, hourInProductTimeZone } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [5, "greetingMorning"],
    [8, "greetingMorning"],
    [11, "greetingMorning"],
    [12, "greetingAfternoon"],
    [15, "greetingAfternoon"],
    [18, "greetingAfternoon"],
    [19, "greetingEvening"],
    [23, "greetingEvening"],
    [0, "greetingEvening"],
    [4, "greetingEvening"],
  ])("at %i it greets with %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("hourInProductTimeZone", () => {
  it("uses Colombian time, not the server's", () => {
    // 2026-08-21T01:00:00Z is 20:00 the previous day in Bogotá (UTC-5).
    const instant = new Date("2026-08-21T01:00:00Z");
    expect(hourInProductTimeZone(instant)).toBe(20);
    expect(greetingForHour(hourInProductTimeZone(instant))).toBe("greetingEvening");
  });

  it("turns UTC midnight into 19:00 in Bogotá", () => {
    expect(hourInProductTimeZone(new Date("2026-08-21T00:00:00Z"))).toBe(19);
  });

  it("UTC noon is 07:00 in Bogotá", () => {
    const instant = new Date("2026-08-21T12:00:00Z");
    expect(hourInProductTimeZone(instant)).toBe(7);
    expect(greetingForHour(hourInProductTimeZone(instant))).toBe("greetingMorning");
  });
});

describe("firstName", () => {
  it.each([
    ["Ana María Restrepo", "Ana"],
    ["  Juan  Pérez  ", "Juan"],
    ["Madonna", "Madonna"],
  ])("from %s it takes %s", (fullName, expected) => {
    expect(firstName(fullName)).toBe(expected);
  });

  it("returns empty for an empty string", () => {
    expect(firstName("   ")).toBe("");
  });
});
