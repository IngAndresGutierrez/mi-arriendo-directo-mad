import { describe, expect, it } from "vitest";

import { bogotaToday, formatBogotaDateTime, formatLongDate, formatShortDate } from "./date";

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

  /*
   * Un fallo de hidratación, no tipografía: `es-CO` separa la hora de "p. m." con un espacio fino
   * indivisible (U+202F) en algunas versiones de ICU y con uno normal en otras, así que Node y el
   * navegador formatean el mismo instante en dos cadenas idénticas en pantalla y distintas para
   * React. El diff imprime dos líneas que se ven exactamente iguales, que es la forma más confusa
   * posible de enterarse.
   */
  it("emits no invisible spaces, so the server and the browser agree", () => {
    const formatted = formatBogotaDateTime("2026-08-23T20:52:00.000Z");

    expect(formatted).not.toMatch(/[\u202f\u00a0]/);
    expect(formatted).toMatch(/3:52/);
  });
});

describe("bogotaToday", () => {
  it("gives the ISO date, ready to compare as a string", () => {
    expect(bogotaToday(new Date("2026-09-15T18:00:00.000Z"))).toBe("2026-09-15");
  });

  /*
   * La razón de existir: a las 8 de la noche en Bogotá ya es el día siguiente en UTC, y un canon
   * "vencido hoy" se reportaría tarde unas horas antes de estarlo.
   */
  it("is Bogotá's day, not the server's", () => {
    expect(bogotaToday(new Date("2026-09-16T02:30:00.000Z"))).toBe("2026-09-15");
  });
});
