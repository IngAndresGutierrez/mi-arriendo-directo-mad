import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

import { propertySlug } from "../domain/property";
import type { Property, PropertyDoc, PropertyLocation } from "../domain/property";

/** Firestore hands back `DocumentData`: nothing here is typed until this module says so. */
type Snapshot = { id: string; exists: boolean; data: () => Record<string, unknown> | undefined };

/**
 * Serializes a stored property for the UI.
 *
 * `Timestamp` does not cross to a component, so the two audit dates become ISO strings. A
 * document that is missing them (written by hand, or mid-migration) still renders: the catalog
 * should not 500 because someone seeded a document without `updatedAt`.
 */
function toProperty(snapshot: Snapshot): Property | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as PropertyDoc;
  const iso = (value: unknown): string =>
    typeof value === "object" && value !== null && "toDate" in value
      ? (value as { toDate: () => Date }).toDate().toISOString()
      : new Date(0).toISOString();

  return {
    ...doc,
    id: snapshot.id,
    // Documents published before slugs existed still get a canonical URL, derived on read.
    slug: doc.slug || propertySlug(doc.title, doc.area?.city ?? ""),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * A property as a given viewer may see it.
 *
 * The catalog is public, so only `available` listings are returned to a stranger. The owner
 * additionally sees their own drafts and rented listings, which is what makes "publish and then
 * look at it" work before anyone else can find it.
 *
 * Cached per request: the page and its metadata both need the same read.
 */
export const getVisibleProperty = cache(
  async (id: string, viewerUid: string | null): Promise<Property | null> => {
    const snapshot = await adminDb().collection("properties").doc(id).get();
    const property = toProperty(snapshot as unknown as Snapshot);
    if (!property) return null;

    const isOwner = viewerUid !== null && property.landlordUid === viewerUid;
    if (property.status !== "available" && !isOwner) return null;

    return property;
  },
);

/**
 * The exact street address, which lives outside the public document.
 *
 * Returns `null` for anyone who is not the owner — the same answer as "there is no address",
 * on purpose: a caller cannot tell the difference between "not allowed" and "not there", so a
 * mistake at the call site leaks nothing.
 */
export const getPropertyLocation = cache(
  async (id: string, viewerUid: string | null): Promise<PropertyLocation | null> => {
    if (!viewerUid) return null;

    const property = await adminDb().collection("properties").doc(id).get();
    if (!property.exists || property.data()?.landlordUid !== viewerUid) return null;

    const location = await adminDb().collection("properties").doc(id).collection("private").doc("location").get();
    const line = location.data()?.line;

    return typeof line === "string" ? { line } : null;
  },
);

/**
 * The property behind a slug, or `null`.
 *
 * One `get` on the reservation and one on the property: no query, so no composite index and no
 * `list` rule to widen. Visibility is still decided by `getVisibleProperty`, which is where the
 * "only the owner sees a draft" rule lives.
 */
export const getVisiblePropertyBySlug = cache(
  async (slug: string, viewerUid: string | null): Promise<Property | null> => {
    const reservation = await adminDb().collection("propertySlugs").doc(slug).get();
    const propertyId = reservation.data()?.propertyId;
    if (typeof propertyId !== "string") return null;

    return getVisibleProperty(propertyId, viewerUid);
  },
);

/**
 * Every listing a landlord owns, newest first — including drafts and rented ones, which is the
 * point: this is the management screen, not the catalog.
 *
 * Not wrapped in `cache()` like the single reads: it is called once per render and caching it
 * would only hide a stale list behind a mutation.
 */
export async function listLandlordProperties(landlordUid: string): Promise<readonly Property[]> {
  const snapshot = await adminDb()
    .collection("properties")
    .where("landlordUid", "==", landlordUid)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snapshot.docs
    .map((doc) => toProperty(doc as unknown as Snapshot))
    .filter((property): property is Property => property !== null);
}

/**
 * A property the caller owns, whatever its status — the read every mutation starts from.
 *
 * Returns `null` for a stranger, the same answer as "there is no such property": a caller
 * cannot tell the two apart, so a mistake at the call site leaks nothing.
 */
export const getOwnedProperty = cache(
  async (id: string, landlordUid: string): Promise<Property | null> => {
    const snapshot = await adminDb().collection("properties").doc(id).get();
    const property = toProperty(snapshot as unknown as Snapshot);

    return property && property.landlordUid === landlordUid ? property : null;
  },
);
