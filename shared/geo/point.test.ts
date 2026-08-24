import { describe, expect, it } from "vitest";

import {
  COLOMBIA_FALLBACK_CENTER,
  distanceMeters,
  formatPoint,
  isGeoPoint,
  isInColombia,
  roundPoint,
} from "./point";

describe("isGeoPoint", () => {
  it("accepts a real pair of degrees", () => {
    expect(isGeoPoint({ lat: 5.0678, lng: -75.4912 })).toBe(true);
  });

  it("rejects what actually arrives broken", () => {
    expect(isGeoPoint(null)).toBe(false);
    expect(isGeoPoint(undefined)).toBe(false);
    expect(isGeoPoint({})).toBe(false);
    // strings from a FormData that skipped its schema
    expect(isGeoPoint({ lat: "5.06", lng: "-75.49" })).toBe(false);
    expect(isGeoPoint({ lat: Number.NaN, lng: -75 })).toBe(false);
    expect(isGeoPoint({ lat: Number.POSITIVE_INFINITY, lng: -75 })).toBe(false);
    // out of the coordinate system altogether
    expect(isGeoPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isGeoPoint({ lat: 0, lng: 181 })).toBe(false);
  });
});

describe("isInColombia", () => {
  it("accepts cities across the country", () => {
    // Manizales, Bogotá, Leticia (the southern tip) and Riohacha (the northern one).
    for (const point of [
      { lat: 5.0689, lng: -75.5174 },
      { lat: 4.711, lng: -74.0721 },
      { lat: -4.2153, lng: -69.9406 },
      { lat: 11.5444, lng: -72.9072 },
    ]) {
      expect(isInColombia(point)).toBe(true);
    }
  });

  it("accepts San Andrés, a thousand kilometres off the mainland", () => {
    expect(isInColombia({ lat: 12.5847, lng: -81.7006 })).toBe(true);
  });

  it("rejects the three mistakes it exists for", () => {
    // a zeroed default: the Gulf of Guinea
    expect(isInColombia({ lat: 0, lng: 0 })).toBe(false);
    // the pair swapped
    expect(isInColombia({ lat: -75.5174, lng: 5.0689 })).toBe(false);
    // the sign dropped off the longitude
    expect(isInColombia({ lat: 5.0689, lng: 75.5174 })).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(COLOMBIA_FALLBACK_CENTER, COLOMBIA_FALLBACK_CENTER)).toBe(0);
  });

  it("measures a known separation", () => {
    // Bogotá to Manizales is about 190 km in a straight line.
    const km = distanceMeters({ lat: 4.711, lng: -74.0721 }, { lat: 5.0689, lng: -75.5174 }) / 1000;
    expect(km).toBeGreaterThan(160);
    expect(km).toBeLessThan(180);
  });

  it("a hundredth of a degree of latitude is about 1.1 km, anywhere", () => {
    for (const lat of [-4, 0, 5, 13]) {
      const metres = distanceMeters({ lat, lng: -74 }, { lat: lat + 0.01, lng: -74 });
      expect(metres).toBeGreaterThan(1_100);
      expect(metres).toBeLessThan(1_120);
    }
  });
});

describe("roundPoint", () => {
  it("keeps six decimals and drops the noise below them", () => {
    expect(roundPoint({ lat: 5.0725000000000002, lng: -75.5124999999999 })).toEqual({
      lat: 5.0725,
      lng: -75.5125,
    });
  });
});

describe("formatPoint", () => {
  it("uses the Colombian decimal comma", () => {
    expect(formatPoint({ lat: 5.06784, lng: -75.49123 })).toBe("5,06784 · -75,49123");
  });
});
