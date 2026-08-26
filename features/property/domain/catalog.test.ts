import { propertyLabels } from "./labels";
import { describe, expect, it } from "vitest";

import {
  countFacets,
  EMPTY_FILTERS,
  filterProperties,
  hasActiveFilters,
  paginate,
  sortProperties,
  type CatalogFilters,
} from "./catalog";
import type { Property } from "./property";

/** A published listing with everything the catalog reads; each test overrides what it cares about. */
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
    photos: [{ path: "properties/landlord/a.jpg", url: "https://example.test/a.jpg" }],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const filters = (overrides: Partial<CatalogFilters> = {}): CatalogFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("filterProperties", () => {
  const all = [
    listing({ id: "a", type: "apartment", bedrooms: 2, area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" } }),
    listing({ id: "b", type: "house", bedrooms: 4, area: { neighborhood: "Laureles", city: "Medellín", department: "Antioquia" } }),
    listing({ id: "c", type: "studio", bedrooms: 1, furnished: true, petsAllowed: true, parking: "communal", minLeaseMonths: 6 }),
  ];

  it("returns everything when nothing is selected", () => {
    expect(filterProperties(all, filters())).toHaveLength(3);
  });

  it("filters by city, type and minimum lease", () => {
    expect(filterProperties(all, filters({ city: "Medellín" })).map((p) => p.id)).toEqual(["b"]);
    expect(filterProperties(all, filters({ types: ["house", "studio"] })).map((p) => p.id)).toEqual(["b", "c"]);
    expect(filterProperties(all, filters({ lease: [6] })).map((p) => p.id)).toEqual(["c"]);
  });

  // Four is the open-ended bucket: it has to catch a five-bedroom house too.
  it("treats the last bedroom bucket as four or more", () => {
    const withFive = [...all, listing({ id: "d", bedrooms: 5 })];
    expect(filterProperties(withFive, filters({ bedrooms: [4] })).map((p) => p.id)).toEqual(["b", "d"]);
    expect(filterProperties(withFive, filters({ bedrooms: [1, 2] })).map((p) => p.id)).toEqual(["a", "c"]);
  });

  // Features are additive: asking for furnished *and* pets means both, not either.
  it("requires every selected feature", () => {
    expect(filterProperties(all, filters({ features: ["furnished"] })).map((p) => p.id)).toEqual(["c"]);
    expect(filterProperties(all, filters({ features: ["furnished", "parking"] })).map((p) => p.id)).toEqual(["c"]);
    expect(filterProperties(all, filters({ features: ["furnished"] , types: ["house"] }))).toHaveLength(0);
  });
});

describe("sortProperties", () => {
  const cheapNew = listing({ id: "cheap", rent: 900_000, createdAt: "2026-08-10T00:00:00.000Z" });
  const dearOld = listing({ id: "dear", rent: 3_000_000, createdAt: "2026-07-01T00:00:00.000Z" });
  // Same total as `dearOld` once the admin fee is added: the sort is on what the tenant pays.
  const dearByFee = listing({ id: "fee", rent: 2_500_000, adminFee: 500_000, createdAt: "2026-08-05T00:00:00.000Z" });

  it("puts the newest first by default", () => {
    expect(sortProperties([dearOld, cheapNew, dearByFee], "recent").map((p) => p.id)).toEqual([
      "cheap",
      "fee",
      "dear",
    ]);
  });

  it("sorts by what the tenant actually pays, admin fee included", () => {
    expect(sortProperties([dearOld, cheapNew, dearByFee], "price-asc").map((p) => p.id)).toEqual([
      "cheap",
      "fee",
      "dear",
    ]);
    expect(sortProperties([cheapNew, dearOld, dearByFee], "price-desc").map((p) => p.id)[2]).toBe("cheap");
  });

  it("breaks a price tie by date, so the order does not shuffle", () => {
    const ordered = sortProperties([dearOld, dearByFee], "price-asc").map((p) => p.id);
    expect(ordered).toEqual(sortProperties([dearByFee, dearOld], "price-asc").map((p) => p.id));
    expect(ordered).toEqual(["fee", "dear"]);
  });

  it("does not mutate what it was given", () => {
    const input = [dearOld, cheapNew];
    sortProperties(input, "price-asc");
    expect(input.map((p) => p.id)).toEqual(["dear", "cheap"]);
  });
});

describe("countFacets", () => {
  const all = [
    listing({ id: "a", type: "apartment", bedrooms: 2, furnished: true }),
    listing({ id: "b", type: "apartment", bedrooms: 3 }),
    listing({ id: "c", type: "house", bedrooms: 3, area: { neighborhood: "Laureles", city: "Medellín", department: "Antioquia" } }),
  ];

  it("counts each option and drops the ones nothing matches", () => {
    const facets = countFacets(all, filters());
    expect(facets.types).toEqual([
      { value: "apartment", count: 2 },
      { value: "house", count: 1 },
    ]);
    expect(facets.bedrooms).toEqual([
      { value: 2, count: 1 },
      { value: 3, count: 2 },
    ]);
    expect(facets.features).toEqual([{ value: "furnished", count: 1 }]);
  });

  /*
   * The reason each facet ignores itself. With "Apartamento" selected, "Casa" must still say 1
   * — that is what you get by switching to it. Counted against its own facet it would say 0,
   * and every unselected option would look like a dead end.
   */
  it("counts a facet against the other filters, not its own", () => {
    const facets = countFacets(all, filters({ types: ["apartment"] }));
    expect(facets.types).toEqual([
      { value: "apartment", count: 2 },
      { value: "house", count: 1 },
    ]);
    // Bedrooms *do* respect the type filter: only the two apartments are in play.
    expect(facets.bedrooms).toEqual([
      { value: 2, count: 1 },
      { value: 3, count: 1 },
    ]);
  });

  /*
   * Two filters that contradict each other leave a facet at zero. If the option disappeared
   * there, the filter would be stuck on with no checkbox to switch it off.
   */
  it("keeps a selected option that now counts zero, so it can be unselected", () => {
    const active = filters({ types: ["house"], features: ["furnished"] });
    const facets = countFacets(all, active);

    expect(facets.features).toEqual([{ value: "furnished", count: 0 }]);
    expect(facets.types.map((option) => option.value)).toContain("house");
  });

  it("offers only cities that have something, and honours the other filters", () => {
    expect(countFacets(all, filters()).cities).toEqual([
      { value: "Manizales", count: 2 },
      { value: "Medellín", count: 1 },
    ]);
    expect(countFacets(all, filters({ types: ["house"] })).cities).toEqual([
      { value: "Medellín", count: 1 },
    ]);
  });
});

describe("paginate", () => {
  const many = Array.from({ length: 5 }, (_, i) => listing({ id: `p${i}` }));

  it("slices the requested page", () => {
    expect(paginate(many, 1, 2).items.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(paginate(many, 3, 2).items.map((p) => p.id)).toEqual(["p4"]);
    expect(paginate(many, 2, 2)).toMatchObject({ total: 5, page: 2, pages: 3 });
  });

  // `?page=99` is one edit away in the address bar; an empty screen would look like a bug.
  it("clamps a page number outside the range", () => {
    expect(paginate(many, 99, 2).page).toBe(3);
    expect(paginate(many, 0, 2).page).toBe(1);
    expect(paginate(many, -4, 2).page).toBe(1);
  });

  it("reports one page when there is nothing", () => {
    expect(paginate([], 1)).toMatchObject({ total: 0, page: 1, pages: 1, items: [] });
  });
});

describe("hasActiveFilters", () => {
  it("ignores sort and page: neither narrows anything", () => {
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ sort: "price-asc", page: 3 }))).toBe(false);
    expect(hasActiveFilters(filters({ city: "Manizales" }))).toBe(true);
    expect(hasActiveFilters(filters({ features: ["pets"] }))).toBe(true);
  });
});

/*
 * `bedroomBucketLabel` moved into the dictionary as `property.bedroomBucket`, and
 * `propertyLabels(locale).bedrooms` is what resolves it into the record the facets read. The
 * assertion is the same one — the last bucket is open-ended — now made in both languages, because
 * "4 or more" is the case a naive plural rule gets wrong.
 */
describe("the bedroom buckets", () => {
  it("names them, the last one open-ended, in each language", () => {
    const es = propertyLabels("es").bedrooms;
    expect(es[1]).toBe("1 habitación");
    expect(es[3]).toBe("3 habitaciones");
    expect(es[4]).toBe("4 o más");

    const en = propertyLabels("en").bedrooms;
    expect(en[1]).toBe("1 bedroom");
    expect(en[3]).toBe("3 bedrooms");
    expect(en[4]).toBe("4 or more");
  });
});

/*
 * The guarantee the whole label module exists for: every value of every union has a word in every
 * language. A member added to `PROPERTY_TYPES` with nothing said about it fails `pnpm typecheck`,
 * and this catches the other half — a key present but empty.
 */
describe("propertyLabels", () => {
  it("has a non-empty word for every value in both languages", () => {
    for (const locale of ["es", "en"] as const) {
      for (const [group, record] of Object.entries(propertyLabels(locale))) {
        for (const [key, label] of Object.entries(record)) {
          expect(label, `${locale}.${group}.${key}`).toBeTruthy();
        }
      }
    }
  });

  it("gives the two languages different words", () => {
    expect(propertyLabels("es").types.house).toBe("Casa");
    expect(propertyLabels("en").types.house).toBe("House");
  });
});
