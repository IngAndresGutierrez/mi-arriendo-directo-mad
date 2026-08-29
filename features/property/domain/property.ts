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
 * The listing's walkthrough video, and **one is the whole design**.
 *
 * A property is a place, and what a video adds over twenty photographs is the one thing
 * photographs are bad at: walking through it — how the rooms connect, how much light the
 * corridor gets, how loud the street is. That question has one answer, so this is a field and
 * not an array. Three clips would make the tenant choose which to watch, turn the gallery into
 * a playlist, and put 150 MB of un-transcoded video behind a public page whose readers are
 * mostly on a Colombian mobile plan.
 *
 * It is **deliberately not a member of `photos`**. `photos[0]` is the cover: it is what the
 * catalogue card draws, what the generated Open Graph card draws, and what this player uses as
 * its own poster frame. A video sitting in that array would make every one of those consumers
 * ask "is this one playable?" first, and the day one forgot to ask, the cover of a listing
 * would be a file no `<img>` can render. A field that means two things is where the bug goes.
 *
 * `contentType` is stored because the `<source type>` attribute is what lets a browser decide
 * whether to bother fetching 50 MB, and because the fallback needs to name the format. There is
 * deliberately no `bytes` and no `duration`: nothing reads them, and this product has no
 * transcoding step that could produce a duration it did not invent.
 */
export const PROPERTY_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type PropertyVideoType = (typeof PROPERTY_VIDEO_TYPES)[number];

/**
 * 50 MB — the same number an incident's video gets, and for the same reason: it is about a
 * minute off a phone at a middling setting.
 *
 * It is a **second** limit and not a bigger shared one. `PHOTO_MAX_BYTES` stays at 8 MB because a
 * 50 MB *photograph* is a mistake nobody makes on purpose, and the cheapest place to stop a
 * mistake is where it can still be described in a sentence the landlord can act on: "recórtalo".
 */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** The walkthrough, once the browser has put it in the landlord's own folder. */
export type PropertyVideo = {
  /** `properties/{landlordUid}/{id}.mp4` — always inside the owner's folder, checked on the way in. */
  readonly path: string;
  readonly url: string;
  /** What went into Cloud Storage, and what comes out as `<source type>`. */
  readonly contentType: PropertyVideoType;
};

export function isPropertyVideoType(value: string): value is PropertyVideoType {
  return (PROPERTY_VIDEO_TYPES as readonly string[]).includes(value);
}

/**
 * Whether this file can be the listing's video — and, when it can, **what its content type is**.
 *
 * Two things in one answer, and that is the point rather than convenience. The alternative is a
 * predicate plus a `file.type as PropertyVideoType` at the call site, and that cast is a claim
 * the compiler cannot check sitting one line away from the check that would have justified it.
 * Returning the narrowed value means the only way to obtain a `PropertyVideoType` is to have
 * asked. Same shape as `validateAvailableFrom`.
 *
 * The refusal is a **reason code, never a sentence**, because this surface is translated: the
 * uploader is handed its words as a `Dictionary["propertyForm"]` slice, so a Spanish string
 * returned from the domain would render inside the English form. `attachmentProblem` in
 * `features/lease` does return the sentence, which is right there — the incidents are one of the
 * surfaces still in Spanish — and copying it here would have translated the form and left this
 * one message behind, which is the bug `catalogMetaTitle` already paid for.
 *
 * `too_large` and `unsupported_type` stay apart because they are acted on differently: one says
 * trim it, the other says convert it, and "no pudimos subir el video" says neither.
 */
export function acceptedVideo(
  file: { readonly type: string; readonly size: number },
):
  | { readonly ok: true; readonly contentType: PropertyVideoType }
  | { readonly ok: false; readonly reason: "unsupported_type" | "empty" | "too_large" } {
  const contentType = file.type;
  if (!isPropertyVideoType(contentType)) return { ok: false, reason: "unsupported_type" };
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (file.size > VIDEO_MAX_BYTES) return { ok: false, reason: "too_large" };

  return { ok: true, contentType };
}

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
  /**
   * The walkthrough, when the landlord recorded one. **Optional, and it stays optional** — the
   * same rule the map point follows and for the same two reasons: every listing published before
   * this feature has none and must keep rendering in its own edit form, and a landlord with no
   * video is not a landlord with an incomplete listing. It is also why it can never stand in for
   * `PHOTOS_MIN`: the card and the shared card both need a still image.
   */
  readonly video?: PropertyVideo;
  /**
   * ISO 8601, and **present only when a person read the certificado de tradición y libertad** and
   * found this account named on it as owner. Absent otherwise — see `domain/verification.ts`.
   *
   * The one field on this public document that is **not** written by its owner: `firestore.rules`
   * freezes it against every client, so it can only arrive through `decideVerification` with the
   * Admin SDK. It is the single claim on the page a stranger is asked to trust, and its subject is
   * exactly the person with a reason to forge it.
   *
   * It lives here, denormalised onto the public document, because the catalogue draws the badge on
   * six cards from one query — reading a private subdocument per card would be six extra reads on
   * the most-fetched page in the product. The evidence stays in
   * `properties/{id}/private/verification`, where the certificate's address belongs.
   */
  readonly ownershipVerifiedAt?: string;
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

/**
 * What a listing is missing before it can go on the catalogue, or `null` when nothing is.
 *
 * **A draft is a property with everything filled in except its photos**, and that is the whole
 * definition. It exists because the two halves of publishing arrive at different times: a
 * landlord knows the canon, the stratum and the matrícula while sitting at a desk, and the
 * photographs need somebody to be *at* the flat — which is an errand
 * (`features/collaboration`, `type: "photos"`), and an errand is about a property, so the
 * property has to exist first. Before this, the only way to have a property was to publish it,
 * so the listing went on the catalogue with no photos or the landlord kept the whole thing in a
 * notes app until the photographer came back.
 *
 * The gap is **only** the photos, deliberately. Relaxing more of the form would turn a draft
 * into a half-filled one that fails on fields the landlord has long forgotten about, at the
 * moment they press publish; keeping it at one field means promoting a draft is a promotion and
 * not a second form to get through.
 *
 * Pure, and read by **both** the card that offers the button and the action that performs it —
 * the same reason `availableActions` answers for the errand screen and the errand action at
 * once: a control the server would refuse is a lie, and two copies of "when may this be
 * published?" are two things that drift.
 *
 * It cannot answer for `availableFrom`, and that is not an oversight: a draft that sat for a
 * month has a date in the past, which is a question about the clock rather than the document —
 * the same split that keeps `validateAvailableFrom` out of the schema. The action re-checks it
 * against the server's own clock.
 */
export function publishBlocker(
  property: Pick<Property, "status" | "photos">,
): "not_draft" | "no_photos" | null {
  if (property.status !== "draft") return "not_draft";
  if (property.photos.length < PHOTOS_MIN) return "no_photos";

  return null;
}
