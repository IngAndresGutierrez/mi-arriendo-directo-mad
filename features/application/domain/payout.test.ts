import { describe, expect, it } from "vitest";

import {
  firstPaymentBlocker,
  firstPaymentBlockerMessage,
  firstPaymentState,
  payoutShape,
  payoutSummary,
  receiptFileProblem,
  verdictApplies,
  PAYOUT_METHODS,
  RECEIPT_MAX_BYTES,
  type FirstPayment,
  type PaymentReceipt,
  type Payout,
  type ReceiptVerdict,
} from "./payout";

const payout = (overrides: Partial<Payout> = {}): Payout => ({
  method: "nequi",
  phone: "+573001234567",
  key: "",
  accountType: "",
  accountNumber: "",
  bankName: "",
  holderName: "Marta Propietaria Gómez",
  holderDocument: "Cédula de ciudadanía 43112233",
  note: "",
  ...overrides,
});

const receipt = (uploadedAt = "2026-10-01T15:00:00.000Z"): PaymentReceipt => ({
  path: "payments/abc/comprobante.png",
  fileName: "comprobante.png",
  contentType: "image/png",
  bytes: 120_000,
  uploadedAt,
  amount: 1_800_000,
  paidOn: "2026-10-01",
  note: "",
});

const verdict = (
  status: ReceiptVerdict["status"],
  at = "2026-10-01T16:00:00.000Z",
): ReceiptVerdict => ({ status, at, reason: status === "rejected" ? "El monto no coincide." : "" });

describe("payoutShape", () => {
  it("pide teléfono a las billeteras", () => {
    for (const method of ["nequi", "daviplata"] as const) {
      expect(payoutShape(method)).toEqual({
        phone: true,
        key: false,
        account: false,
        bankName: false,
        holderDocument: false,
      });
    }
  });

  it("pide la llave a Bre-B", () => {
    expect(payoutShape("breb").key).toBe(true);
    expect(payoutShape("breb").account).toBe(false);
  });

  it("pide cuenta a los bancos, y el nombre solo al que no conocemos", () => {
    for (const method of ["bancolombia", "davivienda"] as const) {
      expect(payoutShape(method)).toEqual({
        phone: false,
        key: false,
        account: true,
        bankName: false,
        holderDocument: true,
      });
    }
    expect(payoutShape("other_bank")).toEqual({
      phone: false,
      key: false,
      account: true,
      bankName: true,
      holderDocument: true,
    });
  });

  /*
   * El documento del titular **solo donde se transfiere a una cuenta**: a un Nequi, un Daviplata o
   * una llave Bre-B se paga con el número o la llave, y la app enseña el nombre de quien recibe
   * antes de confirmar. Pedirlo ahí era guardar una cédula que nadie al otro lado usa, y el dato que
   * no se guarda es el que no se puede filtrar.
   */
  it("no pide el documento del titular donde nadie lo pide", () => {
    for (const method of ["nequi", "daviplata", "breb"] as const) {
      expect(payoutShape(method).holderDocument).toBe(false);
    }
    for (const method of ["bancolombia", "davivienda", "other_bank"] as const) {
      expect(payoutShape(method).holderDocument).toBe(true);
    }
  });

  /* Y va con la cuenta, siempre: son la misma pregunta del banco. */
  it("el documento acompaña a la cuenta y a nada más", () => {
    for (const method of PAYOUT_METHODS) {
      const shape = payoutShape(method);
      expect(shape.holderDocument).toBe(shape.account);
    }
  });

  /* Un método nuevo sin su forma caería en el `default` y pediría cuenta: mejor saberlo aquí. */
  it("cubre todos los métodos declarados", () => {
    for (const method of PAYOUT_METHODS) {
      const shape = payoutShape(method);
      expect(shape.phone || shape.key || shape.account).toBe(true);
    }
  });
});

describe("payoutSummary", () => {
  it("resume una billetera con su teléfono", () => {
    expect(payoutSummary(payout())).toBe("Nequi · +573001234567");
  });

  it("resume Bre-B con la llave, cualquiera de sus formas", () => {
    for (const key of ["@marta2025", "+573001234567", "marta@ejemplo.test", "43112233"]) {
      expect(payoutSummary(payout({ method: "breb", phone: "", key }))).toBe(`Llave Bre-B · ${key}`);
    }
  });

  it("resume un banco con el tipo y el número", () => {
    const bank = payout({
      method: "bancolombia",
      phone: "",
      accountType: "savings",
      accountNumber: "12345678901",
    });
    expect(payoutSummary(bank)).toBe("Bancolombia · Ahorros · 12345678901");
  });

  /* "Otro banco" lleva su nombre en un campo, así que el resumen tiene que usarlo y no la etiqueta. */
  it("usa el nombre escrito cuando es otro banco", () => {
    const other = payout({
      method: "other_bank",
      phone: "",
      bankName: "Banco de Occidente",
      accountType: "checking",
      accountNumber: "998877",
    });
    expect(payoutSummary(other)).toBe("Banco de Occidente · Corriente · 998877");
  });
});

describe("firstPaymentState", () => {
  it("es `no_payout` mientras el propietario no diga por dónde", () => {
    expect(firstPaymentState(null)).toBe("no_payout");
    expect(firstPaymentState({ payout: null, receipt: null, verdict: null })).toBe("no_payout");
  });

  it("es `awaiting_receipt` con los datos puestos y sin comprobante", () => {
    expect(firstPaymentState({ payout: payout(), receipt: null, verdict: null })).toBe("awaiting_receipt");
  });

  it("es `awaiting_confirmation` con comprobante y sin veredicto", () => {
    expect(firstPaymentState({ payout: payout(), receipt: receipt(), verdict: null })).toBe(
      "awaiting_confirmation",
    );
  });

  it("es `confirmed` solo cuando el propietario dice que el dinero llegó", () => {
    const payment: FirstPayment = {
      payout: payout(),
      receipt: receipt(),
      verdict: verdict("confirmed"),
    };
    expect(firstPaymentState(payment)).toBe("confirmed");
    expect(firstPaymentBlocker(payment)).toBeNull();
  });

  it("es `rejected` cuando lo rechazó", () => {
    expect(
      firstPaymentState({ payout: payout(), receipt: receipt(), verdict: verdict("rejected") }),
    ).toBe("rejected");
  });
});

/*
 * La misma idea que la firma atada al hash del documento: un veredicto sobre un comprobante que ya
 * fue reemplazado juzga algo que no existe. Sin esto, subir el comprobante corregido dejaría el
 * "rechazado" viejo en pantalla y nada que arreglar.
 */
describe("verdictApplies", () => {
  it("un veredicto anterior al comprobante nuevo deja de contar", () => {
    const payment: FirstPayment = {
      payout: payout(),
      receipt: receipt("2026-10-02T10:00:00.000Z"),
      verdict: verdict("rejected", "2026-10-01T16:00:00.000Z"),
    };
    expect(verdictApplies(payment)).toBe(false);
    expect(firstPaymentState(payment)).toBe("awaiting_confirmation");
  });

  it("un veredicto posterior sí cuenta", () => {
    expect(
      verdictApplies({
        payout: payout(),
        receipt: receipt("2026-10-01T15:00:00.000Z"),
        verdict: verdict("confirmed", "2026-10-01T16:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("y uno exactamente a la misma hora también, que es el caso del mismo tick", () => {
    expect(
      verdictApplies({
        payout: payout(),
        receipt: receipt("2026-10-01T15:00:00.000Z"),
        verdict: verdict("confirmed", "2026-10-01T15:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("sin comprobante no hay veredicto que aplicar", () => {
    expect(verdictApplies({ payout: payout(), receipt: null, verdict: verdict("confirmed") })).toBe(false);
  });
});

describe("firstPaymentBlockerMessage", () => {
  it("le dice a cada parte de quién es el turno", () => {
    expect(firstPaymentBlockerMessage("awaiting_receipt", false)).toMatch(/Paga el primer canon/);
    expect(firstPaymentBlockerMessage("awaiting_receipt", true)).toMatch(/Falta que el inquilino/);
    expect(firstPaymentBlockerMessage("awaiting_confirmation", true)).toMatch(/Revisa el comprobante/);
    expect(firstPaymentBlockerMessage("awaiting_confirmation", false)).toMatch(/está revisando/);
  });

  it("no dice nada cuando nada bloquea", () => {
    expect(firstPaymentBlockerMessage(null, true)).toBeNull();
  });
});

describe("receiptFileProblem", () => {
  it("acepta una captura, que es el caso normal", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(receiptFileProblem({ type, size: 200_000 })).toBeNull();
    }
  });

  it("acepta el PDF que dan algunos bancos", () => {
    expect(receiptFileProblem({ type: "application/pdf", size: 200_000 })).toBeNull();
  });

  it("rechaza cualquier otra cosa", () => {
    expect(receiptFileProblem({ type: "application/zip", size: 1000 })).toMatch(/imagen/);
    expect(receiptFileProblem({ type: "", size: 1000 })).toMatch(/imagen/);
  });

  it("rechaza el vacío y lo que pasa del tope, y acepta justo el tope", () => {
    expect(receiptFileProblem({ type: "image/png", size: 0 })).toMatch(/vacío/);
    expect(receiptFileProblem({ type: "image/png", size: RECEIPT_MAX_BYTES + 1 })).toMatch(/8 MB/);
    expect(receiptFileProblem({ type: "image/png", size: RECEIPT_MAX_BYTES })).toBeNull();
  });
});
