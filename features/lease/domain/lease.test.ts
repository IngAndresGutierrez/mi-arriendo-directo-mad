import { describe, expect, it } from "vitest";

import {
  currentMonth,
  currentTermEnd,
  isOpen,
  leaseSchedule,
  leaseSummary,
  leaseTermState,
  monthsBetween,
  periodAnchor,
  periodLabel,
  periodOf,
  periodState,
  periodTitle,
  shiftMonths,
  termEndDate,
  termsElapsed,
  verdictApplies,
  MAX_SCHEDULED_MONTHS,
  type Period,
} from "./lease";

/** A tenancy that started mid-month, which is the case every off-by-one hides in. */
const LEASE = { startDate: "2026-09-15", months: 12 as const, monthlyCost: 1_800_000 };

function storedPeriod(overrides: Partial<Period> = {}): Period {
  return {
    id: "2026-09",
    amount: 1_800_000,
    dueDate: "2026-09-15",
    receipt: null,
    verdict: null,
    createdAt: "2026-09-15T12:00:00.000Z",
    updatedAt: "2026-09-15T12:00:00.000Z",
    ...overrides,
  };
}

function receipt(uploadedAt: string, amount = 1_800_000) {
  return {
    path: "canon/lease-1/2026-09/x.jpg",
    fileName: "transferencia.jpg",
    contentType: "image/jpeg",
    bytes: 120_000,
    uploadedAt,
    amount,
    paidOn: "2026-09-14",
    note: "",
  };
}

describe("shiftMonths", () => {
  it("moves a whole month", () => {
    expect(shiftMonths("2026-09-15", 1)).toBe("2026-10-15");
  });

  it("crosses a year", () => {
    expect(shiftMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(shiftMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  /*
   * El 31 de enero más un mes es el 28 de febrero, no el 3 de marzo. En algunos motores `Date`
   * desborda y es así como un calendario acaba con dos documentos para el mismo mes.
   */
  it("clamps to the length of the target month instead of overflowing", () => {
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(shiftMonths("2026-03-31", 1)).toBe("2026-04-30");
  });

  /*
   * La razón de tomar el día del original cada vez: si se recortara y se siguiera sumando desde el
   * resultado, un canon del 31 se quedaría en el 28 el resto del arriendo.
   */
  it("recovers the original day after a short month", () => {
    expect(shiftMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(shiftMonths("2026-01-31", 3)).toBe("2026-04-30");
    expect(shiftMonths("2026-01-31", 4)).toBe("2026-05-31");
  });

  it("returns empty for something that is not a date", () => {
    expect(shiftMonths("septiembre", 1)).toBe("");
  });
});

describe("periodOf and monthsBetween", () => {
  it("takes the month a date falls in", () => {
    expect(periodOf("2026-09-15")).toBe("2026-09");
  });

  it("counts whole months, in both directions", () => {
    expect(monthsBetween("2026-09-15", "2027-09-15")).toBe(12);
    expect(monthsBetween("2026-09-15", "2026-09-30")).toBe(0);
    expect(monthsBetween("2026-09-15", "2026-08-01")).toBe(-1);
  });
});

describe("termEndDate", () => {
  /*
   * Un año desde el 15 de septiembre de 2026 llega hasta el 14 de septiembre de 2027. Llamar al 15
   * el último día sería vender trece meses de tenencia como doce.
   */
  it("is the day before the anniversary", () => {
    expect(termEndDate("2026-09-15", 12)).toBe("2027-09-14");
    expect(termEndDate("2026-09-15", 6)).toBe("2027-03-14");
  });

  it("steps back into the previous month when the anniversary is the 1st", () => {
    expect(termEndDate("2026-03-01", 12)).toBe("2027-02-28");
    expect(termEndDate("2027-03-01", 12)).toBe("2028-02-29");
    expect(termEndDate("2026-05-01", 1)).toBe("2026-05-31");
  });
});

describe("termsElapsed and leaseTermState", () => {
  it("is upcoming before the start date", () => {
    expect(leaseTermState(LEASE, "2026-09-14")).toBe("upcoming");
    expect(leaseTermState(LEASE, "2026-09-15")).toBe("running");
  });

  it("stays on the first term through its last day", () => {
    expect(termsElapsed(LEASE, "2027-09-14")).toBe(0);
    expect(leaseTermState(LEASE, "2027-09-14")).toBe("running");
  });

  /*
   * Ley 820: el arriendo se renueva por otro término salvo que alguien avise. Que "se cumplieron
   * los meses" no es "se acabó", y por eso no hay estado `ended`.
   */
  it("renews the day after the term runs out, it does not end", () => {
    expect(termsElapsed(LEASE, "2027-09-15")).toBe(1);
    expect(leaseTermState(LEASE, "2027-09-15")).toBe("renewed");
  });

  /*
   * El día importa: `monthsBetween` ya dice doce el 1 de septiembre de 2027, pero un término que
   * empezó el 15 no se ha cumplido todavía.
   */
  it("does not renew early just because the anniversary month arrived", () => {
    expect(monthsBetween(LEASE.startDate, "2027-09-01")).toBe(12);
    expect(termsElapsed(LEASE, "2027-09-01")).toBe(0);
  });

  it("counts a second renewal", () => {
    expect(termsElapsed(LEASE, "2028-09-15")).toBe(2);
  });

  it("says which term end is the one that matters now", () => {
    expect(currentTermEnd(LEASE, "2027-01-10")).toBe("2027-09-14");
    expect(currentTermEnd(LEASE, "2027-10-10")).toBe("2028-09-14");
  });
});

describe("leaseSchedule", () => {
  it("is one month per month of the term, starting on the start date", () => {
    const schedule = leaseSchedule(LEASE, "2026-10-01");

    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toEqual({
      id: "2026-09",
      ordinal: 1,
      dueDate: "2026-09-15",
      amount: 1_800_000,
    });
    expect(schedule[11]).toEqual({
      id: "2027-08",
      ordinal: 12,
      dueDate: "2027-08-15",
      amount: 1_800_000,
    });
  });

  it("has one document id per month: no month can be opened twice", () => {
    const ids = leaseSchedule(LEASE, "2027-01-01").map((month) => month.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * Lo que la renovación de la Ley 820 significa aquí: al día siguiente del término aparecen los
   * doce meses siguientes, sin que nada tenga que rellenarlos.
   */
  it("grows by a whole term when the lease renews", () => {
    expect(leaseSchedule(LEASE, "2027-09-14")).toHaveLength(12);
    expect(leaseSchedule(LEASE, "2027-09-15")).toHaveLength(24);
  });

  it("shows the first term before the tenancy has even started", () => {
    expect(leaseSchedule(LEASE, "2026-09-01")).toHaveLength(12);
  });

  /** Un guardia, no una regla de negocio: una fecha tecleada en 1926 no puede pedir mil filas. */
  it("is capped, so a nonsense start date cannot ask for a thousand rows", () => {
    const schedule = leaseSchedule({ ...LEASE, startDate: "1926-09-15" }, "2026-09-15");

    expect(schedule).toHaveLength(MAX_SCHEDULED_MONTHS);
  });

  it("is empty when there is no usable start date", () => {
    expect(leaseSchedule({ ...LEASE, startDate: "" }, "2026-09-15")).toEqual([]);
  });

  it("finds the month today falls in", () => {
    const schedule = leaseSchedule(LEASE, "2026-11-03");

    expect(currentMonth(schedule, "2026-11-03")?.id).toBe("2026-11");
    // Antes de empezar no hay mes en curso, y no es un error: no hay nada que pagar todavía.
    expect(currentMonth(schedule, "2026-08-30")).toBeNull();
  });
});

describe("periodState", () => {
  const month = { dueDate: "2026-09-15" };

  it("is upcoming before the due date and due on it", () => {
    expect(periodState(month, null, "2026-09-10")).toBe("upcoming");
    expect(periodState(month, null, "2026-09-15")).toBe("due");
  });

  it("is overdue the day after", () => {
    expect(periodState(month, null, "2026-09-16")).toBe("overdue");
  });

  it("is in review once a receipt is up and nobody has answered", () => {
    const stored = storedPeriod({ receipt: receipt("2026-09-14T10:00:00.000Z") });

    expect(periodState(month, stored, "2026-09-20")).toBe("in_review");
  });

  it("is paid once the landlord confirms, whatever the calendar says", () => {
    const stored = storedPeriod({
      receipt: receipt("2026-09-14T10:00:00.000Z"),
      verdict: { status: "confirmed", at: "2026-09-14T11:00:00.000Z", reason: "" },
    });

    expect(periodState(month, stored, "2026-12-01")).toBe("paid");
  });

  it("is rejected when the landlord says the money did not arrive", () => {
    const stored = storedPeriod({
      receipt: receipt("2026-09-14T10:00:00.000Z"),
      verdict: { status: "rejected", at: "2026-09-14T11:00:00.000Z", reason: "Llegó de menos." },
    });

    expect(periodState(month, stored, "2026-09-20")).toBe("rejected");
  });

  /*
   * Un veredicto pertenece al comprobante que juzgó. Sin esto, subir uno corregido dejaría
   * "rechazado" en pantalla sin nada que arreglar.
   */
  it("stops counting a rejection older than the receipt on screen", () => {
    const stored = storedPeriod({
      receipt: receipt("2026-09-18T10:00:00.000Z"),
      verdict: { status: "rejected", at: "2026-09-16T11:00:00.000Z", reason: "Llegó de menos." },
    });

    expect(verdictApplies(stored)).toBe(false);
    expect(periodState(month, stored, "2026-09-20")).toBe("in_review");
  });

  it("says which months still need somebody to act", () => {
    expect(isOpen("due")).toBe(true);
    expect(isOpen("overdue")).toBe(true);
    expect(isOpen("in_review")).toBe(true);
    expect(isOpen("rejected")).toBe(true);
    expect(isOpen("paid")).toBe(false);
    expect(isOpen("upcoming")).toBe(false);
  });
});

describe("leaseSummary", () => {
  const schedule = leaseSchedule(LEASE, "2026-12-01");

  it("counts nothing but the calendar when no month has been touched", () => {
    const summary = leaseSummary(schedule, [], "2026-12-01");

    // Septiembre, octubre y noviembre vencieron; diciembre vence el 15 y todavía no.
    expect(summary).toMatchObject({ scheduled: 12, paid: 0, overdue: 3, inReview: 0 });
    expect(summary.totalOverdue).toBe(3 * 1_800_000);
  });

  it("adds up what the landlord confirmed, month by month", () => {
    const periods: readonly Period[] = [
      storedPeriod({
        id: "2026-09",
        receipt: receipt("2026-09-14T10:00:00.000Z"),
        verdict: { status: "confirmed", at: "2026-09-15T10:00:00.000Z", reason: "" },
      }),
      storedPeriod({
        id: "2026-10",
        dueDate: "2026-10-15",
        receipt: receipt("2026-10-14T10:00:00.000Z"),
        verdict: { status: "confirmed", at: "2026-10-15T10:00:00.000Z", reason: "" },
      }),
      storedPeriod({
        id: "2026-11",
        dueDate: "2026-11-15",
        receipt: receipt("2026-11-20T10:00:00.000Z"),
      }),
    ];

    const summary = leaseSummary(schedule, periods, "2026-12-01");

    expect(summary).toMatchObject({ paid: 2, inReview: 1, overdue: 0 });
    expect(summary.totalPaid).toBe(2 * 1_800_000);
  });

  /*
   * Lo recibido, no lo debido: una transferencia corta que el propietario confirmó de todos modos
   * es lo que el propietario dice que llegó.
   */
  it("totals what arrived, not what was owed", () => {
    const periods: readonly Period[] = [
      storedPeriod({
        receipt: receipt("2026-09-14T10:00:00.000Z", 1_500_000),
        verdict: { status: "confirmed", at: "2026-09-15T10:00:00.000Z", reason: "" },
      }),
    ];

    expect(leaseSummary(schedule, periods, "2026-09-20").totalPaid).toBe(1_500_000);
  });

  it("counts a rejected month as owed, because it still is", () => {
    const periods: readonly Period[] = [
      storedPeriod({
        receipt: receipt("2026-09-14T10:00:00.000Z"),
        verdict: { status: "rejected", at: "2026-09-15T10:00:00.000Z", reason: "No llegó nada." },
      }),
    ];

    const summary = leaseSummary(schedule, periods, "2026-09-20");

    expect(summary).toMatchObject({ paid: 0, overdue: 1 });
    expect(summary.totalOverdue).toBe(1_800_000);
  });

  it("ignores a stored month that is not on the schedule", () => {
    const periods: readonly Period[] = [
      storedPeriod({
        id: "2030-01",
        receipt: receipt("2030-01-01T10:00:00.000Z"),
        verdict: { status: "confirmed", at: "2030-01-02T10:00:00.000Z", reason: "" },
      }),
    ];

    expect(leaseSummary(schedule, periods, "2026-12-01").paid).toBe(0);
  });
});

describe("words", () => {
  it("writes a month as a person says it", () => {
    expect(periodLabel("2026-09")).toBe("septiembre de 2026");
    expect(periodTitle("2026-09")).toBe("Septiembre de 2026");
  });

  it("gives back what it got when it is not a month", () => {
    expect(periodLabel("mañana")).toBe("mañana");
  });

  it("anchors a month so a notification lands on it", () => {
    expect(periodAnchor("2026-09")).toBe("mes-2026-09");
  });
});
