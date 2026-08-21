/**
 * Tests for the access schemas.
 *
 * A model of the "unit" level the `mad-feature` skill describes: every non-trivial rule
 * has a valid case and an invalid one.
 */
import { describe, expect, it } from "vitest";

import { emailSchema, loginSchema, PASSWORD_REQUIREMENTS, signupSchema } from "./auth";

describe("loginSchema", () => {
  it("normalizes the email to lowercase and trims it", () => {
    const r = loginSchema.parse({ email: "  Andres@Ejemplo.COM ", password: "ClaveSegura1" });
    expect(r.email).toBe("andres@ejemplo.com");
  });

  it("rejects a malformed email", () => {
    const r = loginSchema.safeParse({ email: "no-es-correo", password: "ClaveSegura1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Ingresa un correo válido");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "corta1" }).success).toBe(false);
  });

  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "ClaveSegura1" }).success).toBe(
      true,
    );
  });
});

describe("signupSchema", () => {
  it.each([
    ["with no digit", "solotexto"],
    ["with no letter", "12345678"],
    ["too short", "Abc1"],
  ])("rejects a password %s", (_case, password) => {
    expect(signupSchema.safeParse({ password }).success).toBe(false);
  });

  it("accepts a password with a letter, a digit and 8+ characters", () => {
    expect(signupSchema.safeParse({ password: "ClaveSegura2026" }).success).toBe(true);
  });

  it("counts accented letters and ñ as letters", () => {
    expect(signupSchema.safeParse({ password: "contraseña1" }).success).toBe(true);
  });

  it("the UI checklist matches what the schema validates", () => {
    for (const password of ["solotexto", "12345678", "Abc1", "ClaveSegura2026"]) {
      const allMet = PASSWORD_REQUIREMENTS.every((requirement) => requirement.isMet(password));
      expect(allMet).toBe(signupSchema.safeParse({ password }).success);
    }
  });
});

describe("emailSchema", () => {
  it("asks for the email only", () => {
    expect(emailSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(emailSchema.safeParse({ email: "" }).success).toBe(false);
  });
});
