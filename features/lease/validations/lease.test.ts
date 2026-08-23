import { describe, expect, it } from "vitest";

import { canonReceiptSchema, canonVerdictSchema, periodIdSchema } from "./lease";

describe("canonReceiptSchema", () => {
  it("accepts what the tenant declares", () => {
    const parsed = canonReceiptSchema.parse({
      amount: "1.800.000",
      paidOn: "2026-10-14",
      note: "Transferencia desde Bancolombia",
    });

    expect(parsed.amount).toBe(1_800_000);
    expect(parsed.paidOn).toBe("2026-10-14");
  });

  it("drops the separators a money field shows while it is typed", () => {
    expect(canonReceiptSchema.parse({ amount: "$ 1.800.000", paidOn: "2026-10-14" }).amount).toBe(
      1_800_000,
    );
  });

  it("refuses an amount of nothing", () => {
    expect(canonReceiptSchema.safeParse({ amount: "0", paidOn: "2026-10-14" }).success).toBe(false);
    expect(canonReceiptSchema.safeParse({ amount: "", paidOn: "2026-10-14" }).success).toBe(false);
  });

  it("refuses a date that is not one", () => {
    expect(canonReceiptSchema.safeParse({ amount: "1800000", paidOn: "14/10/2026" }).success).toBe(
      false,
    );
  });

  it("defaults the note, so the stored shape never carries `undefined`", () => {
    expect(canonReceiptSchema.parse({ amount: "1800000", paidOn: "2026-10-14" }).note).toBe("");
  });
});

describe("periodIdSchema", () => {
  it("accepts a month", () => {
    expect(periodIdSchema.parse("2026-09")).toBe("2026-09");
  });

  /*
   * Se convierte en un **id de documento**: un valor con una barra dentro apuntaría a otra ruta que
   * la que quien llama cree estar escribiendo.
   */
  it("refuses anything that could address another path", () => {
    expect(periodIdSchema.safeParse("2026-09/../../users").success).toBe(false);
    expect(periodIdSchema.safeParse("../periods").success).toBe(false);
  });

  it("refuses a month that does not exist", () => {
    expect(periodIdSchema.safeParse("2026-13").success).toBe(false);
    expect(periodIdSchema.safeParse("2026-00").success).toBe(false);
    expect(periodIdSchema.safeParse("2026-9").success).toBe(false);
  });
});

describe("canonVerdictSchema", () => {
  it("confirms with nothing else", () => {
    expect(canonVerdictSchema.parse({ status: "confirmed" })).toEqual({ status: "confirmed" });
  });

  it("requires a reason to reject, because the tenant has to know what to fix", () => {
    expect(canonVerdictSchema.safeParse({ status: "rejected" }).success).toBe(false);
    expect(canonVerdictSchema.safeParse({ status: "rejected", reason: "no" }).success).toBe(false);
    expect(
      canonVerdictSchema.safeParse({ status: "rejected", reason: "Llegaron $200.000 de menos." })
        .success,
    ).toBe(true);
  });
});
