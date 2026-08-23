import { describe, expect, it } from "vitest";

import { contractNoteSchema } from "./contract";

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

  /* `FormData.get` returns `null` for an absent field, and the action passes it straight in. */
  it("refuses a null note rather than coercing it", () => {
    expect(contractNoteSchema.safeParse({ note: null }).success).toBe(false);
  });
});
