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

/**
 * Structural view of a Firestore `Timestamp`. The domain must not import the SDK — it is the
 * one layer that stays testable in milliseconds — and all it needs from a timestamp is the
 * ability to become a `Date`.
 */
type StoredTimestamp = { toDate(): Date };

/** Long-term rental only: this product does not do nightly or monthly stays. */
export const LEASE_TERMS = [6, 12] as const;
export type LeaseTerm = (typeof LEASE_TERMS)[number];

export const LEASE_TERM_LABELS: Readonly<Record<LeaseTerm, string>> = {
  6: "6 meses",
  12: "1 año",
};

export const PROPERTY_TYPES = ["apartment", "house", "studio", "retail", "office"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Keys in English (they are stored values); labels in es-CO (they are copy). */
export const PROPERTY_TYPE_LABELS: Readonly<Record<PropertyType, string>> = {
  apartment: "Apartamento",
  house: "Casa",
  studio: "Apartaestudio",
  retail: "Local",
  office: "Oficina",
};

export const PROPERTY_STATUSES = ["draft", "available", "rented", "inactive"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Readonly<Record<PropertyStatus, string>> = {
  draft: "Borrador",
  available: "Disponible",
  rented: "Arrendado",
  inactive: "Inactivo",
};

/**
 * Parking, as it is actually offered in a Colombian building: a private spot, a communal one
 * you queue for, or none. It is not a count — "2 parqueaderos" is rare enough that asking for
 * a number made every landlord type 0 or 1 and told the tenant nothing about which kind.
 */
export const PARKING_KINDS = ["private", "communal", "none"] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];

export const PARKING_LABELS: Readonly<Record<ParkingKind, string>> = {
  private: "Tiene parqueadero",
  communal: "Parqueadero comunitario",
  none: "No tiene parqueadero",
};

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

/** The public part of the address. The street lives in `PropertyLocation`. */
export type PropertyArea = {
  readonly neighborhood: string;
  readonly city: string;
  readonly department: Department;
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

/** `properties/{id}/private/location` — the exact street, never public. */
export type PropertyLocation = {
  readonly line: string;
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
