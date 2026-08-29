/**
 * El recibo de arriendo y el paz y salvo.
 *
 * Lo que se afirma aquí es sobre todo **cuándo cada documento NO puede existir**, que es la mitad
 * que importa: un recibo de un mes que el propietario no ha confirmado, o un paz y salvo con un mes
 * en mora, son papeles que dicen algo que nadie dijo — y los dos se los puede llevar el inquilino a
 * un tercero.
 */
import { describe, expect, it } from "vitest";

import {
  certificateReference,
  clearance,
  clearanceBlocker,
  receiptBlocker,
  rentReceipt,
} from "./certificate";
import type { Period, ScheduledMonth } from "./lease";

const HOY = "2026-09-20";

const mes = (id: string, dueDate: string): ScheduledMonth => ({
  id,
  ordinal: 1,
  dueDate,
  amount: 1_800_000,
});

const pagado = (amount = 1_800_000): Period => ({
  id: "2026-09",
  amount: 1_800_000,
  dueDate: "2026-09-05",
  receipt: {
    path: "canon/lease-1/a.pdf",
    fileName: "comprobante.pdf",
    contentType: "application/pdf",
    bytes: 1000,
    amount,
    paidOn: "2026-09-04",
    uploadedAt: "2026-09-04T10:00:00.000Z",
    note: "",
  },
  verdict: { status: "confirmed", at: "2026-09-05T10:00:00.000Z", reason: "" },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
});

const enRevision = (): Period => ({ ...pagado(), verdict: null });
const rechazado = (): Period => ({
  ...pagado(),
  verdict: { status: "rejected", at: "2026-09-05T10:00:00.000Z", reason: "El monto no coincide." },
});

describe("certificateReference", () => {
  it("es estable: el mismo mes da siempre la misma referencia", () => {
    const uno = certificateReference("receipt", "lease-abc123", "2026-09");
    const otro = certificateReference("receipt", "lease-abc123", "2026-09");

    expect(uno).toBe(otro);
  });

  it("distingue los dos documentos y el periodo", () => {
    expect(certificateReference("receipt", "lease-abc123", "2026-09")).toMatch(/^REC-/);
    expect(certificateReference("clearance", "lease-abc123", "2026-09-20")).toMatch(/^PYS-/);
    expect(certificateReference("receipt", "lease-abc123", "2026-09")).not.toBe(
      certificateReference("receipt", "lease-abc123", "2026-10"),
    );
  });

  /** Se lee en voz alta y se teclea en la hoja de cálculo de alguien. */
  it("no lleva caracteres que haya que deletrear", () => {
    expect(certificateReference("receipt", "lease_ABC-123", "2026-09")).toMatch(/^[A-Z0-9-]+$/);
  });

  /**
   * Toma el **final** del id y no el principio: los ids legibles llevan prefijo (`lease-cert-…`), y
   * cortando por delante todas las tenencias de una misma corrida compartirían la referencia.
   */
  it("distingue dos tenencias cuyo id empieza igual", () => {
    expect(certificateReference("receipt", "lease-cert-111111", "2026-09")).not.toBe(
      certificateReference("receipt", "lease-cert-222222", "2026-09"),
    );
  });
});

describe("receiptBlocker", () => {
  /**
   * **La regla entera.** Un recibo certifica que el dinero *llegó*, y eso solo lo puede decir la
   * persona cuya cuenta es. Un mes con comprobante subido y sin confirmar se ve pagado desde el lado
   * del inquilino y no lo está.
   */
  it("solo hay recibo de un mes confirmado", () => {
    const septiembre = mes("2026-09", "2026-09-05");

    expect(receiptBlocker(septiembre, pagado(), HOY)).toBeNull();
    expect(receiptBlocker(septiembre, enRevision(), HOY)).toBe("not_confirmed");
    expect(receiptBlocker(septiembre, rechazado(), HOY)).toBe("not_confirmed");
    expect(receiptBlocker(septiembre, null, HOY)).toBe("not_confirmed");
  });
});

describe("rentReceipt", () => {
  const base = {
    leaseId: "lease-abc123",
    month: mes("2026-09", "2026-09-05"),
    propertyTitle: "Apartamento con balcón en Palermo",
    propertyCity: "Manizales",
    landlordName: "Ana Propietaria Pérez",
    tenantName: "Carlos Inquilino Ramírez",
    issuedAt: "2026-09-20T15:00:00.000Z",
  };

  it("dice el periodo en palabras y no solo como código", () => {
    expect(rentReceipt({ ...base, stored: pagado() }).periodLabel).toBe("septiembre de 2026");
  });

  /**
   * La cifra es la que el propietario confirmó, no la que el calendario esperaba. Un giro corto que
   * aceptó igual tiene que quedar registrado por lo que de verdad llegó — la misma elección que hace
   * `leaseSummary` sobre el mismo campo.
   */
  it("certifica lo que llegó, no lo que se esperaba", () => {
    expect(rentReceipt({ ...base, stored: pagado(1_500_000) }).amount).toBe(1_500_000);
  });

  it("guarda las dos fechas, que no son la misma", () => {
    const recibo = rentReceipt({ ...base, stored: pagado() });

    expect(recibo.paidOn).toBe("2026-09-04");
    expect(recibo.confirmedAt).toBe("2026-09-05T10:00:00.000Z");
    expect(recibo.issuedAt).toBe("2026-09-20T15:00:00.000Z");
  });
});

describe("clearanceBlocker", () => {
  const entradas = (...meses: readonly (Period | null)[]) =>
    meses.map((stored, index) => ({
      month: mes(`2026-0${index + 7}`, `2026-0${index + 7}-05`),
      stored,
    }));

  it("no se puede con un mes en mora", () => {
    expect(clearanceBlocker(entradas(pagado(), null), HOY)).toBe("overdue");
  });

  it("tampoco con un comprobante rechazado", () => {
    expect(clearanceBlocker(entradas(pagado(), rechazado()), HOY)).toBe("overdue");
  });

  /**
   * Y este es el caso que hay que decir en voz alta: desde el lado del inquilino el giro está hecho
   * y la pantalla lo dice, pero un paz y salvo certifica que el dinero **llegó**.
   */
  it("tampoco con un mes esperando la confirmación del propietario", () => {
    expect(clearanceBlocker(entradas(pagado(), enRevision()), HOY)).toBe("in_review");
  });

  it("no certifica una tenencia en la que todavía no se ha confirmado nada", () => {
    expect(clearanceBlocker([], HOY)).toBe("nothing_confirmed");
  });

  /**
   * **Un mes que todavía no vence no bloquea nada.** Un paz y salvo dice "al día a la fecha", nunca
   * "el contrato terminó" — bajo Ley 820 el arriendo se renueva quiera alguien o no, así que un
   * documento que dijera lo segundo afirmaría algo que la ley niega.
   */
  it("no lo bloquea un mes que todavía no vence", () => {
    const futuro = [
      { month: mes("2026-09", "2026-09-05"), stored: pagado() },
      { month: mes("2026-10", "2026-10-05"), stored: null },
    ];

    expect(clearanceBlocker(futuro, HOY)).toBeNull();
  });

  it("deja pasar una tenencia al día", () => {
    expect(clearanceBlocker(entradas(pagado(), pagado()), HOY)).toBeNull();
  });
});

describe("clearance", () => {
  const base = {
    leaseId: "lease-abc123",
    today: HOY,
    propertyTitle: "Apartamento con balcón en Palermo",
    propertyCity: "Manizales",
    landlordName: "Ana Propietaria Pérez",
    tenantName: "Carlos Inquilino Ramírez",
    issuedAt: "2026-09-20T15:00:00.000Z",
  };

  it("lista solo los meses confirmados, y suma lo que llegó", () => {
    const resultado = clearance({
      ...base,
      entries: [
        { month: mes("2026-08", "2026-08-05"), stored: { ...pagado(1_700_000), id: "2026-08" } },
        { month: mes("2026-09", "2026-09-05"), stored: pagado() },
        /* Todavía no vence: no bloquea, y tampoco se certifica. */
        { month: mes("2026-10", "2026-10-05"), stored: null },
      ],
    });

    expect(resultado.months.map((one) => one.period)).toEqual(["2026-08", "2026-09"]);
    expect(resultado.totalPaid).toBe(3_500_000);
    expect(resultado.through).toBe("septiembre de 2026");
  });

  /**
   * La fecha de emisión entra en la referencia porque un paz y salvo es cierto **en una fecha**: dos
   * emitidos con un mes de diferencia son documentos distintos y no pueden llevar el mismo
   * identificador.
   */
  it("cambia de referencia cuando cambia el día en que se emite", () => {
    const entries = [{ month: mes("2026-09", "2026-09-05"), stored: pagado() }];
    const hoy = clearance({ ...base, entries });
    const mañana = clearance({ ...base, entries, today: "2026-09-21" });

    expect(hoy.reference).not.toBe(mañana.reference);
  });

  it("no revienta con una tenencia sin nada confirmado", () => {
    const vacio = clearance({ ...base, entries: [] });

    expect(vacio.months).toEqual([]);
    expect(vacio.through).toBe("");
    expect(vacio.totalPaid).toBe(0);
  });
});
