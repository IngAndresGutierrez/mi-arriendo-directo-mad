import { dictionaryFor } from "@/shared/i18n/dictionary";
import type { Locale } from "@/shared/i18n/locale";

import { BEDROOM_BUCKETS, CATALOG_FEATURES, CATALOG_SORTS, MAX_BEDROOM_BUCKET } from "./catalog";
import type { BedroomBucket, CatalogFeature, CatalogSort } from "./catalog";
import { LEASE_TERMS, PARKING_KINDS, PROPERTY_STATUSES, PROPERTY_TYPES } from "./property";
import type { LeaseTerm, ParkingKind, PropertyStatus, PropertyType } from "./property";

/**
 * Every label a listing needs, in one language, as **plain records**.
 *
 * These used to be six `X_LABELS` constants sitting beside their unions — `PROPERTY_TYPE_LABELS`
 * and friends. The keys have not moved and are still the stored English values; only the words did,
 * into `shared/i18n/messages`. What is here is the resolution.
 *
 * **Everything it returns is data, never a function**, and that is the constraint that shaped it.
 * Two of the readers are Client Components — `CatalogFilters` and `CatalogToolbar` — and a
 * `Record<string, string>` crosses the RSC boundary while a function does not: handing one over is
 * the mistake that 500'd every page in this product once already. So `bedroomBucket`, which is a
 * function in the dictionary because the plural rule differs per language, is **resolved into a
 * record here**, keyed by the bucket it describes.
 *
 * The alternative was letting those two components import the dictionary themselves, and that is
 * the expensive shape: it pulls **both** languages into the browser bundle of the catalogue, which
 * is the most-fetched page on the site. This is the same instinct as Leaflet in its own chunk and
 * `pdfjs-dist` behind `next/dynamic` — the server resolves, the client receives strings.
 *
 * One object rather than six exports because the two client components would otherwise take four
 * props each, and a prop list is a thing that drifts from what the component reads.
 */
export type PropertyLabels = {
  readonly types: Readonly<Record<PropertyType, string>>;
  readonly statuses: Readonly<Record<PropertyStatus, string>>;
  readonly lease: Readonly<Record<LeaseTerm, string>>;
  readonly parking: Readonly<Record<ParkingKind, string>>;
  readonly features: Readonly<Record<CatalogFeature, string>>;
  readonly sorts: Readonly<Record<CatalogSort, string>>;
  readonly bedrooms: Readonly<Record<BedroomBucket, string>>;
  /**
   * The fixed words around the facets.
   *
   * They are here rather than being read from `Dictionary["property"]` at the call site, and that is
   * not tidiness — it is the same boundary rule this file exists to keep. That slice holds
   * **functions** (`found`, `bedroomsFact`, `seoTitle`…), so handing it to a Client Component throws
   * *"Functions cannot be passed directly to Client Components"* and 500s the page. It happened
   * twice: once with the language switcher, and again here, one commit after the rule was written
   * down. `propertyLabels.test.ts` now asserts the whole returned object is function-free, which is
   * the only form of that rule a build can check.
   *
   * Anything parameterised — "12 inmuebles encontrados" — is resolved by the server and passed as an
   * already-finished string.
   */
  readonly ui: {
    readonly filterType: string;
    readonly filterBedrooms: string;
    readonly filterTerm: string;
    readonly filterFeatures: string;
    readonly filtersTitle: string;
    readonly anyCity: string;
    readonly sortBy: string;
    readonly noMatch: string;
    readonly clearFilters: string;
  };
};

/**
 * Built from the unions rather than written out, so a value added to `PROPERTY_TYPES` without a
 * word for it fails `pnpm typecheck` here — the same guarantee the dictionary's own `Dictionary`
 * annotation gives across languages, one level down.
 */
export function propertyLabels(locale: Locale): PropertyLabels {
  const copy = dictionaryFor(locale).property;

  /*
   * `PropertyKey` and not `string`: `LEASE_TERMS` is `[6, 12]`, numbers, and its record is keyed by
   * those numbers. `Object.fromEntries` stringifies them on the way in — which is what a JS object
   * does with numeric keys anyway, and is why `labels.lease[6]` still resolves.
   */
  const from = <K extends PropertyKey>(keys: readonly K[], of: Readonly<Record<K, string>>) =>
    Object.fromEntries(keys.map((key) => [key, of[key]])) as unknown as Readonly<Record<K, string>>;

  return {
    types: from(PROPERTY_TYPES, copy.types),
    statuses: from(PROPERTY_STATUSES, copy.statuses),
    lease: from(LEASE_TERMS, copy.lease),
    parking: from(PARKING_KINDS, copy.parking),
    features: from(CATALOG_FEATURES, copy.features),
    sorts: from(CATALOG_SORTS, copy.sorts),
    bedrooms: Object.fromEntries(
      BEDROOM_BUCKETS.map((bucket) => [
        bucket,
        copy.bedroomBucket(bucket, bucket === MAX_BEDROOM_BUCKET),
      ]),
    ) as Readonly<Record<BedroomBucket, string>>,
    ui: {
      filterType: copy.filterType,
      filterBedrooms: copy.filterBedrooms,
      filterTerm: copy.filterTerm,
      filterFeatures: copy.filterFeatures,
      filtersTitle: copy.filtersTitle,
      anyCity: copy.anyCity,
      sortBy: copy.sortBy,
      noMatch: copy.noMatch,
      clearFilters: copy.clearFilters,
    },
  };
}
