import { describe, expect, it } from "vitest";

import { canonicalMunicipality, isMunicipalityOf, municipalitiesOf } from "./municipalities";

describe("municipalitiesOf", () => {
  it("returns the municipalities of a department, alphabetically", () => {
    const caldas = municipalitiesOf("Caldas");
    expect(caldas).toContain("Manizales");
    expect([...caldas]).toEqual([...caldas].sort((a, b) => a.localeCompare(b, "es")));
  });
});

describe("isMunicipalityOf", () => {
  it("accepts a real pair and rejects a mismatched one", () => {
    expect(isMunicipalityOf("Manizales", "Caldas")).toBe(true);
    expect(isMunicipalityOf("Manizales", "Antioquia")).toBe(false);
  });
});

describe("canonicalMunicipality", () => {
  it("returns the catalog's spelling for an exact name", () => {
    expect(canonicalMunicipality("Manizales")).toBe("Manizales");
  });

  // These URLs are typed and pasted by hand, often without accents.
  it("finds a name written without accents or casing", () => {
    expect(canonicalMunicipality("manizales")).toBe("Manizales");
    expect(canonicalMunicipality("MEDELLIN")).toBe("Medellín");
    // The municipality is `Bogotá`; `Bogotá D.C.` is the department that contains it.
    expect(canonicalMunicipality("bogota")).toBe("Bogotá");
  });

  // Nobody types the official name of these, and the filter must not answer "no listings".
  it("resolves the common name of a city whose official name is longer", () => {
    expect(canonicalMunicipality("  Cali  ")).toBe("Santiago de Cali");
    expect(canonicalMunicipality("Cartagena")).toBe("Cartagena de Indias");
    expect(canonicalMunicipality("mompós")).toBe("Santa Cruz de Mompox");
  });

  it("rejects a place that does not exist", () => {
    expect(canonicalMunicipality("Manizalez")).toBeNull();
    expect(canonicalMunicipality("")).toBeNull();
    expect(canonicalMunicipality("Bogotá; DROP TABLE")).toBeNull();
  });
});
