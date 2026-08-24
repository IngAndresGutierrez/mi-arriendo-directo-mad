/**
 * Tests for the pure pieces of the property domain: the slug that shows up in a shared link,
 * the id hidden at its end, and the blunting the public map depends on.
 */
import { describe, expect, it } from "vitest";

import { distanceMeters, isInColombia, type GeoPoint } from "@/shared/geo/point";

import {
  APPROX_RADIUS_M,
  LOCATION_GRID,
  approximateLocation,
  propertyIdFromSlug,
  propertySlug,
} from "./property";

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

describe("approximateLocation", () => {
  /**
   * A spread of real Colombian points: the four corners of the country, the two biggest cities
   * and San Andrés. The guarantee has to hold at every latitude, because a degree of longitude
   * shrinks as you go north and the grid does not.
   */
  const ACROSS_THE_COUNTRY: readonly GeoPoint[] = [
    { lat: 5.06786, lng: -75.49123 }, // Manizales, Palermo
    { lat: 4.71105, lng: -74.07209 }, // Bogotá
    { lat: 6.24478, lng: -75.5812 }, // Medellín
    { lat: 11.54444, lng: -72.90722 }, // Riohacha, the north
    { lat: -4.21528, lng: -69.94056 }, // Leticia, the south
    { lat: 12.58472, lng: -81.70056 }, // San Andrés
    { lat: 1.21361, lng: -77.28111 }, // Pasto
  ];

  it("is deterministic: the same point always blurs to the same cell", () => {
    for (const point of ACROSS_THE_COUNTRY) {
      expect(approximateLocation(point)).toEqual(approximateLocation(point));
    }
  });

  it("keeps the property inside the radius the page draws — everywhere in Colombia", () => {
    // This is the whole promise of the circle. If `LOCATION_GRID` grows without
    // `APPROX_RADIUS_M`, this fails before a tenant is shown a circle their rental is not in.
    for (const point of ACROSS_THE_COUNTRY) {
      expect(distanceMeters(point, approximateLocation(point))).toBeLessThanOrEqual(
        APPROX_RADIUS_M,
      );
    }
  });

  it("actually blurs: the published point is never the one that was placed", () => {
    for (const point of ACROSS_THE_COUNTRY) {
      const approx = approximateLocation(point);
      expect(approx.lat).not.toBe(point.lat);
      expect(approx.lng).not.toBe(point.lng);
      // ...and it moved by something on the order of the grid, not by rounding noise.
      expect(distanceMeters(point, approx)).toBeGreaterThan(1);
    }
  });

  it("maps every point in a cell onto one coordinate, which is what hides the address", () => {
    // Two doors 200 m apart in the same cell must publish the same thing, or the difference
    // between them is information about where each one is.
    const base = { lat: 5.0705, lng: -75.5105 };
    const neighbour = { lat: 5.074, lng: -75.511 };
    expect(distanceMeters(base, neighbour)).toBeGreaterThan(100);
    expect(approximateLocation(base)).toEqual(approximateLocation(neighbour));
  });

  it("lands on the middle of the cell, never on its edge", () => {
    // A snapped coordinate is always an odd multiple of half the grid: `x.xx25` or `x.xx75`.
    for (const point of ACROSS_THE_COUNTRY) {
      const approx = approximateLocation(point);
      for (const value of [approx.lat, approx.lng]) {
        const cells = (value - LOCATION_GRID / 2) / LOCATION_GRID;
        expect(Math.abs(cells - Math.round(cells))).toBeLessThan(1e-6);
      }
    }
  });

  it("does not push a coordinate out of the country", () => {
    for (const point of ACROSS_THE_COUNTRY) {
      expect(isInColombia(approximateLocation(point))).toBe(true);
    }
  });

  it("blurs the negative side of zero the same way", () => {
    // `Math.floor` on a negative number rounds away from zero, which is what makes the cells
    // continuous across the equator instead of twice as wide over it. Colombia straddles it.
    expect(approximateLocation({ lat: -0.001, lng: -70.001 }).lat).toBeLessThan(0);
    expect(approximateLocation({ lat: 0.001, lng: -70.001 }).lat).toBeGreaterThan(0);
    expect(distanceMeters({ lat: -0.001, lng: -70 }, approximateLocation({ lat: -0.001, lng: -70 })))
      .toBeLessThanOrEqual(APPROX_RADIUS_M);
  });
});
