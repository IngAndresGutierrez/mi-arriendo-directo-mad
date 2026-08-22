import { canonicalMunicipality } from "@/shared/geo/municipalities";

import {
  BEDROOM_BUCKETS,
  CATALOG_FEATURES,
  CATALOG_SORTS,
  EMPTY_FILTERS,
  type BedroomBucket,
  type CatalogFeature,
  type CatalogFilters,
  type CatalogSort,
} from "../domain/catalog";
import { LEASE_TERMS, PROPERTY_TYPES, type LeaseTerm, type PropertyType } from "../domain/property";

/** What Next hands over for one search parameter. */
type Param = string | string[] | undefined;

/**
 * Splits a repeatable parameter.
 *
 * Both shapes are accepted: `?type=house,studio` because it keeps a shared link short, and
 * `?type=house&type=studio` because that is what a form would produce. Neither should be the
 * one that silently does nothing.
 */
function values(raw: Param): readonly string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];

  return parts
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Keeps the members of `allowed` that were asked for, in the catalog's own order. */
function pick<T extends string | number>(raw: Param, allowed: readonly T[]): readonly T[] {
  const asked = new Set(values(raw).map((value) => value.toLowerCase()));

  return allowed.filter((option) => asked.has(String(option).toLowerCase()));
}

/**
 * Reads the `city` query parameter.
 *
 * A search parameter is user input, and this one narrows a listing query: it is validated
 * against the municipality catalog, so an unknown value becomes "no filter" instead of a search
 * for a place that does not exist. It comes back in the catalog's own spelling, which is what
 * the stored `area.city` holds.
 *
 * Next hands a repeated parameter (`?city=A&city=B`) as an array; the first one wins rather
 * than the whole thing failing.
 */
export function parseCityFilter(raw: Param): string | null {
  const [first] = values(raw);

  return first ? canonicalMunicipality(first) : null;
}

/**
 * Reads the whole catalog state out of the URL.
 *
 * Every value is checked against the options that exist, so nothing arbitrary reaches the
 * filters and a hand-edited URL degrades to a wider search instead of an error page. The URL is
 * the only state the catalog has — it is what gets shared — so this is the single place that
 * decides what a link means.
 */
export function parseCatalogFilters(
  searchParams: Readonly<Record<string, Param>>,
): CatalogFilters {
  const page = Number.parseInt(values(searchParams.page)[0] ?? "", 10);
  const [sort] = pick<CatalogSort>(searchParams.sort, CATALOG_SORTS);

  return {
    city: parseCityFilter(searchParams.city),
    types: pick<PropertyType>(searchParams.type, PROPERTY_TYPES),
    bedrooms: pick<BedroomBucket>(searchParams.bedrooms, BEDROOM_BUCKETS),
    lease: pick<LeaseTerm>(searchParams.lease, LEASE_TERMS),
    features: pick<CatalogFeature>(searchParams.features, CATALOG_FEATURES),
    sort: sort ?? EMPTY_FILTERS.sort,
    // `paginate` clamps the upper end, where the number of pages is known.
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * Turns filters back into a query string — the same function the links and the controls use,
 * so a URL the page produces is always one this module can read back.
 *
 * Defaults are left out: `/inmuebles` and `/inmuebles?sort=recent&page=1` are the same page,
 * and only one of them should be shareable.
 */
export function catalogQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.types.length > 0) params.set("type", filters.types.join(","));
  if (filters.bedrooms.length > 0) params.set("bedrooms", filters.bedrooms.join(","));
  if (filters.lease.length > 0) params.set("lease", filters.lease.join(","));
  if (filters.features.length > 0) params.set("features", filters.features.join(","));
  if (filters.sort !== EMPTY_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();

  return query === "" ? "" : `?${query}`;
}
