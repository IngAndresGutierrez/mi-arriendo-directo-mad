import { describe, expect, it } from "vitest";

import {
  canContactForCollection,
  collectionContactBlocker,
  colombianHolidays,
  isColombianHoliday,
} from "./contact-window";

/** A Bogotá wall-clock moment as a real instant. Colombia is UTC-5 all year. */
function bogota(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-05:00`);
}

/*
 * The windows of Ley 2300 de 2023, at their edges. The edges are the whole point: a rule tested
 * only in the middle of the afternoon is a rule that has not been tested.
 */
describe("the weekday window: 07:00 to 19:00", () => {
  // 2026-08-24 is a Monday.
  const monday = "2026-08-24";

  it("is closed before it opens", () => {
    expect(collectionContactBlocker(bogota(monday, "06:59"))).toBe("outside_hours");
  });

  it("opens at 07:00 sharp", () => {
    expect(canContactForCollection(bogota(monday, "07:00"))).toBe(true);
  });

  it("is open a minute before it closes", () => {
    expect(canContactForCollection(bogota(monday, "18:59"))).toBe(true);
  });

  /*
   * `hasta las 7:00 p.m.` is not an invitation to send at 19:00:00. The end is exclusive, and
   * being a minute early costs nothing.
   */
  it("is closed at 19:00 sharp", () => {
    expect(collectionContactBlocker(bogota(monday, "19:00"))).toBe("outside_hours");
  });

  it("is closed late at night", () => {
    expect(collectionContactBlocker(bogota(monday, "22:30"))).toBe("outside_hours");
    expect(collectionContactBlocker(bogota(monday, "03:00"))).toBe("outside_hours");
  });

  it("is open every weekday, not only Monday", () => {
    // Tuesday through Friday of the same week.
    for (const date of ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]) {
      expect(canContactForCollection(bogota(date, "12:00"))).toBe(true);
    }
  });
});

describe("the Saturday window: 08:00 to 15:00", () => {
  // 2026-08-29 is a Saturday.
  const saturday = "2026-08-29";

  /* Saturday opens an hour later and closes four hours earlier than a weekday. */
  it("is closed at 07:30, which is open on a weekday", () => {
    expect(collectionContactBlocker(bogota(saturday, "07:30"))).toBe("outside_hours");
    expect(canContactForCollection(bogota("2026-08-28", "07:30"))).toBe(true);
  });

  it("opens at 08:00 and closes at 15:00", () => {
    expect(canContactForCollection(bogota(saturday, "08:00"))).toBe(true);
    expect(canContactForCollection(bogota(saturday, "14:59"))).toBe(true);
    expect(collectionContactBlocker(bogota(saturday, "15:00"))).toBe("outside_hours");
  });

  it("is closed in the late afternoon, which is open on a weekday", () => {
    expect(collectionContactBlocker(bogota(saturday, "17:00"))).toBe("outside_hours");
    expect(canContactForCollection(bogota("2026-08-28", "17:00"))).toBe(true);
  });
});

describe("Sundays and holidays", () => {
  // 2026-08-30 is a Sunday.
  it("is never open on a Sunday, at any hour", () => {
    for (const time of ["00:00", "09:00", "12:00", "18:00", "23:59"]) {
      expect(collectionContactBlocker(bogota("2026-08-30", time))).toBe("sunday");
    }
  });

  /* 2026-07-20 (Independencia) falls on a Monday, so the hours alone would let it through. */
  it("is closed on a holiday that falls inside the weekday window", () => {
    expect(canContactForCollection(bogota("2026-07-20", "10:00"))).toBe(false);
    expect(collectionContactBlocker(bogota("2026-07-20", "10:00"))).toBe("holiday");
  });

  it("says which of the three reasons applies", () => {
    expect(collectionContactBlocker(bogota("2026-08-30", "10:00"))).toBe("sunday");
    expect(collectionContactBlocker(bogota("2026-07-20", "10:00"))).toBe("holiday");
    expect(collectionContactBlocker(bogota("2026-08-24", "23:00"))).toBe("outside_hours");
  });
});

/*
 * The offset is what makes all of the above mean anything. On Vercel the server clock is UTC, so
 * a window read from the server's own parts would be five hours out — 19:00 in Bogotá would test
 * as midnight, and the sweep would go quiet in the middle of the afternoon.
 */
describe("it is Bogotá's clock, not the server's", () => {
  it("reads 18:00 in Bogotá as inside the window even though it is 23:00 UTC", () => {
    expect(canContactForCollection(new Date("2026-08-24T23:00:00Z"))).toBe(true);
  });

  it("reads 21:00 in Bogotá as outside it even though it is 02:00 UTC the next day", () => {
    expect(canContactForCollection(new Date("2026-08-25T02:00:00Z"))).toBe(false);
  });

  /* 2026-08-31 00:30 UTC is still Sunday the 30th in Bogotá. */
  it("does not roll into Monday before Bogotá does", () => {
    expect(collectionContactBlocker(new Date("2026-08-31T00:30:00Z"))).toBe("sunday");
  });
});

/**
 * The eighteen Colombian holidays of 2026, computed rather than tabulated.
 *
 * Six are relative to Easter and seven are shifted to the following Monday by the Ley Emiliani,
 * so this list is the proof that both mechanisms work. Getting the shift wrong moves a holiday by
 * up to six days, which would make a working Monday quiet and a real holiday noisy.
 */
describe("colombianHolidays", () => {
  const holidays = colombianHolidays(2026);

  it("finds all eighteen", () => {
    expect(holidays).toHaveLength(18);
  });

  it("matches the 2026 calendar exactly", () => {
    expect(holidays).toEqual([
      "2026-01-01", // Año Nuevo
      "2026-01-12", // Reyes — el 6 cae martes
      "2026-03-23", // San José — el 19 cae jueves
      "2026-04-02", // Jueves Santo
      "2026-04-03", // Viernes Santo
      "2026-05-01", // Día del Trabajo
      "2026-05-18", // Ascensión
      "2026-06-08", // Corpus Christi
      "2026-06-15", // Sagrado Corazón
      "2026-06-29", // San Pedro y San Pablo — ya cae lunes
      "2026-07-20", // Independencia
      "2026-08-07", // Batalla de Boyacá
      "2026-08-17", // Asunción — el 15 cae sábado
      "2026-10-12", // Día de la Raza — ya cae lunes
      "2026-11-02", // Todos los Santos — el 1 cae domingo
      "2026-11-16", // Independencia de Cartagena — el 11 cae miércoles
      "2026-12-08", // Inmaculada
      "2026-12-25", // Navidad
    ]);
  });

  /* Holy Week is not shifted: Viernes Santo is always a Friday. */
  it("leaves Holy Week where it falls", () => {
    expect(new Date("2026-04-03T12:00:00Z").getUTCDay()).toBe(5);
    expect(holidays).toContain("2026-04-03");
  });

  /* A different year, so nothing above can be passing on a cached table. */
  it("works for another year", () => {
    const next = colombianHolidays(2027);

    expect(next).toHaveLength(18);
    expect(next).toContain("2027-01-01");
    // Easter 2027 is 28 March, so Viernes Santo is the 26th.
    expect(next).toContain("2027-03-26");
  });
});

describe("isColombianHoliday", () => {
  it("recognises a holiday and an ordinary day", () => {
    expect(isColombianHoliday("2026-12-25")).toBe(true);
    expect(isColombianHoliday("2026-12-26")).toBe(false);
  });

  it("answers false to something that is not a date", () => {
    expect(isColombianHoliday("")).toBe(false);
    expect(isColombianHoliday("mañana")).toBe(false);
  });
});
