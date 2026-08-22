import { describe, expect, it } from "vitest";

import { parseCityFilter } from "./catalog";

describe("parseCityFilter", () => {
  it("accepts a city and returns the catalog's spelling", () => {
    expect(parseCityFilter("Manizales")).toBe("Manizales");
    expect(parseCityFilter("medellin")).toBe("Medellín");
  });

  it("treats a missing or empty parameter as no filter", () => {
    expect(parseCityFilter(undefined)).toBeNull();
    expect(parseCityFilter("")).toBeNull();
    expect(parseCityFilter("   ")).toBeNull();
  });

  // It goes into a Firestore `where`: an unknown value must not become a query.
  it("rejects anything that is not a municipality", () => {
    expect(parseCityFilter("Narnia")).toBeNull();
    expect(parseCityFilter("../../etc/passwd")).toBeNull();
    // A department is not a city. `Antioquia`, not `Caldas`: there *is* a town called Caldas.
    expect(parseCityFilter("Antioquia")).toBeNull();
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseCityFilter(["Manizales", "Pereira"])).toBe("Manizales");
    expect(parseCityFilter([])).toBeNull();
  });
});
