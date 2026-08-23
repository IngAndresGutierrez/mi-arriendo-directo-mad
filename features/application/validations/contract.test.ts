import { describe, expect, it } from "vitest";

import { OTP_LENGTH, SIGNATURE_CLAUSE_VERSION } from "../domain/contract";
import {
  contractNoteSchema,
  signatureConfirmSchema,
  signatureRequestSchema,
  signatureSpotsSchema,
  signatureStrokeSchema,
} from "./contract";

describe("contractNoteSchema", () => {
  it("accepts no note at all", () => {
    const parsed = contractNoteSchema.safeParse({ note: "" });
    expect(parsed.success && parsed.data.note).toBe("");
  });

  it("trims what was typed", () => {
    const parsed = contractNoteSchema.safeParse({ note: "  Firmado el 20  " });
    expect(parsed.success && parsed.data.note).toBe("Firmado el 20");
  });

  it("refuses one that is too long", () => {
    expect(contractNoteSchema.safeParse({ note: "x".repeat(301) }).success).toBe(false);
  });

  /* `FormData.get` returns `null` for an absent field. */
  it("refuses a null note rather than coercing it", () => {
    expect(contractNoteSchema.safeParse({ note: null }).success).toBe(false);
  });
});

describe("signatureRequestSchema", () => {
  const valid = { channel: "email", acceptedClause: true, clauseVersion: SIGNATURE_CLAUSE_VERSION };

  it("accepts a request on any verified channel with the clause accepted", () => {
    for (const channel of ["email", "whatsapp", "sms"]) {
      expect(signatureRequestSchema.safeParse({ ...valid, channel }).success).toBe(true);
    }
  });

  /*
   * Lo que sostiene la presunción del Decreto 2364 es que las partes pactaron el método. Sin la
   * aceptación no hay acuerdo, así que no hay nada que presumir — y no se puede pedir el código.
   */
  it("refuses it without accepting the clause", () => {
    expect(signatureRequestSchema.safeParse({ ...valid, acceptedClause: false }).success).toBe(false);
  });

  /*
   * El esquema dice qué canales existen; *cuáles están disponibles* lo decide el servidor con
   * `availableSignatureChannels`, porque depende de las credenciales configuradas. Son dos
   * preguntas distintas y esta es la primera.
   */
  it("refuses a channel this product does not have at all", () => {
    for (const channel of ["telegram", "paloma", ""]) {
      expect(signatureRequestSchema.safeParse({ ...valid, channel }).success).toBe(false);
    }
  });

  /* Una pestaña vieja no debe registrar consentimiento a una redacción que ya no existe. */
  it("refuses a clause version the server no longer serves", () => {
    expect(signatureRequestSchema.safeParse({ ...valid, clauseVersion: 0 }).success).toBe(false);
    expect(
      signatureRequestSchema.safeParse({ ...valid, clauseVersion: SIGNATURE_CLAUSE_VERSION + 1 }).success,
    ).toBe(false);
  });
});

describe("signatureConfirmSchema", () => {
  const code = "1".repeat(OTP_LENGTH);

  it("accepts the code as it is typed", () => {
    expect(signatureConfirmSchema.safeParse({ code }).success).toBe(true);
  });

  it("tolerates the whitespace of a paste", () => {
    const parsed = signatureConfirmSchema.safeParse({ code: `  ${code} ` });
    expect(parsed.success && parsed.data.code).toBe(code);
  });

  it("refuses the wrong length", () => {
    expect(signatureConfirmSchema.safeParse({ code: code.slice(1) }).success).toBe(false);
    expect(signatureConfirmSchema.safeParse({ code: code + "1" }).success).toBe(false);
  });

  /* Nada que no sean dígitos llega a la comparación: un intento menos quemado por un dedazo. */
  it("refuses anything that is not digits", () => {
    expect(signatureConfirmSchema.safeParse({ code: "12a456" }).success).toBe(false);
    expect(signatureConfirmSchema.safeParse({ code: "      " }).success).toBe(false);
    expect(signatureConfirmSchema.safeParse({ code: "" }).success).toBe(false);
    expect(signatureConfirmSchema.safeParse({ code: null }).success).toBe(false);
  });
});

describe("signatureSpotsSchema", () => {
  const spot = (party: string) => ({ party, page: 0, x: 0.1, y: 0.8, width: 0.28, height: 0.06 });

  it("accepts one spot per party", () => {
    expect(signatureSpotsSchema.safeParse({ spots: [spot("landlord"), spot("tenant")] }).success).toBe(true);
  });

  it("refuses a party with nowhere to sign", () => {
    expect(signatureSpotsSchema.safeParse({ spots: [spot("landlord")] }).success).toBe(false);
    expect(signatureSpotsSchema.safeParse({ spots: [] }).success).toBe(false);
  });

  /* Dos recuadros para la misma parte estamparían el mismo trazo dos veces. */
  it("refuses two boxes for the same party", () => {
    expect(signatureSpotsSchema.safeParse({ spots: [spot("landlord"), spot("landlord")] }).success).toBe(false);
  });

  it("refuses geometry outside the page", () => {
    const bad = { ...spot("tenant"), x: 0.9, width: 0.28 };
    expect(signatureSpotsSchema.safeParse({ spots: [spot("landlord"), bad] }).success).toBe(false);
  });

  it("refuses a party that is not one of ours", () => {
    expect(signatureSpotsSchema.safeParse({ spots: [spot("landlord"), spot("codeudor")] }).success).toBe(false);
  });
});

describe("signatureStrokeSchema", () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

  it("accepts a PNG data URL", () => {
    expect(signatureStrokeSchema.safeParse(png).success).toBe(true);
  });

  /* El código es lo que firma: un contrato en foto no tiene dónde llevar el trazo. */
  it("accepts no stroke at all", () => {
    expect(signatureStrokeSchema.safeParse("").success).toBe(true);
    expect(signatureStrokeSchema.safeParse(undefined).success).toBe(true);
  });

  it("refuses anything that is not a PNG data URL", () => {
    expect(signatureStrokeSchema.safeParse("https://ejemplo.test/firma.png").success).toBe(false);
    expect(signatureStrokeSchema.safeParse("data:text/html;base64,PHNjcmlwdD4=").success).toBe(false);
    expect(signatureStrokeSchema.safeParse("data:image/svg+xml;base64,PHN2Zz4=").success).toBe(false);
  });

  it("refuses one too big to be a signature", () => {
    expect(signatureStrokeSchema.safeParse(`data:image/png;base64,${"A".repeat(200_001)}`).success).toBe(false);
  });
});
