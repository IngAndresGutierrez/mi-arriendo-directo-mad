import { describe, expect, it } from "vitest";

import { countCities, showcaseListings } from "./cities";
import type { Property } from "./property";

/** A published listing with everything these functions read; each test overrides what it cares about. */
function listing(overrides: Partial<Property> & { id: string }): Property {
  return {
    landlordUid: "landlord",
    title: `Inmueble ${overrides.id}`,
    description: "Descripción suficiente para pasar la validación del formulario.",
    type: "apartment",
    status: "available",
    rent: 1_000_000,
    adminFee: 0,
    areaM2: 60,
    bedrooms: 2,
    bathrooms: 1,
    parking: "none",
    stratum: 3,
    furnished: false,
    petsAllowed: false,
    minLeaseMonths: 12,
    availableFrom: "2026-09-01",
    area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
    slug: `inmueble-${overrides.id}`,
    photos: [{ path: `properties/landlord/${overrides.id}.jpg`, url: `https://example.test/${overrides.id}.jpg` }],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/** `department` is the DANE union, not a string: a pair that does not exist is not a valid fixture. */
type Department = Property["area"]["department"];

const inCity = (id: string, city: string, department: Department, extra: Partial<Property> = {}) =>
  listing({ id, area: { neighborhood: "Centro", city, department }, ...extra });

describe("countCities", () => {
  it("counts the listings each city has", () => {
    const counted = countCities([
      inCity("a", "Manizales", "Caldas"),
      inCity("b", "Manizales", "Caldas"),
      inCity("c", "Pereira", "Risaralda"),
    ]);

    expect(counted).toHaveLength(2);
    expect(counted[0]).toMatchObject({ city: "Manizales", department: "Caldas", count: 2 });
    expect(counted[1]).toMatchObject({ city: "Pereira", department: "Risaralda", count: 1 });
  });

  it("never lists a city with no published listings", () => {
    expect(countCities([]).map((entry) => entry.city)).toEqual([]);
    expect(countCities([inCity("a", "Manizales", "Caldas")]).every((entry) => entry.count > 0)).toBe(true);
  });

  it("orders by count and breaks ties alphabetically, not by input order", () => {
    // Both cities have two. Fed in the order Bogotá-first, the tie-break must still be alphabetical:
    // a grid that reordered itself between two renders of the same data reads as a bug.
    const counted = countCities([
      inCity("a", "Pereira", "Risaralda"),
      inCity("b", "Pereira", "Risaralda"),
      inCity("c", "Armenia", "Quindío"),
      inCity("d", "Armenia", "Quindío"),
      inCity("e", "Manizales", "Caldas"),
      inCity("f", "Manizales", "Caldas"),
      inCity("g", "Manizales", "Caldas"),
    ]);

    expect(counted.map((entry) => entry.city)).toEqual(["Manizales", "Armenia", "Pereira"]);
  });

  it("takes the cover from the most recent listing of that city", () => {
    const counted = countCities([
      inCity("old", "Manizales", "Caldas", {
        createdAt: "2026-01-01T00:00:00.000Z",
        photos: [{ path: "p/old.jpg", url: "https://example.test/old.jpg" }],
      }),
      inCity("new", "Manizales", "Caldas", {
        createdAt: "2026-08-20T00:00:00.000Z",
        photos: [{ path: "p/new.jpg", url: "https://example.test/new.jpg" }],
      }),
    ]);

    expect(counted[0]?.cover).toBe("https://example.test/new.jpg");
  });

  it("does not let a newer photoless listing blank a cover that exists", () => {
    // The newest listing in the city has no photo yet. Taking its cover unconditionally would
    // replace a real photo with `null` and leave the card blank until somebody uploaded one.
    const counted = countCities([
      inCity("photographed", "Manizales", "Caldas", {
        createdAt: "2026-01-01T00:00:00.000Z",
        photos: [{ path: "p/a.jpg", url: "https://example.test/a.jpg" }],
      }),
      inCity("bare", "Manizales", "Caldas", { createdAt: "2026-08-20T00:00:00.000Z", photos: [] }),
    ]);

    expect(counted[0]).toMatchObject({ count: 2, cover: "https://example.test/a.jpg" });
  });

  it("reports no cover when the city has no photographed listing at all", () => {
    expect(countCities([inCity("bare", "Manizales", "Caldas", { photos: [] })])[0]?.cover).toBeNull();
  });

  it("honours the limit", () => {
    const counted = countCities(
      [
        inCity("a", "Manizales", "Caldas"),
        inCity("b", "Manizales", "Caldas"),
        inCity("c", "Pereira", "Risaralda"),
        inCity("d", "Armenia", "Quindío"),
      ],
      2,
    );

    expect(counted.map((entry) => entry.city)).toEqual(["Manizales", "Armenia"]);
  });
});

describe("showcaseListings", () => {
  it("skips listings with no photo", () => {
    const shown = showcaseListings(
      [listing({ id: "a" }), listing({ id: "b", photos: [] }), listing({ id: "c" })],
      10,
    );

    expect(shown.map((property) => property.id)).toEqual(["a", "c"]);
  });

  it("preserves the order it was given rather than re-sorting", () => {
    // `listAvailableProperties()` already orders by `createdAt` desc; re-sorting here would be a
    // second copy of that rule, and the two would disagree the day the query's order changes.
    const shown = showcaseListings([listing({ id: "c" }), listing({ id: "a" }), listing({ id: "b" })], 10);

    expect(shown.map((property) => property.id)).toEqual(["c", "a", "b"]);
  });

  it("caps at the limit", () => {
    expect(showcaseListings([listing({ id: "a" }), listing({ id: "b" }), listing({ id: "c" })], 2)).toHaveLength(2);
  });

  it("returns nothing rather than throwing when there is nothing published", () => {
    expect(showcaseListings([], 6)).toEqual([]);
  });
});
