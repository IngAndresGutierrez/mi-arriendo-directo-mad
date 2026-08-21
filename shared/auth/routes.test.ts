/**
 * Tests del guardián de redirecciones. Vive junto a `routes.ts` porque es lo que prueba:
 * `/` es el login, así que aceptarlo como destino sería un bucle infinito.
 */
import { describe, expect, it } from "vitest";

import { HOME_ROUTE, safeRedirect } from "./routes";

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
