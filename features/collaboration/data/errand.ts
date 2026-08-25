import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

import type { Errand, ErrandDoc } from "../domain/errand";

type Snapshot = { id: string; exists?: boolean; data: () => Record<string, unknown> | undefined };

/**
 * Fifty per side, and the number is the `list` rule's bound rather than a guess.
 *
 * A collaborator is a sporadic figure — a handful of jobs a month at most — so this is generous for
 * them and, for a landlord, the same reasoning `MAX_GRANTS` uses: somebody running more errands than
 * this through one account is an agency, which is a different product.
 */
const MAX_ERRANDS = 50;

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

/** Present only when the stored field is: `undefined` means "has not happened", never epoch zero. */
function optionalIso(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : iso(value);
}

/**
 * Serializes a stored errand for the UI.
 *
 * **The optional timestamps are converted with `optionalIso`, not `iso`.** That distinction is the
 * whole state machine: `errandState` reads presence, so defaulting `completedAt` to epoch zero the
 * way `createdAt` is defaulted would mark every errand as done. The two helpers exist so that
 * mistake has to be made on purpose.
 */
function toErrand(snapshot: Snapshot): Errand | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as ErrandDoc;

  return {
    ...doc,
    id: snapshot.id,
    // Defaulted rather than trusted: an errand written before evidence existed has no such key,
    // and the type would be claiming an array — the `updates` lesson from incidents.
    evidence: doc.evidence ?? [],
    dueAt: iso(doc.dueAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    acceptedAt: optionalIso(doc.acceptedAt),
    declinedAt: optionalIso(doc.declinedAt),
    completedAt: optionalIso(doc.completedAt),
    cancelledAt: optionalIso(doc.cancelledAt),
  };
}

/**
 * The errands given to one collaborator, newest first.
 *
 * **This is the only query the collaborator's own screens run**, and it is filtered by their uid
 * rather than by anything they can pass in: the whole area exists to show them their own work and
 * nothing else. The rules enforce the same thing from the other side, so a mistake here is caught
 * rather than served.
 *
 * `where(...).orderBy(...)` needs a composite index, and this product has been bitten by exactly
 * that: the emulator does not enforce them, so a missing one passes the entire local bar and then
 * answers `9 FAILED_PRECONDITION` in production. Both queries in this file have their entry in
 * `firestore.indexes.json`, added in the same change.
 */
export const listErrandsForCollaborator = cache(
  async (collaboratorUid: string): Promise<readonly Errand[]> => {
    if (!collaboratorUid) return [];

    const snapshot = await adminDb()
      .collection("errands")
      .where("collaboratorUid", "==", collaboratorUid)
      .orderBy("dueAt", "desc")
      .limit(MAX_ERRANDS)
      .get();

    return snapshot.docs
      .map((document) => toErrand(document as unknown as Snapshot))
      .filter((errand): errand is Errand => errand !== null);
  },
);

/** The errands a landlord has handed out, newest first. */
export const listErrandsForLandlord = cache(async (landlordUid: string): Promise<readonly Errand[]> => {
  if (!landlordUid) return [];

  const snapshot = await adminDb()
    .collection("errands")
    .where("landlordUid", "==", landlordUid)
    .orderBy("dueAt", "desc")
    .limit(MAX_ERRANDS)
    .get();

  return snapshot.docs
    .map((document) => toErrand(document as unknown as Snapshot))
    .filter((errand): errand is Errand => errand !== null);
});

/**
 * One errand, for somebody who is a party to it.
 *
 * Returns `null` for anybody else — the same answer as "there is no such errand", on purpose. A
 * caller cannot tell the difference between "not allowed" and "not there", so a mistake at the call
 * site leaks nothing, which is the rule `getPropertyLocation` already follows.
 */
export const getErrandFor = cache(
  async (errandId: string, viewerUid: string): Promise<Errand | null> => {
    // An empty id is "no such errand", not a crash: `doc("")` throws, which is a 500 where a 404
    // belongs — the lesson `getVisiblePropertyBySlug` pays for at build time.
    if (!errandId || !viewerUid) return null;

    const snapshot = await adminDb().collection("errands").doc(errandId).get();
    const errand = toErrand(snapshot as unknown as Snapshot);
    if (!errand) return null;

    const isParty = errand.collaboratorUid === viewerUid || errand.landlordUid === viewerUid;

    return isParty ? errand : null;
  },
);
