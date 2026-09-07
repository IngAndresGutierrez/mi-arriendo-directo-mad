import { describe, expect, it } from "vitest";

import {
  bogotaToday,
  formatBogotaDateTime,
  formatBogotaTime,
  formatBogotaWeekdayTime,
  formatLongDate,
  formatShortDate,
} from "./date";

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

/*
 * El formateador por el que pasa **toda** cita del producto: la entrevista, la visita y el encargo.
 * No tenía ni una prueba, y es justo la garantía que alguien pregunta cuando programa algo para las
 * 15:00 y quiere saber si el otro lado va a leer las 3 de la tarde.
 *
 * Las horas de aquí están escritas como instantes UTC a propósito: es lo que hay en Firestore, y un
 * caso escrito con el desfase ya aplicado no comprobaría la conversión, solo la impresión.
 */
describe("formatBogotaWeekdayTime", () => {
  it("writes the hour in 12 with p. m., not in 24", () => {
    // 20:00 UTC son las 3:00 p. m. en Bogotá: lo que se escribió como "15:00" en el formulario.
    const formatted = formatBogotaWeekdayTime("2026-09-07T20:00:00.000Z");

    expect(formatted).toContain("3:00 p. m.");
    expect(formatted).not.toContain("15:00");
  });

  it("carries the weekday, which is the point of this shape", () => {
    expect(formatBogotaWeekdayTime("2026-09-07T20:00:00.000Z")).toMatch(/^lunes, 7 de septiembre/);
  });

  /*
   * La razón de existir. En Vercel el reloj es UTC y en un portátil es el del dueño: sin
   * `timeZone`, un encargo de las 8 de la noche en Bogotá se pintaría el día siguiente, y a la hora
   * que no es. 02:30 UTC del 8 son las 9:30 p. m. del **7** en Bogotá.
   */
  it("is Bogotá's clock, never the machine's", () => {
    const formatted = formatBogotaWeekdayTime("2026-09-08T02:30:00.000Z");

    expect(formatted).toContain("9:30 p. m.");
    expect(formatted).toMatch(/lunes, 7 de septiembre/);
  });

  it("returns empty for something that is not a date", () => {
    expect(formatBogotaWeekdayTime("no soy una fecha")).toBe("");
  });
});

describe("formatBogotaTime", () => {
  it("uses 12 hours with the meridiem, both halves of the day", () => {
    expect(formatBogotaTime("2026-09-07T13:05:00.000Z")).toBe("8:05 a. m.");
    expect(formatBogotaTime("2026-09-07T20:00:00.000Z")).toBe("3:00 p. m.");
  });

  /*
   * Un fallo de hidratación, no tipografía — la misma trampa que ya paga `formatBogotaDateTime`:
   * el espacio antes de "p. m." es U+202F en unas versiones de ICU y normal en otras, así que
   * servidor y navegador producen dos cadenas idénticas en pantalla y distintas para React.
   */
  it("emits no invisible spaces, so the server and the browser agree", () => {
    expect(formatBogotaTime("2026-09-07T20:00:00.000Z")).not.toMatch(/[\u202f\u00a0]/);
  });

  it("returns empty for something that is not a date", () => {
    expect(formatBogotaTime("no soy una fecha")).toBe("");
  });
});
