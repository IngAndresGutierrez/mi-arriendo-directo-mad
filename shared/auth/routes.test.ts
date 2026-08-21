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
});
