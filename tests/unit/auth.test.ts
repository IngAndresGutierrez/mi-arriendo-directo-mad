/**
 * Tests de los schemas de acceso y del guardián de redirecciones.
 *
 * Ejemplar del nivel "unitario" que describe la skill `mad-feature`: cada regla no trivial
 * tiene su caso válido y su caso inválido.
 */
import { describe, expect, it } from "vitest";

import { HOME_ROUTE, safeRedirect } from "@/lib/auth/routes";
import {
  emailSchema,
  loginSchema,
  PASSWORD_REQUIREMENTS,
  signupSchema,
} from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("normaliza el correo a minúsculas y sin espacios", () => {
    const r = loginSchema.parse({ email: "  Andres@Ejemplo.COM ", password: "ClaveSegura1" });
    expect(r.email).toBe("andres@ejemplo.com");
  });

  it("rechaza un correo con formato inválido", () => {
    const r = loginSchema.safeParse({ email: "no-es-correo", password: "ClaveSegura1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Ingresa un correo válido");
  });

  it("rechaza una contraseña de menos de 8 caracteres", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "corta1" }).success).toBe(false);
  });

  it("acepta credenciales válidas", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "ClaveSegura1" }).success).toBe(
      true,
    );
  });
});

describe("signupSchema", () => {
  it.each([
    ["sin número", "solotexto"],
    ["sin letra", "12345678"],
    ["muy corta", "Abc1"],
  ])("rechaza una contraseña %s", (_case, password) => {
    expect(signupSchema.safeParse({ password }).success).toBe(false);
  });

  it("acepta una contraseña con letra, número y 8+ caracteres", () => {
    expect(signupSchema.safeParse({ password: "ClaveSegura2026" }).success).toBe(true);
  });

  it("acepta letras acentuadas y ñ como letra", () => {
    expect(signupSchema.safeParse({ password: "contraseña1" }).success).toBe(true);
  });

  it("el checklist de la UI coincide con lo que valida el schema", () => {
    for (const password of ["solotexto", "12345678", "Abc1", "ClaveSegura2026"]) {
      const allMet = PASSWORD_REQUIREMENTS.every((requirement) => requirement.isMet(password));
      expect(allMet).toBe(signupSchema.safeParse({ password }).success);
    }
  });
});

describe("emailSchema", () => {
  it("solo pide el correo", () => {
    expect(emailSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(emailSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("safeRedirect", () => {
  it("acepta una ruta interna", () => {
    expect(safeRedirect("/panel/inmuebles")).toBe("/panel/inmuebles");
  });

  it.each([
    ["URL absoluta", "https://evil.example.com"],
    ["protocol-relative", "//evil.example.com"],
    ["ruta sin barra inicial", "evil.example.com"],
    ["undefined", undefined],
    ["array (parámetro repetido)", ["/a", "/b"]],
  ])("bloquea %s y cae al destino por defecto", (_case, value) => {
    expect(safeRedirect(value as string | string[] | undefined)).toBe(HOME_ROUTE);
  });

  it.each(["/", "/registro", "/recuperar"])(
    "no permite %s como destino: sería un bucle de redirección",
    (route) => {
      expect(safeRedirect(route)).toBe(HOME_ROUTE);
    },
  );

  it("tampoco lo permite disfrazado con querystring", () => {
    expect(safeRedirect("/registro?x=1")).toBe(HOME_ROUTE);
    expect(safeRedirect("/#algo")).toBe(HOME_ROUTE);
  });
});
