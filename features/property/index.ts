/**
 * Public API of the property module. Anything not exported here is internal to the feature.
 */
export {
  approximateLocation,
  APPROX_RADIUS_M,
  LEASE_TERMS,
  propertyIdFromSlug,
  propertySlug,
  PROPERTY_TYPES,
  PROPERTY_VIDEO_TYPES,
  acceptedVideo,
  propertyMonthlyCost,
  publicLocationLabel,
  publishBlocker,
  type LeaseTerm,
  type Property,
  type PropertyPhoto,
  type PropertyVideo,
  type PropertyType,
} from "./domain/property";
export {
  getPropertyLocation,
  getVisibleProperty,
  getVisiblePropertyBySlug,
  resolvePublicProperty,
} from "./data/property";
export { CATALOG_MAX_SCAN, listAvailableProperties } from "./data/property";
export { countCities, showcaseListings, type CityCount } from "./domain/cities";
export {
  countFacets,
  filterProperties,
  hasActiveFilters,
  paginate,
  sortProperties,
  CATALOG_PAGE_SIZE,
  type CatalogFacets,
  type CatalogFilters as CatalogFilterState,
} from "./domain/catalog";
export {
  catalogJsonLd,
  catalogMetaDescription,
  catalogMetaTitle,
  propertyBreadcrumbJsonLd,
  propertyImageAlt,
  propertyJsonLd,
  propertyMetaDescription,
  propertyMetaTitle,
} from "./domain/seo";
export { catalogQuery, parseCatalogFilters, parseCityFilter } from "./validations/catalog";
export { publishProperty } from "./actions/publish-property";
export { deleteProperty, publishDraft, updateProperty } from "./actions/manage-property";
export { getOwnedProperty, hasProperties, listLandlordProperties } from "./data/property";
export { PropertyForm } from "./ui/property-form";
export { PropertyManageCard } from "./ui/property-manage-card";
export { PropertyVideoPlayer } from "./ui/property-video";
export { PropertyCard } from "./ui/property-card";
export { PropertyTeaserCard } from "./ui/property-teaser-card";
export { CatalogFilters } from "./ui/catalog-filters";
export { CatalogToolbar } from "./ui/catalog-toolbar";
export { PropertyFacts } from "./ui/property-facts";
export { PropertyGallery } from "./ui/property-gallery";
export { PropertyPriceCard } from "./ui/property-price-card";
export { PropertyZoneMap } from "./ui/property-zone-map";

/** The label records, resolved for one language. Replaces the six `X_LABELS` constants. */
export { propertyLabels, type PropertyLabels } from "./domain/labels";
