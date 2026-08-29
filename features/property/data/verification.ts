import "server-only";

import { cache } from "react";

import { adminDb, adminStorage } from "@/shared/firebase/admin";

import {
  verificationState,
  type PropertyVerification,
  type PropertyVerificationDoc,
  type VerificationState,
} from "../domain/verification";

/** An hour: long enough for a reviewer to read a certificate, short enough that a forward dies. */
const DOCUMENT_LINK_TTL_MS = 60 * 60 * 1000;

type Snapshot = { exists: boolean; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

/**
 * The verification file of one property, or `null`.
 *
 * **No authorization here, deliberately.** It is keyed by property id and every caller has already
 * had to get the property through `getOwnedProperty` (the landlord) or `requireRole("admin")` (the
 * reviewer). Repeating the check would be a second copy of "who may read this", which is exactly
 * what `firestore.rules` declares once for the whole `private/` subtree.
 */
export const getVerification = cache(
  async (propertyId: string): Promise<PropertyVerification | null> => {
    if (!propertyId) return null;

    const snapshot = (await adminDb()
      .collection("properties")
      .doc(propertyId)
      .collection("private")
      .doc("verification")
      .get()) as unknown as Snapshot;

    const data = snapshot.data();
    if (!data) return null;

    const doc = data as unknown as PropertyVerificationDoc;

    return {
      documents: Array.isArray(doc.documents) ? doc.documents : [],
      submittedAt: doc.submittedAt ?? null,
      verifiedAt: doc.verifiedAt ?? null,
      rejectedAt: doc.rejectedAt ?? null,
      note: typeof doc.note === "string" ? doc.note : "",
      registryNumber: typeof doc.registryNumber === "string" ? doc.registryNumber : "",
      reviewerUid: typeof doc.reviewerUid === "string" ? doc.reviewerUid : "",
      createdAt: iso(doc.createdAt),
      updatedAt: iso(doc.updatedAt),
    };
  },
);

/** The file with its documents already signed, ready for whoever may read it. */
export type VerificationView = {
  readonly verification: PropertyVerification | null;
  readonly state: VerificationState;
  /** Keyed by storage path. A path absent from here could not be signed. */
  readonly links: Readonly<Record<string, string>>;
};

/**
 * **The record is read from the document; only the link comes from the signed URL.**
 *
 * The rule this codebase has now paid for four times. Signing can fail — a deleted object, Cloud
 * Storage down, an environment with no service account — and hanging the panel off the signature
 * would take the state, the reviewer's note and the date off the screen along with the file. What
 * is lost when a URL cannot be signed is being able to *open* the certificate, and nothing else.
 */
export async function verificationView(
  verification: PropertyVerification | null,
  currentRegistryNumber: string,
): Promise<VerificationView> {
  const state = verificationState(verification, currentRegistryNumber);
  if (!verification) return { verification, state, links: {} };

  const signed = await Promise.all(
    verification.documents.map(
      async (document) => [document.path, await sign(document.path)] as const,
    ),
  );

  return {
    verification,
    state,
    links: Object.fromEntries(signed.filter((one): one is [string, string] => one[1] !== null)),
  };
}

async function sign(path: string): Promise<string | null> {
  try {
    const [url] = await adminStorage()
      .bucket()
      .file(path)
      .getSignedUrl({ action: "read", expires: Date.now() + DOCUMENT_LINK_TTL_MS });

    return url;
  } catch (error) {
    console.error(`could not sign ${path}:`, error);

    return null;
  }
}

/** One row of the reviewer's queue: the property, who published it, and what was attached. */
export type PendingVerification = {
  readonly propertyId: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  readonly landlordUid: string;
  readonly submittedAt: string;
  readonly registryNumber: string;
  readonly documents: PropertyVerification["documents"];
};

/**
 * Ceiling on the reviewer's queue, and the same trade `CATALOG_MAX_SCAN` makes.
 *
 * A `collectionGroup` on `private` would sweep every address in the product to find the few
 * verification documents, so the queue is built from the properties instead: published listings,
 * newest first, one `get` each on their private file. It stops being the right shape at a few
 * hundred listings, and what it wants then is a `verificationPending` flag on the public document
 * with its own index — not a bigger number here.
 */
export const VERIFICATION_QUEUE_MAX_SCAN = 200;

export async function listPendingVerifications(): Promise<readonly PendingVerification[]> {
  const listings = await adminDb()
    .collection("properties")
    .where("status", "==", "available")
    .orderBy("createdAt", "desc")
    .limit(VERIFICATION_QUEUE_MAX_SCAN)
    .get();

  const rows = await Promise.all(
    listings.docs.map(async (listing) => {
      const verification = await getVerification(listing.id);
      /* Only what is waiting on a person: decided files are the record, not the queue. */
      if (!verification?.submittedAt || verification.verifiedAt || verification.rejectedAt) {
        return null;
      }

      const data = listing.data();

      return {
        propertyId: listing.id,
        propertyTitle: String(data.title ?? ""),
        propertyCity: String((data.area as { city?: string } | undefined)?.city ?? ""),
        landlordUid: String(data.landlordUid ?? ""),
        submittedAt: verification.submittedAt,
        registryNumber: verification.registryNumber,
        documents: verification.documents,
      } satisfies PendingVerification;
    }),
  );

  return rows.filter((row): row is PendingVerification => row !== null);
}
