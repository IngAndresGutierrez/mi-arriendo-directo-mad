/**
 * The acta de entrega: what state the property was handed over in, and handed back in.
 *
 * **This is the document that decides who pays for the scratch on the door**, and in Colombia there
 * is nothing else standing in for it. Ley 820 forbids a cash deposit, so at the end of a tenancy
 * neither party is holding money the other has to argue back — what they have instead is whatever
 * they wrote down at the start. Today that is a WhatsApp thread of photos nobody can find, or
 * nothing at all, and the argument is decided by whoever remembers harder.
 *
 * Two of them per tenancy, `checkin` and `checkout`, and **the document id is the kind** — which is
 * what makes it impossible to end up with two check-ins, the same trick `periods/{YYYY-MM}` uses on
 * the month.
 *
 * ## The rule the whole thing rests on
 *
 * **An acceptance belongs to the version it accepted.** Every acta carries a fingerprint of its
 * contents, and an acceptance records the fingerprint it was given for. Edit an area, add a photo,
 * change a condition from "bien" to "con daños", and the fingerprint moves — so the acceptance
 * stops applying **by itself, with no cleanup**, and the acta is waiting on the tenant again.
 *
 * That is `documentHash` on the contract signature and `verdictApplies` on a receipt, for the third
 * time in this product, and it is the same reason each time: a record that can be changed after it
 * was agreed to is not evidence, it is a claim.
 *
 * ## What it deliberately is not
 *
 * **It does not decide who pays.** Ley 820 puts the repairs a property needs to stay habitable on
 * the landlord and the damage the tenant caused on the tenant, and which of those a cracked tile is
 * depends on facts this product does not have. The acta records the state at two moments and lets
 * the two of them compare; a button that adjudicated it would be telling them something it cannot
 * know — exactly the call the incidents already make by keeping the disagreement instead of
 * settling it.
 *
 * **It is not a signature.** `acceptedAt` with an ip and a user agent, bound to a fingerprint, is
 * the evidence shape `acceptedClauseAt` and `checksAuthorizedAt` already use. The full apparatus —
 * a one-time code to a verified channel, a drawn stroke, a stamped PDF — exists in
 * `features/application` for the lease contract, which creates obligations. An acta records a state.
 * Upgrading it is a decision, not an oversight, and the pieces are there.
 */

/** Images only, and that is a decision rather than an omission — see `HANDOVER_PHOTO_TYPES`. */
export const HANDOVER_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type HandoverPhotoType = (typeof HANDOVER_PHOTO_TYPES)[number];

/**
 * 8 MB, the same ceiling a listing photo gets, and **no video**.
 *
 * The incidents accept video and argue for it well: a leak that only leaks when the tap runs is not
 * a still photograph. An acta is the opposite case — its whole value is that the checkout photo can
 * be put beside the check-in photo of the same wall, and two videos of a wall compare worse than
 * two pictures of it. Adding video here would be 50 MB per file on a record with a dozen areas, for
 * a comparison nobody would make.
 */
export const HANDOVER_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Guards, not business rules: enough for a flat, few enough that one screen can render them. */
export const MAX_HANDOVER_AREAS = 20;
export const MAX_AREA_PHOTOS = 6;
export const MAX_OBJECTION_PHOTOS = 10;
export const AREA_NAME_MAX = 60;
export const AREA_NOTE_MAX = 500;
export const OBJECTION_NOTE_MIN = 10;
export const OBJECTION_NOTE_MAX = 1000;

export const HANDOVER_KINDS = ["checkin", "checkout"] as const;
export type HandoverKind = (typeof HANDOVER_KINDS)[number];

export const HANDOVER_KIND_LABELS: Readonly<Record<HandoverKind, string>> = {
  checkin: "Entrega",
  checkout: "Devolución",
};

export function isHandoverKind(value: unknown): value is HandoverKind {
  return typeof value === "string" && (HANDOVER_KINDS as readonly string[]).includes(value);
}

/**
 * How a room was found.
 *
 * Three and not five: the point of the scale is that two people looking at the same wall six months
 * apart pick the same word, and a scale with "muy bueno" and "aceptable" on it is a scale where
 * they do not. `damaged` is the one that has to be unambiguous, because it is the one that gets
 * argued about.
 */
export const AREA_CONDITIONS = ["good", "fair", "damaged"] as const;
export type AreaCondition = (typeof AREA_CONDITIONS)[number];

export const AREA_CONDITION_LABELS: Readonly<Record<AreaCondition, string>> = {
  good: "En buen estado",
  fair: "Con desgaste normal",
  damaged: "Con daños",
};

/**
 * The rooms a Colombian flat is described by, offered as a menu when adding one.
 *
 * **A menu and not a `<datalist>` behind a text field**, which is what this was first: on screen
 * that is an empty text box, and the suggestions only appear if you happen to start typing the exact
 * name. Nobody knows they are there, so nobody gets them.
 *
 * And here consistent naming is not tidiness. The devolución is read **beside** the entrega, so
 * "Habitación principal" in one and "Alcoba" in the other is a comparison that cannot be made — the
 * one thing the two actas exist to allow. The menu makes the usual thing the consistent thing; a
 * `casa` has a patio and a `local` has none of these, so "Otro espacio" still takes a typed name,
 * and the name stays editable on the card afterwards.
 *
 * The stronger guarantee is one layer up: a **devolución starts seeded with the entrega's rooms**,
 * so the common case never depends on anybody choosing the same words twice.
 */
export const SUGGESTED_AREAS = [
  "Sala",
  "Comedor",
  "Cocina",
  "Habitación principal",
  "Habitación 2",
  "Baño principal",
  "Baño social",
  "Zona de ropas",
  "Balcón",
  "Parqueadero",
] as const;

/** A photo already in Cloud Storage, confirmed by the server against the bucket. */
export type HandoverPhoto = {
  /** `handovers/{uid}/…` — always inside the uploader's own folder, checked on the way in. */
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
};

/** One room, as one party found it. */
export type HandoverArea = {
  /**
   * Stable across edits, so an objection can name a room and still name it after a revision.
   *
   * Generated by the client and never trusted as anything but an opaque label: nothing is looked up
   * by it, the areas are stored as an ordered list, and two areas sharing an id would be a
   * cosmetic bug rather than a security one.
   */
  readonly id: string;
  readonly name: string;
  readonly condition: AreaCondition;
  readonly note: string;
  readonly photos: readonly HandoverPhoto[];
};

/** What the tenant said, and the evidence that they said it about *this* version. */
export type HandoverAcceptance = {
  /** ISO 8601. */
  readonly at: string;
  /** The fingerprint accepted. An edit moves the acta's and this stops applying. */
  readonly fingerprint: string;
  readonly ip: string;
  readonly userAgent: string;
};

/** And what they said instead, when they did not agree. */
export type HandoverObjection = {
  readonly at: string;
  readonly fingerprint: string;
  readonly note: string;
  readonly photos: readonly HandoverPhoto[];
};

/** Shape persisted in `leases/{leaseId}/handovers/{kind}`. */
export type HandoverDoc = {
  readonly areas: readonly HandoverArea[];
  /** The fingerprint of `areas` as they stand. Recomputed by the server on every write. */
  readonly fingerprint: string;
  /** ISO 8601, or `null` while the landlord is still drafting. */
  readonly submittedAt: string | null;
  readonly acceptance: HandoverAcceptance | null;
  readonly objection: HandoverObjection | null;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type Handover = Omit<HandoverDoc, "createdAt" | "updatedAt"> & {
  /** The document id, which **is** the kind. */
  readonly kind: HandoverKind;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// ---------------------------------------------------------------------------
// the fingerprint
// ---------------------------------------------------------------------------

/**
 * A canonical string for a set of areas: the same content always produces it, different content
 * never does.
 *
 * **Pure, and therefore here rather than in the action.** The hashing itself is one line of
 * `node:crypto` and nothing interesting happens in it; what is worth testing is *what goes into*
 * the string — a field left out is a field somebody can change after the acta was accepted without
 * the acceptance noticing, which is the one way this whole design fails silently.
 *
 * Order is part of the content: moving the kitchen above the living room is a different document to
 * read, even if the same words are in it. Photos are identified by their storage path, which is the
 * only part of a photo that cannot be changed without uploading a different file.
 *
 * It is **not** a security boundary and does not need to be a cryptographic commitment: only the
 * server writes these documents. It is change detection, and the sha256 the action wraps it in is
 * there to keep the stored value short.
 */
export function handoverFingerprint(areas: readonly HandoverArea[]): string {
  return areas
    .map((area) =>
      [
        area.name.trim(),
        area.condition,
        area.note.trim(),
        area.photos.map((photo) => photo.path).join(","),
      ].join("|"),
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// where it stands
// ---------------------------------------------------------------------------

export const HANDOVER_STATES = ["draft", "awaiting_tenant", "disputed", "accepted"] as const;
export type HandoverState = (typeof HANDOVER_STATES)[number];

export const HANDOVER_STATE_LABELS: Readonly<Record<HandoverState, string>> = {
  draft: "Borrador",
  awaiting_tenant: "Pendiente de revisión del inquilino",
  disputed: "Con observaciones",
  accepted: "Aceptada",
};

/** Whether an answer was given about the acta **as it stands now**. */
function applies(
  answer: { readonly fingerprint: string } | null,
  handover: Pick<Handover, "fingerprint">,
): boolean {
  return answer !== null && answer.fingerprint === handover.fingerprint;
}

export function acceptanceApplies(handover: Pick<Handover, "acceptance" | "fingerprint">): boolean {
  return applies(handover.acceptance, handover);
}

export function objectionApplies(handover: Pick<Handover, "objection" | "fingerprint">): boolean {
  return applies(handover.objection, handover);
}

/**
 * Where the acta stands, **derived from the record and never stored beside it**.
 *
 * The same choice `incidentState`, `errandState` and `leaseSummary` make: a stored status is a
 * second source of truth, and the day a write lands twice the field and the document disagree with
 * no way to tell which is lying.
 *
 * The order of the checks is the rule. A landlord who revises an accepted acta has an acceptance
 * that no longer applies, so it falls back to `awaiting_tenant` — which is exactly right, and is the
 * whole point of binding the answer to a fingerprint. When both answers apply (the tenant objected
 * and then accepted the same version) the later one wins, because a person is allowed to change
 * their mind about a document that did not change under them.
 */
export function handoverState(
  handover: Pick<Handover, "areas" | "fingerprint" | "submittedAt" | "acceptance" | "objection"> | null,
): HandoverState {
  if (!handover || !handover.submittedAt || handover.areas.length === 0) return "draft";

  const accepted = acceptanceApplies(handover);
  const objected = objectionApplies(handover);

  if (accepted && objected) {
    return Date.parse(handover.acceptance?.at ?? "") >= Date.parse(handover.objection?.at ?? "")
      ? "accepted"
      : "disputed";
  }
  if (accepted) return "accepted";
  if (objected) return "disputed";

  return "awaiting_tenant";
}

/** Whether this acta is finished, for the rail's counter and for the checkout's gate. */
export function isHandoverSettled(state: HandoverState): boolean {
  return state === "accepted";
}

// ---------------------------------------------------------------------------
// who may do what
// ---------------------------------------------------------------------------

export const HANDOVER_ACTIONS = ["draft", "submit", "accept", "object"] as const;
export type HandoverAction = (typeof HANDOVER_ACTIONS)[number];

/**
 * What this party may do to this acta right now.
 *
 * **A list, and both the screen and the action read it** — the reason `availableActions` on an
 * errand returns one too: a control the server would refuse is a lie, and two copies of "when may
 * this be accepted?" are two things that drift, with the button being the one that drifts first.
 *
 * The asymmetry is deliberate and it is not arbitrary. **The landlord writes the acta** because it
 * is their property being handed over and they are the party who has to be able to say what state
 * it was in; **the tenant answers it** because a record about the home somebody lives in that they
 * cannot contradict is not a record, it is an assertion. The tenant's protection is not drafting —
 * it is that an objection goes on the record permanently and the acta cannot reach `accepted`
 * without them.
 */
export function availableHandoverActions(
  state: HandoverState,
  party: "landlord" | "tenant",
): readonly HandoverAction[] {
  if (party === "landlord") {
    /*
     * Revising an accepted acta is allowed, and it costs the acceptance — `handoverState` sees the
     * fingerprint move and puts it back to `awaiting_tenant`. That is better than forbidding the
     * edit: a landlord who spots a mistake in a signed record and cannot fix it writes the
     * correction somewhere this product cannot see.
     */
    return state === "draft" ? ["draft", "submit"] : ["draft"];
  }

  return state === "awaiting_tenant" || state === "disputed" ? ["accept", "object"] : [];
}

export function mayDo(
  state: HandoverState,
  party: "landlord" | "tenant",
  action: HandoverAction,
): boolean {
  return availableHandoverActions(state, party).includes(action);
}

/**
 * Why the check-out acta cannot be started yet.
 *
 * **A checkout is a comparison, so there has to be something to compare against.** Drafting one
 * before the check-in was ever sent produces a record whose whole purpose — "this is how it came
 * back, and here is how it was handed over" — has no other half.
 *
 * It requires the check-in to have been **submitted**, not accepted. Requiring acceptance would let
 * a tenant who never answers block the landlord from ever closing the tenancy, which is a hostage
 * this product must not create; and a submitted acta is already a record with a date on it.
 */
export function checkoutBlocker(checkin: Pick<Handover, "submittedAt"> | null): "no_checkin" | null {
  return checkin?.submittedAt ? null : "no_checkin";
}

/** The anchor of one acta inside the tenancy page, for a notification to land on. */
export function handoverAnchor(kind: string): string {
  return `entrega-${kind}`;
}

/**
 * The uploader's own folder, and it is keyed by uid for the reason the incidents' is: Storage rules
 * cannot read Firestore, so "is this person a party to lease X?" is a question they cannot ask.
 * Which tenancy a photo belongs to is recorded in Firestore, where it can be.
 *
 * One function, so the browser that writes the path and the action that checks it cannot drift.
 */
export function handoverFolder(uid: string): string {
  return `handovers/${uid}/`;
}

export function isOwnHandoverPath(path: string, uid: string): boolean {
  return path.startsWith(handoverFolder(uid)) && !path.includes("..");
}

/**
 * Why this file cannot go on an acta, or `null`.
 *
 * A sentence rather than a reason code, like `attachmentProblem` next door and unlike
 * `acceptedVideo`: this half of the product is Spanish only, and the two live on the same screen.
 */
export function handoverPhotoProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!(HANDOVER_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "El acta acepta fotos JPG, PNG o WebP.";
  }
  if (file.size <= 0) return "Ese archivo llegó vacío.";
  if (file.size > HANDOVER_PHOTO_MAX_BYTES) {
    return "Cada foto puede pesar hasta 8 MB. Recórtala o baja la calidad.";
  }

  return null;
}

/**
 * How many areas came back marked as damaged, which is the one number worth showing on a rail.
 *
 * Counted rather than stored, like everything else here.
 */
export function damagedAreas(handover: Pick<Handover, "areas"> | null): number {
  return (handover?.areas ?? []).filter((area) => area.condition === "damaged").length;
}
