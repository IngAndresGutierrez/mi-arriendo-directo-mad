/**
 * Tests for the redirect guard. It lives next to `routes.ts` because that is what it
 * covers: `/` is the login, so accepting it as a destination would loop forever.
 */
import { describe, expect, it } from "vitest";

import { HOME_ROUTE, safeRedirect } from "./routes";

describe("safeRedirect", () => {
  it("accepts an internal path", () => {
    expect(safeRedirect("/panel/inmuebles")).toBe("/panel/inmuebles");
  });

  it.each([
    ["absolute URL", "https://evil.example.com"],
    ["protocol-relative", "//evil.example.com"],
    ["path without a leading slash", "evil.example.com"],
    ["undefined", undefined],
    ["array (repeated parameter)", ["/a", "/b"]],
  ])("blocks %s and falls back to the default destination", (_case, value) => {
    expect(safeRedirect(value as string | string[] | undefined)).toBe(HOME_ROUTE);
  });

  it.each(["/", "/registro", "/recuperar"])(
    "does not allow %s as a destination: it would be a redirect loop",
    (route) => {
      expect(safeRedirect(route)).toBe(HOME_ROUTE);
    },
  );

  it("does not allow it disguised with a querystring either", () => {
    expect(safeRedirect("/registro?x=1")).toBe(HOME_ROUTE);
    expect(safeRedirect("/#algo")).toBe(HOME_ROUTE);
  });

  /*
   * The four rejected paths exist in two languages now, and the reason each one is rejected does not
   * care which. Before `splitLocale` was in the comparison these all passed straight through: the
   * set holds canonical Spanish paths, so `/en/ingresar` matched nothing and the English login
   * happily redirected to itself. Weakening that line back to a literal `AUTH_ROUTES.has(pathname)`
   * turns every case below red, which is what makes this a test rather than a restatement.
   */
  it.each(["/en", "/en/ingresar", "/en/registro", "/en/recuperar"])(
    "rejects %s, the English spelling of a route it already rejected in Spanish",
    (route) => {
      expect(safeRedirect(route)).toBe(HOME_ROUTE);
    },
  );

  it("rejects an English auth route carrying a querystring too", () => {
    expect(safeRedirect("/en/registro?next=/en/inicio")).toBe(HOME_ROUTE);
  });

  /*
   * The guard decides *whether* to honour the request, never where it points. An English portal is a
   * legitimate destination and must come back with its prefix intact — stripping it here would sign
   * somebody in on the English side and drop them into the Spanish product.
   */
  it("returns a legitimate localised path untouched", () => {
    expect(safeRedirect("/en/inicio")).toBe("/en/inicio");
    expect(safeRedirect("/en/contratos/abc")).toBe("/en/contratos/abc");
  });
});
