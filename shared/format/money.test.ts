import { describe, expect, it } from "vitest";

import { formatCOP, groupThousands, MAX_AMOUNT_DIGITS, monthlyTotal, toDigits } from "./money";

describe("formatCOP", () => {
  it("groups thousands in Colombian format, with no cents", () => {
    expect(formatCOP(1_800_000)).toContain("1.800.000");
    expect(formatCOP(1_800_000)).not.toContain(",");
  });

  it("renders zero rather than hiding it", () => {
    expect(formatCOP(0)).toContain("0");
  });
});

describe("monthlyTotal", () => {
  it("is what leaves the tenant's account: rent plus admin fee", () => {
    expect(monthlyTotal(1_800_000, 250_000)).toBe(2_050_000);
  });

  it("works with no admin fee", () => {
    expect(monthlyTotal(1_800_000, 0)).toBe(1_800_000);
  });
});

describe("toDigits", () => {
  it("keeps only digits, so a formatted value can round-trip", () => {
    expect(toDigits("1.800.000")).toBe("1800000");
    expect(toDigits("$ 1.800.000 COP")).toBe("1800000");
  });

  it("drops a pasted minus sign instead of storing a negative amount", () => {
    expect(toDigits("-500000")).toBe("500000");
  });

  it("caps the length: a stray keystroke cannot make a trillion-peso rent", () => {
    expect(toDigits("9".repeat(20))).toHaveLength(MAX_AMOUNT_DIGITS);
  });

  it("returns empty for text with no digits", () => {
    expect(toDigits("abc")).toBe("");
  });
});

describe("groupThousands", () => {
  it("formats as you type", () => {
    expect(groupThousands("1")).toBe("1");
    expect(groupThousands("18")).toBe("18");
    expect(groupThousands("1800")).toBe("1.800");
    expect(groupThousands("1800000")).toBe("1.800.000");
  });

  it("stays empty when empty, so the placeholder survives", () => {
    expect(groupThousands("")).toBe("");
  });

  it("shows an explicit zero: 0 means 'no admin fee', which is information", () => {
    expect(groupThousands("0")).toBe("0");
  });
});
