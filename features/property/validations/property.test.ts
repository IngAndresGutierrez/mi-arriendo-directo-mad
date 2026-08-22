/**
 * Tests for the publish-a-property schema. Every non-trivial rule has a valid case and an
 * invalid one: a schema test that only proves the happy path proves nothing.
 */
import { describe, expect, it } from "vitest";

import { LEASE_TERMS, PHOTOS_MAX, RENT_MIN, STRATA } from "../domain/property";
import {
  MAX_MONTHS_AHEAD,
  publishPropertySchema,
  validateAvailableFrom,
} from "./property";

const VALID_PROPERTY = {
  title: "Apartamento luminoso en Palermo",
  description:
    "Apartamento de dos habitaciones con excelente iluminación natural, cocina integral y " +
    "zona de ropas independiente. Queda a dos cuadras del parque.",
  type: "apartment",
  rent: "1800000",
  adminFee: "250000",
  deposit: "1800000",
  areaM2: "65",
  bedrooms: "2",
  bathrooms: "2",
  parkingSpots: "1",
  stratum: "4",
  furnished: false,
  petsAllowed: true,
  minLeaseMonths: "12",
  availableFrom: "2026-12-07",
  address: {
    line: "Calle 60 #10-20 apto 301",
    neighborhood: "Palermo",
    city: "Manizales",
    department: "Caldas",
  },
  photos: [{ path: "properties/uid-1/a.jpg", url: "https://example.com/a.jpg" }],
};

describe("publishPropertySchema", () => {
  it("accepts a complete property and coerces the numbers", () => {
    const parsed = publishPropertySchema.parse(VALID_PROPERTY);
    expect(parsed.rent).toBe(1_800_000);
    expect(parsed.stratum).toBe(4);
    expect(parsed.minLeaseMonths).toBe(12);
  });

  it("trims the free text", () => {
    const parsed = publishPropertySchema.parse({
      ...VALID_PROPERTY,
      title: "   Apartamento luminoso en Palermo   ",
    });
    expect(parsed.title).toBe("Apartamento luminoso en Palermo");
  });

  describe("money", () => {
    it("rejects a rent below the floor", () => {
      const r = publishPropertySchema.safeParse({ ...VALID_PROPERTY, rent: String(RENT_MIN - 1) });
      expect(r.success).toBe(false);
    });

    it("rejects a rent with decimals instead of rounding it", () => {
      const r = publishPropertySchema.safeParse({ ...VALID_PROPERTY, rent: "1800000.5" });
      expect(r.success).toBe(false);
    });

    it("accepts zero admin fee and zero deposit: not every property charges them", () => {
      const parsed = publishPropertySchema.parse({ ...VALID_PROPERTY, adminFee: "0", deposit: "0" });
      expect(parsed.adminFee).toBe(0);
      expect(parsed.deposit).toBe(0);
    });

    it("rejects a negative admin fee", () => {
      const r = publishPropertySchema.safeParse({ ...VALID_PROPERTY, adminFee: "-1" });
      expect(r.success).toBe(false);
    });
  });

  describe("rooms and area", () => {
    it("accepts zero bedrooms: a studio has none", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, bedrooms: "0" }).success).toBe(true);
    });

    it("requires at least one bathroom", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, bathrooms: "0" }).success).toBe(false);
    });

    it("rejects an absurd area", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, areaM2: "3" }).success).toBe(false);
    });
  });

  describe("domain values", () => {
    it.each(STRATA)("accepts stratum %i", (stratum) => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, stratum: String(stratum) }).success).toBe(true);
    });

    it("rejects a stratum outside 1-6", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, stratum: "7" }).success).toBe(false);
    });

    it.each(LEASE_TERMS)("accepts a minimum lease of %i months", (months) => {
      expect(
        publishPropertySchema.safeParse({ ...VALID_PROPERTY, minLeaseMonths: String(months) }).success,
      ).toBe(true);
    });

    it("rejects a lease shorter than the product allows", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, minLeaseMonths: "1" }).success).toBe(false);
    });

    it("rejects a type that is not in the catalog", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, type: "castle" }).success).toBe(false);
    });

    it("rejects a department that does not exist", () => {
      const r = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        address: { ...VALID_PROPERTY.address, department: "Caldas del Norte" },
      });
      expect(r.success).toBe(false);
    });
  });

  describe("photos", () => {
    it("requires at least one", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, photos: [] }).success).toBe(false);
    });

    it(`rejects more than ${PHOTOS_MAX}`, () => {
      const many = Array.from({ length: PHOTOS_MAX + 1 }, (_, i) => ({
        path: `properties/uid-1/${i}.jpg`,
        url: `https://example.com/${i}.jpg`,
      }));
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, photos: many }).success).toBe(false);
    });

    it("rejects a photo whose url is not a url", () => {
      const r = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        photos: [{ path: "properties/uid-1/a.jpg", url: "no-soy-una-url" }],
      });
      expect(r.success).toBe(false);
    });
  });

  it("rejects a date that is not a calendar day", () => {
    expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, availableFrom: "07/12/2026" }).success).toBe(false);
  });
});

describe("validateAvailableFrom", () => {
  const today = new Date("2026-08-22T15:00:00");

  it("accepts today", () => {
    expect(validateAvailableFrom("2026-08-22", today).ok).toBe(true);
  });

  it("accepts a date within the window", () => {
    expect(validateAvailableFrom("2026-12-07", today).ok).toBe(true);
  });

  it("rejects yesterday", () => {
    const r = validateAvailableFrom("2026-08-21", today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("pasado");
  });

  it(`rejects more than ${MAX_MONTHS_AHEAD} months ahead`, () => {
    expect(validateAvailableFrom("2027-10-01", today).ok).toBe(false);
  });

  it("rejects text that is not a date", () => {
    expect(validateAvailableFrom("2026-13-45", today).ok).toBe(false);
  });
});
