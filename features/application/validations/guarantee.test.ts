import { describe, expect, it } from "vitest";

import { guaranteePolicySchema, guaranteeProgressSchema, guaranteeRequestSchema } from "./guarantee";

describe("guaranteePolicySchema", () => {
  it("takes the number as the insurer writes it", () => {
    for (const policyNumber of ["AR-99123", "0012345678", "AR 99 123", "ARR/2026-118"]) {
      expect(guaranteePolicySchema.safeParse({ policyNumber }).success).toBe(true);
    }
  });

  it("rejects something that is not an identifier", () => {
    expect(guaranteePolicySchema.safeParse({ policyNumber: "AR" }).success).toBe(false);
    expect(guaranteePolicySchema.safeParse({ policyNumber: "la que me dieron\nayer" }).success).toBe(
      false,
    );
    expect(guaranteePolicySchema.safeParse({ policyNumber: "" }).success).toBe(false);
  });

  it("the note is optional and bounded", () => {
    expect(guaranteePolicySchema.parse({ policyNumber: "AR-1234" }).note).toBe("");
    expect(
      guaranteePolicySchema.safeParse({ policyNumber: "AR-1234", note: "x".repeat(301) }).success,
    ).toBe(false);
  });
});

describe("guaranteeProgressSchema", () => {
  const LINK =
    "https://ecomm.sura.co/seguros/hogar/arriendo/inquilino/resumen-proceso?quoteId=E0SGqCQ%2Bmoew";

  it("accepts Sura's link", () => {
    const parsed = guaranteeProgressSchema.safeParse({ tenantLink: LINK });
    expect(parsed.success).toBe(true);
  });

  it("trims the paste", () => {
    const parsed = guaranteeProgressSchema.safeParse({ tenantLink: `  ${LINK} ` });
    expect(parsed.success && parsed.data.tenantLink).toBe(LINK);
  });

  it("refuses a link that is not Sura's", () => {
    expect(guaranteeProgressSchema.safeParse({ tenantLink: "https://sura.co.evil.com/x" }).success).toBe(false);
  });

  /* Sin botón, un formulario vacío no debe escribir nada: guardaría un `requestedAt` falso. */
  it("refuses a save with neither a link nor a note", () => {
    expect(guaranteeProgressSchema.safeParse({ tenantLink: "", note: "" }).success).toBe(false);
  });

  it("accepts only a note: es como se dice \"ya la solicité, están estudiando\"", () => {
    const parsed = guaranteeProgressSchema.safeParse({ note: "Ya la solicité." });
    expect(parsed.success).toBe(true);
  });
});

describe("guaranteeRequestSchema", () => {
  it("allows marking it requested with no link yet", () => {
    const parsed = guaranteeRequestSchema.safeParse({ note: "" });
    expect(parsed.success && parsed.data.tenantLink).toBe("");
  });

  it("still refuses a foreign link when one is given", () => {
    expect(guaranteeRequestSchema.safeParse({ tenantLink: "http://ecomm.sura.co/x" }).success).toBe(false);
  });
});
