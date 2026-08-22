import {
  LEASE_TERMS,
  propertyMonthlyCost,
  PROPERTY_TYPES,
  type LeaseTerm,
  type Property,
  type PropertyType,
} from "./property";

/** What a listing can be filtered by beyond the city. */
export const CATALOG_FEATURES = ["furnished", "pets", "parking"] as const;
export type CatalogFeature = (typeof CATALOG_FEATURES)[number];

export const CATALOG_FEATURE_LABELS: Readonly<Record<CatalogFeature, string>> = {
  furnished: "Amoblado",
  pets: "Acepta mascotas",
  parking: "Con parqueadero",
};

/**
 * Bedroom buckets. The last one is open-ended: past three, "four or more" is what a tenant
 * actually means, and a facet per number would be a column of ones.
 */
export const BEDROOM_BUCKETS = [1, 2, 3, 4] as const;
export type BedroomBucket = (typeof BEDROOM_BUCKETS)[number];
export const MAX_BEDROOM_BUCKET = 4;

export function bedroomBucketLabel(bucket: BedroomBucket): string {
  if (bucket === MAX_BEDROOM_BUCKET) return "4 o más";

  return bucket === 1 ? "1 habitación" : `${bucket} habitaciones`;
}

export const CATALOG_SORTS = ["recent", "price-asc", "price-desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_SORT_LABELS: Readonly<Record<CatalogSort, string>> = {
  recent: "Más recientes",
  "price-asc": "Precio (menor a mayor)",
  "price-desc": "Precio (mayor a menor)",
};

/** How many listings one page shows. */
export const CATALOG_PAGE_SIZE = 12;

export type CatalogFilters = {
  readonly city: string | null;
  readonly types: readonly PropertyType[];
  readonly bedrooms: readonly BedroomBucket[];
  readonly lease: readonly LeaseTerm[];
  readonly features: readonly CatalogFeature[];
  readonly sort: CatalogSort;
  readonly page: number;
};

export const EMPTY_FILTERS: CatalogFilters = {
  city: null,
  types: [],
  bedrooms: [],
  lease: [],
  features: [],
  sort: "recent",
  page: 1,
};

/** Which bucket a listing falls in: everything from four bedrooms up lands on the last one. */
function bucketOf(bedrooms: number): BedroomBucket {
  return (bedrooms >= MAX_BEDROOM_BUCKET ? MAX_BEDROOM_BUCKET : bedrooms) as BedroomBucket;
}

function hasFeature(property: Property, feature: CatalogFeature): boolean {
  if (feature === "furnished") return property.furnished;
  if (feature === "pets") return property.petsAllowed;

  return property.parking !== "none";
}

/**
 * One predicate per facet, so the same rules serve both the filtered list and the counts.
 *
 * An empty selection means "no restriction", not "nothing matches": a facet nobody touched
 * must not hide anything.
 */
const MATCHERS = {
  city: (property: Property, f: CatalogFilters) => !f.city || property.area.city === f.city,
  types: (property: Property, f: CatalogFilters) =>
    f.types.length === 0 || f.types.includes(property.type),
  bedrooms: (property: Property, f: CatalogFilters) =>
    f.bedrooms.length === 0 || f.bedrooms.includes(bucketOf(property.bedrooms)),
  lease: (property: Property, f: CatalogFilters) =>
    f.lease.length === 0 || f.lease.includes(property.minLeaseMonths),
  features: (property: Property, f: CatalogFilters) =>
    f.features.every((feature) => hasFeature(property, feature)),
} as const;

type FacetKey = keyof typeof MATCHERS;

/** Everything that matches, ignoring the facets named in `except`. */
function matching(
  properties: readonly Property[],
  filters: CatalogFilters,
  except: readonly FacetKey[] = [],
): readonly Property[] {
  const keys = (Object.keys(MATCHERS) as FacetKey[]).filter((key) => !except.includes(key));

  return properties.filter((property) => keys.every((key) => MATCHERS[key](property, filters)));
}

export function filterProperties(
  properties: readonly Property[],
  filters: CatalogFilters,
): readonly Property[] {
  return matching(properties, filters);
}

export function sortProperties(
  properties: readonly Property[],
  sort: CatalogSort,
): readonly Property[] {
  const sorted = [...properties];

  if (sort === "recent") {
    return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const direction = sort === "price-asc" ? 1 : -1;

  // The tie-break is the publication date, so two listings at the same price keep a stable
  // order instead of shuffling between renders.
  return sorted.sort(
    (a, b) =>
      direction * (propertyMonthlyCost(a) - propertyMonthlyCost(b)) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export type CatalogFacets = {
  readonly cities: readonly { readonly value: string; readonly count: number }[];
  readonly types: readonly { readonly value: PropertyType; readonly count: number }[];
  readonly bedrooms: readonly { readonly value: BedroomBucket; readonly count: number }[];
  readonly lease: readonly { readonly value: LeaseTerm; readonly count: number }[];
  readonly features: readonly { readonly value: CatalogFeature; readonly count: number }[];
};

/**
 * The counts beside each option.
 *
 * Each facet is counted against the *other* filters, not against its own: while "Apartamento"
 * is selected, the number next to "Casa" has to be how many houses you would get by switching,
 * otherwise every unselected option reads zero and the filter looks broken.
 *
 * Cities are counted the same way, which is why a city with nothing in it is never offered.
 */
export function countFacets(
  properties: readonly Property[],
  filters: CatalogFilters,
): CatalogFacets {
  const count = <T>(except: readonly FacetKey[], of: (property: Property) => T | null) => {
    const counts = new Map<T, number>();
    for (const property of matching(properties, filters, except)) {
      const key = of(property);
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  };

  const cityCounts = count<string>(["city"], (property) => property.area.city);
  const typeCounts = count<PropertyType>(["types"], (property) => property.type);
  const bedroomCounts = count<BedroomBucket>(["bedrooms"], (property) => bucketOf(property.bedrooms));
  const leaseCounts = count<LeaseTerm>(["lease"], (property) => property.minLeaseMonths);

  /*
   * An option worth nothing is hidden — a column of zeroes is a column of dead ends — with one
   * exception: an option that is *selected* always stays. Its count can legitimately be zero
   * (two filters that contradict each other), and hiding it there would leave a filter applied
   * with no way to switch it off. That is a trap, not a tidy panel.
   */
  const offered = <T>(selected: readonly T[]) => (option: { value: T; count: number }) =>
    option.count > 0 || selected.includes(option.value);

  return {
    cities: [...cityCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "es")),
    types: PROPERTY_TYPES.map((value) => ({ value, count: typeCounts.get(value) ?? 0 })).filter(
      offered(filters.types),
    ),
    bedrooms: BEDROOM_BUCKETS.map((value) => ({
      value,
      count: bedroomCounts.get(value) ?? 0,
    })).filter(offered(filters.bedrooms)),
    lease: LEASE_TERMS.map((value) => ({ value, count: leaseCounts.get(value) ?? 0 })).filter(
      offered(filters.lease),
    ),
    // A feature is a toggle, so its count is how many you would be left with by adding it to
    // whatever is already selected.
    features: CATALOG_FEATURES.map((value) => ({
      value,
      count: matching(properties, filters, ["features"]).filter(
        (property) =>
          hasFeature(property, value) &&
          filters.features.every((other) => hasFeature(property, other)),
      ).length,
    })).filter(offered(filters.features)),
  };
}

export type CatalogPage = {
  readonly items: readonly Property[];
  readonly total: number;
  readonly page: number;
  readonly pages: number;
};

/**
 * One page of results, with the page number clamped into range: `?page=99` on a two-page
 * catalog shows the last page instead of an empty screen.
 */
export function paginate(
  properties: readonly Property[],
  page: number,
  size = CATALOG_PAGE_SIZE,
): CatalogPage {
  const pages = Math.max(1, Math.ceil(properties.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;

  return {
    items: properties.slice(start, start + size),
    total: properties.length,
    page: current,
    pages,
  };
}

/** Is anything narrowing the list right now? Drives the "clear filters" affordance. */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.city !== null ||
    filters.types.length > 0 ||
    filters.bedrooms.length > 0 ||
    filters.lease.length > 0 ||
    filters.features.length > 0
  );
}
