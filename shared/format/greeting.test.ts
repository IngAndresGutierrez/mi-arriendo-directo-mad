import { describe, expect, it } from "vitest";

import { firstName, greetingForHour, hourInProductTimeZone } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [5, "Buenos días"],
    [8, "Buenos días"],
    [11, "Buenos días"],
    [12, "Buenas tardes"],
    [15, "Buenas tardes"],
    [18, "Buenas tardes"],
    [19, "Buenas noches"],
    [23, "Buenas noches"],
    [0, "Buenas noches"],
    [4, "Buenas noches"],
  ])("at %i it greets with %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("hourInProductTimeZone", () => {
  it("uses Colombian time, not the server's", () => {
    // 2026-08-21T01:00:00Z is 20:00 the previous day in Bogotá (UTC-5).
    const instant = new Date("2026-08-21T01:00:00Z");
    expect(hourInProductTimeZone(instant)).toBe(20);
    expect(greetingForHour(hourInProductTimeZone(instant))).toBe("Buenas noches");
  });

  it("turns UTC midnight into 19:00 in Bogotá", () => {
    expect(hourInProductTimeZone(new Date("2026-08-21T00:00:00Z"))).toBe(19);
  });

  it("UTC noon is 07:00 in Bogotá", () => {
    const instant = new Date("2026-08-21T12:00:00Z");
    expect(hourInProductTimeZone(instant)).toBe(7);
    expect(greetingForHour(hourInProductTimeZone(instant))).toBe("Buenos días");
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
