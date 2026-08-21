import { describe, expect, it } from "vitest";

import { firstName, greetingForHour, hourInProductTimeZone } from "@/shared/format/greeting";

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
  ])("a las %i saluda %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("hourInProductTimeZone", () => {
  it("usa la hora de Colombia, no la del servidor", () => {
    // 2026-08-21T01:00:00Z son las 20:00 del día anterior en Bogotá (UTC-5).
    const instant = new Date("2026-08-21T01:00:00Z");
    expect(hourInProductTimeZone(instant)).toBe(20);
    expect(greetingForHour(hourInProductTimeZone(instant))).toBe("Buenas noches");
  });

  it("convierte medianoche UTC a las 19:00 de Bogotá", () => {
    expect(hourInProductTimeZone(new Date("2026-08-21T00:00:00Z"))).toBe(19);
  });

  it("mediodía UTC son las 07:00 en Bogotá", () => {
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
  ])("de %s toma %s", (fullName, expected) => {
    expect(firstName(fullName)).toBe(expected);
  });

  it("con cadena vacía devuelve vacío", () => {
    expect(firstName("   ")).toBe("");
  });
});
