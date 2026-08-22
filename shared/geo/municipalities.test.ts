/**
 * The municipality table is generated from DANE data, so these tests guard the shape and the
 * two names that had to be adapted to the department labels this repo already stores.
 */
import { describe, expect, it } from "vitest";

import { DEPARTMENTS } from "./colombia";
import { isMunicipalityOf, MUNICIPALITIES_BY_DEPARTMENT, municipalitiesOf } from "./municipalities";

describe("MUNICIPALITIES_BY_DEPARTMENT", () => {
  it("covers every department, with no empty one", () => {
    for (const department of DEPARTMENTS) {
      expect(municipalitiesOf(department).length).toBeGreaterThan(0);
    }
  });

  it("holds the 1.122 municipalities DANE lists", () => {
    const total = Object.values(MUNICIPALITIES_BY_DEPARTMENT).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(1122);
  });

  it("keeps each list sorted and free of duplicates", () => {
    for (const department of DEPARTMENTS) {
      const cities = municipalitiesOf(department);
      expect(new Set(cities).size).toBe(cities.length);
      expect([...cities].sort((a, b) => a.localeCompare(b, "es"))).toEqual([...cities]);
    }
  });

  it("names the special cases the way the product does", () => {
    expect(municipalitiesOf("Bogotá D.C.")).toEqual(["Bogotá"]);
    expect(municipalitiesOf("San Andrés y Providencia")).toContain("San Andrés");
  });
});

describe("isMunicipalityOf", () => {
  it("accepts a real pair", () => {
    expect(isMunicipalityOf("Manizales", "Caldas")).toBe(true);
  });

  it("rejects the right city in the wrong department", () => {
    expect(isMunicipalityOf("Manizales", "Antioquia")).toBe(false);
  });

  it("is case sensitive: the value stored has to be the canonical one", () => {
    expect(isMunicipalityOf("manizales", "Caldas")).toBe(false);
  });
});
