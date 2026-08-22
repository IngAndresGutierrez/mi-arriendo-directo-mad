import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS } from "../domain/catalog";
import { catalogQuery, parseCatalogFilters, parseCityFilter } from "./catalog";

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

  // It narrows a listing query: an unknown value must not become a search.
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

describe("parseCatalogFilters", () => {
  it("reads an empty URL as the default view", () => {
    expect(parseCatalogFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("reads every facet", () => {
    expect(
      parseCatalogFilters({
        city: "manizales",
        type: "house,studio",
        bedrooms: "2,4",
        lease: "6",
        features: "furnished,pets",
        sort: "price-asc",
        page: "3",
      }),
    ).toEqual({
      city: "Manizales",
      types: ["house", "studio"],
      bedrooms: [2, 4],
      lease: [6],
      features: ["furnished", "pets"],
      sort: "price-asc",
      page: 3,
    });
  });

  // A form produces repeated parameters; a shared link is usually comma-separated.
  it("accepts both a repeated parameter and a comma-separated one", () => {
    expect(parseCatalogFilters({ type: ["house", "studio"] }).types).toEqual(["house", "studio"]);
    expect(parseCatalogFilters({ type: "house,studio" }).types).toEqual(["house", "studio"]);
  });

  it("drops values that are not options, keeping the ones that are", () => {
    expect(parseCatalogFilters({ type: "house,castle" }).types).toEqual(["house"]);
    expect(parseCatalogFilters({ bedrooms: "2,99,cero" }).bedrooms).toEqual([2]);
    expect(parseCatalogFilters({ lease: "6,7,24" }).lease).toEqual([6]);
    expect(parseCatalogFilters({ features: "furnished,jacuzzi" }).features).toEqual(["furnished"]);
  });

  it("falls back to the default sort and page on nonsense", () => {
    expect(parseCatalogFilters({ sort: "cheapest" }).sort).toBe("recent");
    expect(parseCatalogFilters({ page: "-2" }).page).toBe(1);
    expect(parseCatalogFilters({ page: "abc" }).page).toBe(1);
    expect(parseCatalogFilters({ page: "2.9" }).page).toBe(2);
  });

  // The order in the URL must not change the order of the facet lists.
  it("returns options in the catalog's order, not the URL's", () => {
    expect(parseCatalogFilters({ type: "studio,apartment" }).types).toEqual(["apartment", "studio"]);
  });
});

describe("catalogQuery", () => {
  it("omits everything that is a default", () => {
    expect(catalogQuery(EMPTY_FILTERS)).toBe("");
    expect(catalogQuery({ ...EMPTY_FILTERS, sort: "recent", page: 1 })).toBe("");
  });

  it("writes what a filter is", () => {
    expect(catalogQuery({ ...EMPTY_FILTERS, city: "Manizales", types: ["house"] })).toBe(
      "?city=Manizales&type=house",
    );
    expect(catalogQuery({ ...EMPTY_FILTERS, sort: "price-desc", page: 2 })).toBe(
      "?sort=price-desc&page=2",
    );
  });

  // The round trip is what keeps a shared link meaning the same thing it did on screen.
  it("round-trips through the parser", () => {
    const filters = {
      city: "Medellín",
      types: ["apartment", "studio"],
      bedrooms: [1, 4],
      lease: [12],
      features: ["parking"],
      sort: "price-desc",
      page: 4,
    } as const;
    const query = catalogQuery(filters);
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)).entries());

    expect(parseCatalogFilters(params)).toEqual(filters);
  });
});
