/**
 * The property domain: what a landlord publishes and what the public catalog shows.
 *
 * Three shapes, and the difference between them is not cosmetic:
 *
 * - `PropertyDoc` — what lives in `properties/{id}`. **Public by design**: the catalog is
 *   readable without a session, so nothing in this document may be private.
 * - `Property` — what the UI consumes: same data, serializable (no `Timestamp`).
 * - `PropertyLocation` — the exact street address. It lives in a **separate subcollection**
 *   (`properties/{id}/private/location`) because Security Rules cannot hide a field: granting
 *   `get` on the document hands over every key in it. This is someone's home, so the street
 *   is revealed only to the owner, to an admin, and later to a tenant whose application was
 *   approved.
 *
 * Money is whole pesos (see `shared/format/money.ts`). Dates that are calendar days —
 * `availableFrom` — are `YYYY-MM-DD` strings, not timestamps: "available on December 7th"
 * means the same thing in any time zone, and a `Timestamp` would drift a day.
 */
import type { Department } from "@/shared/geo/colombia";
import { roundPoint, type GeoPoint } from "@/shared/geo/point";

/**
 * Structural view of a Firestore `Timestamp`. The domain must not import the SDK — it is the
 * one layer that stays testable in milliseconds — and all it needs from a timestamp is the
 * ability to become a `Date`.
 */
type StoredTimestamp = { toDate(): Date };

/**
 * **The words for these unions live in `shared/i18n/messages`, resolved by `domain/labels.ts`.**
 *
 * They used to be `PROPERTY_TYPE_LABELS`, `LEASE_TERM_LABELS`, `PROPERTY_STATUS_LABELS` and
 * `PARKING_LABELS`, right here beside each union — the "keys in English, labels in es-CO" pattern.
 * The keys have not changed and are still the stored values; a second language is what moved the
 * words out. `propertyLabels(locale)` returns exactly the same records, built from these unions, so
 * a value added below with no word for it still fails `pnpm typecheck`.
 */

/** Long-term rental only: this product does not do nightly or monthly stays. */
export const LEASE_TERMS = [6, 12] as const;
export type LeaseTerm = (typeof LEASE_TERMS)[number];


export const PROPERTY_TYPES = ["apartment", "house", "studio", "retail", "office"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];


export const PROPERTY_STATUSES = ["draft", "available", "rented", "inactive"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];


/**
 * Parking, as it is actually offered in a Colombian building: a private spot, a communal one
 * you queue for, or none. It is not a count — "2 parqueaderos" is rare enough that asking for
 * a number made every landlord type 0 or 1 and told the tenant nothing about which kind.
 */
export const PARKING_KINDS = ["private", "communal", "none"] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];


/**
 * Socio-economic stratum, 1 to 6. It is not decoration: in Colombia it sets the utility
 * tariffs a tenant will pay, so leaving it out would hide part of the real cost.
 */
export const STRATA = [1, 2, 3, 4, 5, 6] as const;
export type Stratum = (typeof STRATA)[number];

/** Guard rails for money, so a typo cannot publish a $12 or a $9.000.000.000 rental. */
export const RENT_MIN = 200_000;
export const RENT_MAX = 100_000_000;
export const AREA_MIN = 10;
export const AREA_MAX = 2_000;
export const PHOTOS_MIN = 1;
export const PHOTOS_MAX = 20;

/** A photo already stored in Cloud Storage. `path` is what the rules can check. */
export type PropertyPhoto = {
  /** `properties/{landlordUid}/{id}.jpg` — always inside the owner's folder. */
  readonly path: string;
  readonly url: string;
};

/**
 * The public part of the address. The street lives in `PropertyLocation`.
 *
 * `approx` is the only coordinate that may appear in a world-readable document, and it is
 * deliberately blunt: see `approximateLocation`. Optional, because every listing published
 * before the map existed has none and must keep rendering.
 */
export type PropertyArea = {
  readonly neighborhood: string;
  readonly city: string;
  readonly department: Department;
  readonly approx?: GeoPoint;
};

/** Shape persisted in `properties/{id}`. Everything here is world-readable when available. */
export interface PropertyDoc {
  readonly landlordUid: string;
  readonly title: string;
  readonly description: string;
  readonly type: PropertyType;
  readonly status: PropertyStatus;
  /** Monthly rent, whole pesos. */
  readonly rent: number;
  /** Building admin fee, whole pesos. `0` when the property has none. */
  readonly adminFee: number;
  //
  // There is deliberately NO deposit field. Ley 820 de 2003 forbids cash deposits and real
  // guarantees on urban housing leases in Colombia, so storing one would be modelling an
  // illegal charge. A landlord who wants coverage uses a co-signer or a guarantee company,
  // which is a different feature with a different shape.
  readonly areaM2: number;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly parking: ParkingKind;
  readonly stratum: Stratum;
  readonly furnished: boolean;
  readonly petsAllowed: boolean;
  readonly minLeaseMonths: LeaseTerm;
  /** `YYYY-MM-DD`: a calendar day, not an instant. */
  readonly availableFrom: string;
  readonly area: PropertyArea;
  /** Kept on the document so the canonical URL cannot drift from what was published. */
  readonly slug: string;
  readonly photos: readonly PropertyPhoto[];
  readonly createdAt: StoredTimestamp;
  readonly updatedAt: StoredTimestamp;
}

/** Shape that crosses to components: 100% serializable. */
export type Property = Omit<PropertyDoc, "createdAt" | "updatedAt"> & {
  readonly id: string;
  /** ISO 8601. */
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * `properties/{id}/private/location` — what is not public about a property.
 *
 * The street, and the **matrícula inmobiliaria**: the number the Oficina de Registro de
 * Instrumentos Públicos gives every property in Colombia. It is required to publish, because a
 * listing without one cannot be checked against the registry — and it stays private for the same
 * reason the address does: with it, anybody can pull the certificate and read the address off it,
 * so publishing the number would publish the address by the back door.
 */
export type PropertyLocation = {
  readonly line: string;
  /** `050-123456` — the registry number. Empty on listings published before it was required. */
  readonly registryNumber: string;
  /**
   * Where the property is, to the metre.
   *
   * It sits here rather than on the public document because **a precise coordinate is the
   * address**: paste it into any map and the street name comes back. Storing it beside the
   * street is the same decision, expressed twice. Absent when the landlord did not place a
   * point — which is allowed, and is what every listing published before the map has.
   */
  readonly point?: GeoPoint;
};

/**
 * The slug that makes a shared link readable: `apartaestudio-en-los-alcazares-manizales`.
 *
 * A listing is pasted into WhatsApp, Facebook Marketplace or a broker's group, where the URL
 * is often all the context there is before the preview loads. The id stays in the path — it is
 * what resolves the document — but it stops being the whole of it.
 *
 * Accents are folded rather than dropped, so "Chinchiná" becomes "chinchina" and not "chinchin".
 */
export function propertySlug(title: string, city: string): string {
  return `${title} ${city}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

/**
 * The document id hidden at the end of a slug, or `null` if the segment carries none.
 *
 * Firestore's generated ids are twenty characters of letters and digits — never a hyphen — so
 * the last hyphen-separated token is unambiguous.
 */
export function propertyIdFromSlug(segment: string): string | null {
  const id = segment.split("-").at(-1) ?? "";
  return /^[A-Za-z0-9]{20}$/.test(id) ? id : null;
}

/** What the catalog shows as the headline number: rent plus admin fee. */
export function propertyMonthlyCost(property: Pick<Property, "rent" | "adminFee">): number {
  return property.rent + property.adminFee;
}

/**
 * Where the property is, for a public audience: neighbourhood and city, never the street.
 *
 * Used by the detail header and, later, by the catalog card — so the rule "the street is not
 * public" is expressed once instead of in every component that renders an address.
 */
export function publicLocationLabel(area: PropertyArea): string {
  return `${area.neighborhood}, ${area.city}`;
}

/**
 * How coarse the coordinate on the public document is, in degrees.
 *
 * `0.005°` is a cell of about 550 m on a side anywhere in Colombia. That is neighbourhood
 * precision, which is exactly what the listing already publishes in words ("Palermo,
 * Manizales") — so the map adds a picture of what a tenant could already read, and nothing more.
 */
export const LOCATION_GRID = 0.005;

/**
 * The radius the public map draws around that coordinate, in metres.
 *
 * It is not a decorative number: the property is **provably** inside it. The worst case is a
 * point in the corner of its cell, half a diagonal from the centre — `sqrt(2) · 550/2 ≈ 394 m` —
 * and `property.test.ts` asserts it across the country rather than trusting this comment.
 *
 * So the circle is a true statement to a tenant ("it is somewhere in here") instead of the
 * usual vague blob, and it stays true if someone changes `LOCATION_GRID`, because the test
 * fails first.
 */
export const APPROX_RADIUS_M = 400;

/**
 * The coordinate a listing may publish, from the one the landlord placed.
 *
 * The point is snapped to the centre of its `LOCATION_GRID` cell — **not jittered**. Random
 * noise looks safer and is worse: it changes on every render, so anyone who loads the page a
 * few times averages it away and recovers the real point. A deterministic snap gives up the
 * same information every time, which is the definition of the guarantee this makes: the reader
 * learns the cell, and nothing inside it.
 *
 * Pure, so it can be checked. The exact point never leaves `properties/{id}/private/location`.
 */
export function approximateLocation(point: GeoPoint): GeoPoint {
  const snap = (value: number): number =>
    Math.floor(value / LOCATION_GRID) * LOCATION_GRID + LOCATION_GRID / 2;

  return roundPoint({ lat: snap(point.lat), lng: snap(point.lng) });
}
