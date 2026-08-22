import { describe, expect, it } from "vitest";

import { isSidebarCollapsed, sidebarCookieValue } from "./sidebar-state";

describe("isSidebarCollapsed", () => {
  it("collapses when nothing was ever stored", () => {
    expect(isSidebarCollapsed(undefined)).toBe(true);
  });

  it("expands only on the exact stored value", () => {
    expect(isSidebarCollapsed("expanded")).toBe(false);
    expect(isSidebarCollapsed("collapsed")).toBe(true);
  });

  // A cookie is user input: anything can arrive in it, and the safe reading is the default.
  it("collapses on a value it does not recognise", () => {
    expect(isSidebarCollapsed("")).toBe(true);
    expect(isSidebarCollapsed("Expanded")).toBe(true);
    expect(isSidebarCollapsed("true")).toBe(true);
  });

  it("round-trips what it writes", () => {
    expect(isSidebarCollapsed(sidebarCookieValue(true))).toBe(true);
    expect(isSidebarCollapsed(sidebarCookieValue(false))).toBe(false);
  });
});
