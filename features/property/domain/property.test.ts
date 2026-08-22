/**
 * Tests for the pure pieces of the property domain: the slug that shows up in a shared link,
 * and the id hidden at its end.
 */
import { describe, expect, it } from "vitest";

import { propertyIdFromSlug, propertySlug } from "./property";

describe("propertySlug", () => {
  it("builds a readable slug from the title and the city", () => {
    expect(propertySlug("Apartamento luminoso en Palermo", "Manizales")).toBe(
      "apartamento-luminoso-en-palermo-manizales",
    );
  });

  it("folds accents instead of dropping the letters", () => {
    expect(propertySlug("Apartaestudio céntrico", "Chinchiná")).toBe(
      "apartaestudio-centrico-chinchina",
    );
  });

  it("collapses punctuation and spacing into single hyphens", () => {
    expect(propertySlug("Casa   grande, ¡con patio!", "Cali")).toBe("casa-grande-con-patio-cali");
  });

  it("never ends in a hyphen, even when the cut lands on one", () => {
    const slug = propertySlug("a".repeat(68), "Manizales");
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(70);
  });

  it("survives a title with nothing sluggable", () => {
    expect(propertySlug("¿?!", "Cali")).toBe("cali");
  });
});

describe("propertyIdFromSlug", () => {
  const id = "7o9zNycRhK7OTouP1Gwc";

  it("takes the id from the end of a slug", () => {
    expect(propertyIdFromSlug(`apartamento-en-palermo-manizales-${id}`)).toBe(id);
  });

  it("accepts a segment that is only the id", () => {
    expect(propertyIdFromSlug(id)).toBe(id);
  });

  it("rejects a segment with no id, instead of guessing", () => {
    expect(propertyIdFromSlug("apartamento-en-palermo")).toBeNull();
    expect(propertyIdFromSlug("")).toBeNull();
  });

  it("rejects a token of the wrong length: ids are exactly twenty characters", () => {
    expect(propertyIdFromSlug("casa-abc123")).toBeNull();
    expect(propertyIdFromSlug(`casa-${id}x`)).toBeNull();
  });
});
