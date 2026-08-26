/**
 * Tests for the publish-a-property schema. Every non-trivial rule has a valid case and an
 * invalid one: a schema test that only proves the happy path proves nothing.
 */
import { describe, expect, it } from "vitest";

import { LEASE_TERMS, PHOTOS_MAX, RENT_MIN, STRATA } from "../domain/property";
import {
  MAX_MONTHS_AHEAD,
  draftPropertySchema,
  propertyFormSchema,
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
  areaM2: "65",
  bedrooms: "2",
  bathrooms: "2",
  parking: "private",
  stratum: "4",
  furnished: false,
  petsAllowed: true,
  minLeaseMonths: "12",
  availableFrom: "2026-12-07",
  address: {
    registryNumber: "050-123456",
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

  describe("the point on the map", () => {
    const withPoint = (point: unknown) =>
      publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        address: { ...VALID_PROPERTY.address, point },
      });

    it("is optional: a listing publishes without a map", () => {
      // Not a convenience. Requiring it would lock every listing published before the map out of
      // its own edit form, and shut out a landlord whose street OpenStreetMap has not drawn.
      const parsed = publishPropertySchema.parse(VALID_PROPERTY);
      expect(parsed.address.point).toBeUndefined();
    });

    it("accepts a point and coerces the pair the form sends as strings", () => {
      const result = withPoint({ lat: "5.06786", lng: "-75.49123" });
      expect(result.success).toBe(true);
      expect(result.data?.address.point).toEqual({ lat: 5.06786, lng: -75.49123 });
    });

    it("rejects a point outside Colombia", () => {
      // The three ways a coordinate arrives wrong, and each one publishes a map of nowhere.
      expect(withPoint({ lat: 0, lng: 0 }).success).toBe(false); // a zeroed default
      expect(withPoint({ lat: -75.49123, lng: 5.06786 }).success).toBe(false); // the pair swapped
      expect(withPoint({ lat: 5.06786, lng: 75.49123 }).success).toBe(false); // the sign dropped
    });

    it("rejects a pair that is not numbers at all", () => {
      expect(withPoint({ lat: "por el parque", lng: "-75.49" }).success).toBe(false);
      expect(withPoint({ lat: 5.06786 }).success).toBe(false);
      expect(withPoint({}).success).toBe(false);
    });

    it("says what is wrong on the point, not on the address as a whole", () => {
      // The form shows this under the map. An issue pathed at `address` would surface on the
      // street field, telling the landlord to fix something they got right.
      const result = withPoint({ lat: 0, lng: 0 });
      expect(result.error?.issues[0]?.path).toEqual(["address", "point"]);
    });
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

    it("accepts zero admin fee: not every property charges one", () => {
      const parsed = publishPropertySchema.parse({ ...VALID_PROPERTY, adminFee: "0" });
      expect(parsed.adminFee).toBe(0);
    });

    it("has no deposit field at all: Ley 820 forbids it, so it cannot be sent", () => {
      const parsed = publishPropertySchema.parse({ ...VALID_PROPERTY, deposit: "1800000" });
      expect("deposit" in parsed).toBe(false);
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

    it.each(["private", "communal", "none"])("accepts parking: %s", (parking) => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, parking }).success).toBe(true);
    });

    it("rejects a parking value outside the three options", () => {
      expect(publishPropertySchema.safeParse({ ...VALID_PROPERTY, parking: "2" }).success).toBe(false);
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

    it("rejects a city that is not in the chosen department", () => {
      const r = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        address: { ...VALID_PROPERTY.address, city: "Manizales", department: "Antioquia" },
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path.join(".") === "address.city")).toBe(true);
      }
    });

    it("accepts a small municipality, not just the capitals", () => {
      const r = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        address: { ...VALID_PROPERTY.address, city: "Aranzazu", department: "Caldas" },
      });
      expect(r.success).toBe(true);
    });

    it("rejects an invented city", () => {
      const r = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        address: { ...VALID_PROPERTY.address, city: "Ciudad Gótica", department: "Caldas" },
      });
      expect(r.success).toBe(false);
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

  it("reads today in Colombia, not on the server's clock", () => {
    // 03:00 UTC on the 23rd is still 22:00 on the 22nd in Bogotá, so the 22nd is today.
    const madrugada = new Date("2026-08-23T03:00:00Z");
    expect(validateAvailableFrom("2026-08-22", madrugada).ok).toBe(true);
    expect(validateAvailableFrom("2026-08-21", madrugada).ok).toBe(false);
  });

  it(`rejects more than ${MAX_MONTHS_AHEAD} months ahead`, () => {
    expect(validateAvailableFrom("2027-10-01", today).ok).toBe(false);
  });

  it("rejects text that is not a date", () => {
    expect(validateAvailableFrom("2026-13-45", today).ok).toBe(false);
  });
});

describe("draftPropertySchema", () => {
  it("accepts the form with no photos at all", () => {
    const parsed = draftPropertySchema.parse({ ...VALID_PROPERTY, photos: [] });
    expect(parsed.photos).toEqual([]);
    // Everything else survived the relaxation: a draft is a listing, not a sketch.
    expect(parsed.rent).toBe(1_800_000);
    expect(parsed.address.registryNumber).toBe("050-123456");
  });

  it("accepts photos when there are some: a draft is not a listing *without* photos", () => {
    expect(draftPropertySchema.parse(VALID_PROPERTY).photos).toHaveLength(1);
  });

  it("still refuses more than the maximum", () => {
    const tooMany = Array.from({ length: PHOTOS_MAX + 1 }, (_, index) => ({
      path: `properties/uid-1/${index}.jpg`,
      url: `https://example.com/${index}.jpg`,
    }));
    expect(draftPropertySchema.safeParse({ ...VALID_PROPERTY, photos: tooMany }).success).toBe(
      false,
    );
  });

  /*
   * The load-bearing property of the whole feature: the photos are the ONLY thing a draft may be
   * missing. If this ever stops holding, promoting a draft stops being a promotion and becomes a
   * second form to fill in — on fields its author filled three weeks ago and has stopped thinking
   * about. Weakening `draftPropertySchema` to `.partial()` is what this catches.
   */
  it.each(["title", "description", "rent", "stratum", "availableFrom", "bathrooms", "address"])(
    "still requires %s when it is absent altogether",
    (field) => {
      // The key is **deleted**, not blanked. An empty string is refused by `min()` even after a
      // `.partial()`, so a test that only blanks fields passes on the very relaxation it exists
      // to catch — which is what this one did before it was made to fail on purpose.
      const withoutField: Record<string, unknown> = { ...VALID_PROPERTY, photos: [] };
      delete withoutField[field];

      expect(draftPropertySchema.safeParse(withoutField).success).toBe(false);
    },
  );

  it("still requires the whole address, matrícula included", () => {
    for (const field of ["registryNumber", "line", "neighborhood", "city", "department"]) {
      const address: Record<string, unknown> = { ...VALID_PROPERTY.address };
      delete address[field];
      const parsed = draftPropertySchema.safeParse({ ...VALID_PROPERTY, photos: [], address });

      expect(parsed.success, `address.${field} should still be required`).toBe(false);
    }
  });
});

describe("propertyFormSchema", () => {
  it("gives a draft the lax schema and a publish the strict one", () => {
    const withoutPhotos = { ...VALID_PROPERTY, photos: [] };
    expect(propertyFormSchema("draft").safeParse(withoutPhotos).success).toBe(true);
    expect(propertyFormSchema("publish").safeParse(withoutPhotos).success).toBe(false);
  });
});

describe("the listing video", () => {
  const VIDEO = {
    path: "properties/uid-1/abc-recorrido.mp4",
    url: "https://example.com/abc-recorrido.mp4",
    contentType: "video/mp4",
  };

  it("is optional: a listing with no video publishes", () => {
    // The rule the whole feature rests on. Making it required would lock every listing published
    // before the video existed out of its own edit form — the map's argument, one field over.
    expect(publishPropertySchema.safeParse(VALID_PROPERTY).success).toBe(true);
  });

  it("is accepted when it is there", () => {
    const parsed = publishPropertySchema.safeParse({ ...VALID_PROPERTY, video: VIDEO });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.video).toStrictEqual(VIDEO);
  });

  it("is optional on a draft too, and accepted there", () => {
    // A landlord with the walkthrough but not the stills is exactly what drafts are for, so the
    // field has to survive the one override `draftPropertySchema` makes.
    const withoutPhotos = { ...VALID_PROPERTY, photos: [] };
    expect(draftPropertySchema.safeParse(withoutPhotos).success).toBe(true);
    expect(draftPropertySchema.safeParse({ ...withoutPhotos, video: VIDEO }).success).toBe(true);
  });

  it("refuses a content type outside the three containers", () => {
    // This string is written straight into `<source type>` on a public page, and it is the same
    // set the Storage rules allow: a free-form string here would let the two disagree.
    for (const contentType of ["video/x-msvideo", "image/jpeg", "video/mp4; codecs=avc1", ""]) {
      const parsed = publishPropertySchema.safeParse({
        ...VALID_PROPERTY,
        video: { ...VIDEO, contentType },
      });

      expect(parsed.success, `${contentType || "(empty)"} should be refused`).toBe(false);
    }
  });

  it("refuses a video with no path, and one with a url that is not a url", () => {
    expect(
      publishPropertySchema.safeParse({ ...VALID_PROPERTY, video: { ...VIDEO, path: "" } }).success,
    ).toBe(false);
    expect(
      publishPropertySchema.safeParse({ ...VALID_PROPERTY, video: { ...VIDEO, url: "nope" } })
        .success,
    ).toBe(false);
  });

  it("does not let a video stand in for the photos", () => {
    /*
     * The one confusion worth a test. `photos[0]` is the cover the catalogue card and the shared
     * Open Graph card both draw, so a listing whose only media is a video has nothing to render
     * there — and `PHOTOS_MIN` is what stops it reaching the catalogue.
     */
    const videoOnly = { ...VALID_PROPERTY, photos: [], video: VIDEO };

    expect(publishPropertySchema.safeParse(videoOnly).success).toBe(false);
  });
});
