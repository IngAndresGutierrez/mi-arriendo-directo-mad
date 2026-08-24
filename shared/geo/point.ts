/**
 * A point on the map, and the two things this product needs to know about one.
 *
 * It lives beside `colombia.ts` and `municipalities.ts` rather than inside a feature because a
 * coordinate is not a property fact: a tenancy, an incident or a landlord's own address could all
 * carry one. What is *not* here is the rule about how precise a coordinate may be in public —
 * that is a privacy decision about listings, and it lives in `features/property/domain/property.ts`
 * next to the document it protects.
 *
 * Pure: no Firebase, no React, no `next`. It is the layer that gets tested in milliseconds.
 */

/** Latitude and longitude in decimal degrees, WGS 84 — what every map API speaks. */
export type GeoPoint = {
  readonly lat: number;
  readonly lng: number;
};

/**
 * A box around Colombia, islands included.
 *
 * It is a **sanity check, not a border**. What it catches is the mistake that actually happens:
 * a swapped pair (`lng` where `lat` goes puts the point in Antarctica), a zeroed default (`0,0`
 * is the Gulf of Guinea) and a coordinate typed with the sign dropped. The west edge reaches
 * `-82` for San Andrés and Providencia, which are a thousand kilometres off the mainland and
 * would otherwise be rejected as impossible.
 */
export const COLOMBIA_BOUNDS = {
  minLat: -4.4,
  maxLat: 13.6,
  minLng: -82.2,
  maxLng: -66.7,
} as const;

/**
 * Where a map opens when there is nothing better to centre it on.
 *
 * Bogotá and its savanna — deliberately not the country's geometric centre, which is empty
 * jungle in Guaviare. A landlord who has to pan from somewhere should start where most of the
 * country's housing is.
 */
export const COLOMBIA_FALLBACK_CENTER: GeoPoint = { lat: 4.65, lng: -74.1 };

/** The zoom that shows the country, for that same case. */
export const COLOMBIA_FALLBACK_ZOOM = 6;

/** Mean Earth radius in metres, as used by every haversine implementation. */
const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Is this a real pair of finite degrees at all? */
export function isGeoPoint(value: unknown): value is GeoPoint {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Inside the box above. See `COLOMBIA_BOUNDS` for what this does and does not claim. */
export function isInColombia(point: GeoPoint): boolean {
  return (
    point.lat >= COLOMBIA_BOUNDS.minLat &&
    point.lat <= COLOMBIA_BOUNDS.maxLat &&
    point.lng >= COLOMBIA_BOUNDS.minLng &&
    point.lng <= COLOMBIA_BOUNDS.maxLng
  );
}

/**
 * Great-circle distance in metres between two points.
 *
 * Haversine, which is accurate to a few metres in a kilometre — far more than enough for what it
 * is used for here: proving that the approximate point a listing publishes is never further from
 * the real one than the radius the page draws around it.
 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const half =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(half)));
}

/** Six decimals is about 11 cm: past that a coordinate is storing floating-point noise. */
export function roundPoint(point: GeoPoint): GeoPoint {
  const round = (value: number): number => Math.round(value * 1e6) / 1e6;
  return { lat: round(point.lat), lng: round(point.lng) };
}

/**
 * A coordinate as a person reads it: `5,06784 · -75,49123`.
 *
 * es-CO, so the decimal separator is a comma — the same locale every amount and date in the
 * product is formatted with.
 */
export function formatPoint(point: GeoPoint): string {
  const format = (value: number): string =>
    value.toLocaleString("es-CO", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
  return `${format(point.lat)} · ${format(point.lng)}`;
}
