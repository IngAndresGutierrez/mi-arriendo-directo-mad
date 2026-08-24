import { describe, expect, it } from "vitest";

import { deleteAccountSchema, ERASURE_CONFIRMATION } from "./erasure";

describe("deleteAccountSchema", () => {
  it("accepts the word", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: ERASURE_CONFIRMATION }).success).toBe(true);
  });

  /*
   * "eliminar " is the same intention. Rejecting it would be pedantry dressed up as safety, and
   * the person who typed it would go and write to support instead.
   */
  it("forgives case and surrounding space", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "  eliminar " }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "Eliminar" }).success).toBe(true);
  });

  it("rejects an empty confirmation", () => {
    const r = deleteAccountSchema.safeParse({ confirmation: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(`Escribe ${ERASURE_CONFIRMATION} para confirmar`);
  });

  it("rejects anything else", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "sí" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "borrar" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "ELIMINAR MI CUENTA" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: null }).success).toBe(false);
  });

  /* Accent-free and uppercase so it is typable on a phone without hunting for a long-press. */
  it("is a word anybody can type", () => {
    expect(ERASURE_CONFIRMATION).toMatch(/^[A-Z]+$/);
  });
});
