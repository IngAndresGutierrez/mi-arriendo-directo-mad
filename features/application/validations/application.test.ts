import { describe, expect, it } from "vitest";

import { applicationDetailsSchema, validateDesiredMoveIn } from "./application";

describe("applicationDetailsSchema", () => {
  const valid = { desiredMoveIn: "2026-09-01", leaseMonths: 12, message: "" };

  it("accepts the two lease terms this product rents on", () => {
    expect(applicationDetailsSchema.safeParse({ ...valid, leaseMonths: 6 }).success).toBe(true);
    expect(applicationDetailsSchema.safeParse({ ...valid, leaseMonths: 12 }).success).toBe(true);
  });

  it("rejects any other term", () => {
    expect(applicationDetailsSchema.safeParse({ ...valid, leaseMonths: 3 }).success).toBe(false);
    expect(applicationDetailsSchema.safeParse({ ...valid, leaseMonths: 24 }).success).toBe(false);
  });

  it("wants a calendar day, not free text", () => {
    expect(applicationDetailsSchema.safeParse({ ...valid, desiredMoveIn: "pronto" }).success).toBe(false);
    expect(applicationDetailsSchema.safeParse({ ...valid, desiredMoveIn: "01/09/2026" }).success).toBe(false);
  });

  it("caps the message", () => {
    expect(applicationDetailsSchema.safeParse({ ...valid, message: "a".repeat(601) }).success).toBe(false);
  });
});

describe("validateDesiredMoveIn", () => {
  /*
   * The reason this compares strings. On Vercel the clock is UTC: at 8 p.m. in Bogotá it is
   * already tomorrow there, and an instant comparison would reject "today" every night.
   */
  it("accepts today in Bogotá even while the server is already on the next day", () => {
    const lateInBogota = new Date("2026-09-02T02:00:00Z"); // 21:00 del 1 de septiembre en Bogotá
    expect(validateDesiredMoveIn("2026-09-01", lateInBogota)).toEqual({ ok: true });
  });

  it("accepts a future day and rejects a past one", () => {
    const now = new Date("2026-09-01T15:00:00Z");
    expect(validateDesiredMoveIn("2026-12-01", now)).toEqual({ ok: true });
    expect(validateDesiredMoveIn("2026-08-31", now).ok).toBe(false);
  });
});
