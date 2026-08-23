import { describe, expect, it } from "vitest";

import { PAYOUT_METHODS } from "../domain/payout";
import { payoutSchema, receiptSchema, receiptVerdictSchema } from "./payout";

const holder = {
  holderName: "Marta Propietaria Gómez",
  holderDocument: "Cédula de ciudadanía 43112233",
};

describe("payoutSchema", () => {
  it("acepta Nequi y Daviplata con un celular colombiano", () => {
    for (const method of ["nequi", "daviplata"] as const) {
      const parsed = payoutSchema.safeParse({ method, phone: "3001234567", ...holder });
      expect(parsed.success).toBe(true);
    }
  });

  it("limpia los separadores que alguien copia de su app", () => {
    const parsed = payoutSchema.safeParse({ method: "nequi", phone: "300 123-4567", ...holder });
    expect(parsed.success && parsed.data.method === "nequi" && parsed.data.phone).toBe("3001234567");
  });

  /* Nequi y Daviplata son colombianos y van atados a una línea: aquí sí se puede ser estricto. */
  it("rechaza un número que no es un celular colombiano", () => {
    for (const phone of ["6012345678", "300123456", "30012345678", "+13001234567", ""]) {
      expect(payoutSchema.safeParse({ method: "nequi", phone, ...holder }).success).toBe(false);
    }
  });

  it("acepta una llave Bre-B en cualquiera de sus cinco formas", () => {
    for (const key of ["@marta2025", "3001234567", "marta@ejemplo.test", "43112233", "M0012345"]) {
      expect(payoutSchema.safeParse({ method: "breb", key, ...holder }).success).toBe(true);
    }
  });

  /*
   * Laxa a propósito: la única comprobación real es contra el directorio que comparten los bancos,
   * y no lo consultamos. Rechazar una llave que funciona es peor que aceptar una que no — esa falla
   * en el banco de la persona, donde se ve.
   */
  it("solo rechaza de la llave lo que no puede ser una llave", () => {
    expect(payoutSchema.safeParse({ method: "breb", key: "con espacios", ...holder }).success).toBe(false);
    expect(payoutSchema.safeParse({ method: "breb", key: "ab", ...holder }).success).toBe(false);
    expect(payoutSchema.safeParse({ method: "breb", key: "x".repeat(61), ...holder }).success).toBe(false);
  });

  it("acepta un banco conocido con tipo y número de cuenta", () => {
    const parsed = payoutSchema.safeParse({
      method: "bancolombia",
      accountType: "savings",
      accountNumber: "123-456-78901",
      ...holder,
    });
    expect(parsed.success && parsed.data.method === "bancolombia" && parsed.data.accountNumber).toBe(
      "12345678901",
    );
  });

  it("a otro banco le exige el nombre", () => {
    const base = { method: "other_bank", accountType: "checking", accountNumber: "998877", ...holder };
    expect(payoutSchema.safeParse(base).success).toBe(false);
    expect(payoutSchema.safeParse({ ...base, bankName: "Banco de Occidente" }).success).toBe(true);
  });

  it("rechaza un número de cuenta que no son dígitos", () => {
    const base = { method: "davivienda", accountType: "savings", ...holder };
    expect(payoutSchema.safeParse({ ...base, accountNumber: "12ab34" }).success).toBe(false);
    expect(payoutSchema.safeParse({ ...base, accountNumber: "123" }).success).toBe(false);
  });

  it("exige el tipo de cuenta: el número solo no dice cuál es", () => {
    expect(
      payoutSchema.safeParse({ method: "bancolombia", accountNumber: "12345678", ...holder }).success,
    ).toBe(false);
  });

  /*
   * Lo que la unión discriminada compra: un método no puede llegar con los campos de otro. Un
   * esquema plano con todo opcional aceptaría un Nequi con número de cuenta, y el resumen tendría
   * que decidir a cuál de los dos creerle.
   */
  it("no acepta un método con los campos de otro", () => {
    expect(
      payoutSchema.safeParse({
        method: "nequi",
        accountType: "savings",
        accountNumber: "12345678",
        ...holder,
      }).success,
    ).toBe(false);
    expect(payoutSchema.safeParse({ method: "breb", phone: "3001234567", ...holder }).success).toBe(false);
  });

  it("exige el titular en todos los métodos", () => {
    for (const method of PAYOUT_METHODS) {
      expect(payoutSchema.safeParse({ method, phone: "3001234567", key: "@x" }).success).toBe(false);
    }
  });

  it("rechaza un método que no ofrecemos", () => {
    expect(payoutSchema.safeParse({ method: "paypal", phone: "3001234567", ...holder }).success).toBe(false);
  });
});

describe("receiptSchema", () => {
  it("acepta el monto como lo escribe una persona", () => {
    for (const amount of ["1800000", "1.800.000", "$ 1.800.000", 1_800_000]) {
      const parsed = receiptSchema.safeParse({ amount, paidOn: "2026-10-01" });
      expect(parsed.success && parsed.data.amount).toBe(1_800_000);
    }
  });

  it("rechaza un monto vacío, cero o absurdo", () => {
    for (const amount of ["", "0", "abc", "999999999999"]) {
      expect(receiptSchema.safeParse({ amount, paidOn: "2026-10-01" }).success).toBe(false);
    }
  });

  it("exige una fecha con la forma que da el campo de fecha", () => {
    expect(receiptSchema.safeParse({ amount: "100", paidOn: "01/10/2026" }).success).toBe(false);
    expect(receiptSchema.safeParse({ amount: "100", paidOn: "" }).success).toBe(false);
    expect(receiptSchema.safeParse({ amount: "100", paidOn: "2026-10-01" }).success).toBe(true);
  });
});

describe("receiptVerdictSchema", () => {
  it("una confirmación no necesita motivo: el dinero llegó", () => {
    expect(receiptVerdictSchema.safeParse({ status: "confirmed" }).success).toBe(true);
  });

  /* Lo único que le dice al inquilino qué corregir es esa frase. */
  it("un rechazo sin motivo no pasa", () => {
    expect(receiptVerdictSchema.safeParse({ status: "rejected" }).success).toBe(false);
    expect(receiptVerdictSchema.safeParse({ status: "rejected", reason: "no" }).success).toBe(false);
    expect(
      receiptVerdictSchema.safeParse({ status: "rejected", reason: "El monto no coincide con el canon." })
        .success,
    ).toBe(true);
  });

  it("rechaza un estado que no existe", () => {
    expect(receiptVerdictSchema.safeParse({ status: "pending" }).success).toBe(false);
  });
});
