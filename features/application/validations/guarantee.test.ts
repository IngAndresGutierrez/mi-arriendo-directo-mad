import { describe, expect, it } from "vitest";

import { guaranteePolicySchema } from "./guarantee";

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
