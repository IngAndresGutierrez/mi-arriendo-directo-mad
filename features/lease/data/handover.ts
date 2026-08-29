import "server-only";

import { cache } from "react";

import { adminDb, adminStorage } from "@/shared/firebase/admin";

import {
  handoverState,
  type Handover,
  type HandoverDoc,
  type HandoverKind,
  type HandoverPhoto,
  type HandoverState,
} from "../domain/handover";

/** An hour: long enough to look through an acta, short enough that a forwarded link dies. */
const PHOTO_LINK_TTL_MS = 60 * 60 * 1000;

type Snapshot = { id: string; exists: boolean; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

/**
 * The stored acta, defaulted field by field.
 *
 * Every optional is given a value here rather than trusted, for the reason `updates` on an incident
 * already cost this module a `Cannot read properties of undefined`: an acta written before a field
 * existed has no such key, and those documents will be in the database the day the second field is
 * added.
 */
function toHandover(snapshot: Snapshot): Handover | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as HandoverDoc;

  return {
    kind: snapshot.id as HandoverKind,
    areas: Array.isArray(doc.areas) ? doc.areas : [],
    fingerprint: typeof doc.fingerprint === "string" ? doc.fingerprint : "",
    submittedAt: doc.submittedAt ?? null,
    acceptance: doc.acceptance ?? null,
    objection: doc.objection ?? null,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * One acta of a tenancy, whatever state it is in.
 *
 * **Authorization is not here**, deliberately: this is keyed by lease id and the caller has already
 * had to get one through `getLeaseFor`, which answers `null` to a stranger. Repeating the party
 * check would be a second copy of "who may read this tenancy" — the pair whose first divergence
 * nobody notices, which is the reason `firestore.rules` declares it once for the whole subtree.
 */
export const getHandover = cache(
  async (leaseId: string, kind: HandoverKind): Promise<Handover | null> => {
    if (!leaseId) return null;

    const snapshot = await adminDb()
      .collection("leases")
      .doc(leaseId)
      .collection("handovers")
      .doc(kind)
      .get();

    return toHandover(snapshot as unknown as Snapshot);
  },
);

/** Both actas at once, because the screen shows them side by side and the checkout is gated on the check-in. */
export const getHandovers = cache(
  async (
    leaseId: string,
  ): Promise<{ readonly checkin: Handover | null; readonly checkout: Handover | null }> => {
    const [checkin, checkout] = await Promise.all([
      getHandover(leaseId, "checkin"),
      getHandover(leaseId, "checkout"),
    ]);

    return { checkin, checkout };
  },
);

/** A photo with a link that works for the next hour, or `null` when it cannot be signed. */
export type SignedPhoto = HandoverPhoto & { readonly url: string };

/**
 * The acta ready to render: its state, and every photo with a link that already works.
 *
 * **The record is read from the document; only the link comes from the signed URL.** The rule this
 * module has now paid for three times — the contract panel, the receipt, the incident — and it is
 * the same failure each time: hanging the whole block off the signature means a photo that cannot
 * be signed (a deleted object, Cloud Storage down, an environment with no service account) takes
 * the area's name, its condition and the tenant's objection off the screen with it. What is lost
 * when a URL cannot be signed is being able to *open* the picture, and nothing else — which is also
 * what makes this screen drivable in the emulated suite, where there is no service account.
 */
export type HandoverView = {
  readonly handover: Handover | null;
  readonly state: HandoverState;
  /** Keyed by storage path. A path absent from here is a photo that could not be signed. */
  readonly links: Readonly<Record<string, string>>;
};

export async function handoverView(handover: Handover | null): Promise<HandoverView> {
  const state = handoverState(handover);
  if (!handover) return { handover, state, links: {} };

  const paths = [
    ...handover.areas.flatMap((area) => area.photos.map((photo) => photo.path)),
    ...(handover.objection?.photos ?? []).map((photo) => photo.path),
  ];

  /*
   * Signed in parallel: a dozen areas with six photos each is seventy round trips, and awaited one
   * after another that is the page's whole render budget spent on links nobody may click.
   */
  const signed = await Promise.all(paths.map(async (path) => [path, await signPhoto(path)] as const));

  return {
    handover,
    state,
    links: Object.fromEntries(
      signed.filter((entry): entry is [string, string] => entry[1] !== null),
    ),
  };
}

async function signPhoto(path: string): Promise<string | null> {
  try {
    const [url] = await adminStorage()
      .bucket()
      .file(path)
      .getSignedUrl({ action: "read", expires: Date.now() + PHOTO_LINK_TTL_MS });

    return url;
  } catch (error) {
    // One photo whose object is gone must not take the acta down with it.
    console.error(`could not sign ${path}:`, error);

    return null;
  }
}
