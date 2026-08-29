/**
 * Whether the person publishing a listing is actually its owner.
 *
 * **This is the answer to the one objection that stops somebody renting direct: "¿y si me
 * estafan?"** The scam is always the same shape — a flat somebody does not own, a "reserva" or a
 * first month, and a phone that stops answering. Half of it this product already refuses by not
 * moving the money. The other half is that the tenant has no way to know who they are talking to.
 *
 * ## What the badge claims, and what it must never claim
 *
 * Exactly one thing: **a person read the certificado de tradición y libertad of this property's
 * matrícula and the account publishing it is named on it as owner.** Nothing about the state of the
 * flat, nothing about the person's character, and no guarantee about the tenancy.
 *
 * A badge that says "Verificado" without saying *what* was verified is a badge that means whatever
 * the reader hopes it means, and the day one of those tenancies goes wrong the product is on the
 * hook for a promise it never made out loud. That is the discipline the landing already follows by
 * refusing "ahorra hasta un 30%": every claim is something the product actually did.
 *
 * ## Why it is manual, and why that is not a stopgap
 *
 * The Superintendencia de Notariado y Registro has no open API for this, and the certificate is a
 * paid document fetched one at a time. `property.ts` already says so about the matrícula itself:
 * *"the only real check is against the registry, which this product does not do."* So somebody
 * reads it. Making that a person rather than an integration is the honest version, and the badge
 * says "revisamos" rather than "el sistema verificó" for the same reason.
 *
 * ## The two halves, and where each lives
 *
 * The **evidence** — the certificate, the identity document, the reviewer's note — is the most
 * sensitive thing this product holds about a property: a certificado de tradición carries the full
 * address and the owner's identity, which is precisely why the matrícula itself is private. It
 * lives in `properties/{id}/private/verification`, beside the address, and is never public.
 *
 * The **result** is one timestamp on the public document, and **only the positive one**. A pending
 * or refused verification stays between the landlord and the reviewer: publishing "verificación
 * rechazada" would be a scarlet letter this product cannot justify — a certificate can be out of
 * date, a co-owner can be missing from it, and none of that is a finding about a person.
 */

/** What the landlord attaches. A PDF from the SNR, or a photograph of one. */
export const VERIFICATION_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

/** 8 MB, the same ceiling every other document in this product gets. */
export const VERIFICATION_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

/** The certificate plus, at most, an identity document and one page of something else. */
export const MAX_VERIFICATION_DOCUMENTS = 3;

export const VERIFICATION_NOTE_MAX = 500;

/**
 * How old a certificado de tradición may be and still mean anything.
 *
 * **Thirty days is the market's own convention, not a number invented here**: a bank or an agency
 * asking for one asks for a recent one, because the whole point of the document is that it reflects
 * the registry *today* — an embargo or a sale registered last week is exactly what it exists to
 * show. It is stated to the landlord before they pay for one, so nobody buys a document that gets
 * refused.
 */
export const CERTIFICATE_MAX_AGE_DAYS = 30;

/** A file already in Cloud Storage, confirmed by the server against the bucket. */
export type VerificationDocument = {
  /** `verifications/{uid}/…` — always inside the uploader's own folder, checked on the way in. */
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
};

/**
 * Shape persisted in `properties/{id}/private/verification`.
 *
 * Every state is a timestamp rather than a `status` string, the same choice `errandState` and
 * `incidentState` make and for the same reason: *when* it happened is part of the record both the
 * landlord and the reviewer read, and a stored status is a second source of truth that the day a
 * write lands twice disagrees with the history beside it.
 */
export type PropertyVerificationDoc = {
  readonly documents: readonly VerificationDocument[];
  /** ISO 8601 — when the landlord asked. */
  readonly submittedAt: string | null;
  /** ISO 8601 — when a reviewer approved it. */
  readonly verifiedAt: string | null;
  /** ISO 8601 — when a reviewer refused it. */
  readonly rejectedAt: string | null;
  /**
   * Why it was refused, in the reviewer's words. **Read by the landlord**, which is what makes a
   * refusal actionable instead of a wall: a certificate three months old and one naming somebody
   * else are two different things to do next.
   */
  readonly note: string;
  /**
   * The matrícula the approval was given for.
   *
   * **This is what makes the badge fall off by itself.** A verification says "this account owns the
   * property behind *this* registry number"; change the number and the sentence is about a
   * different property. It is the same binding the contract's `documentHash` and the acta's
   * fingerprint already use, and it has the same property: nothing to clean up, because the
   * comparison is the state.
   */
  readonly registryNumber: string;
  readonly reviewerUid: string;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type PropertyVerification = Omit<PropertyVerificationDoc, "createdAt" | "updatedAt"> & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const VERIFICATION_STATES = [
  "none",
  "in_review",
  "verified",
  "rejected",
  "stale",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const VERIFICATION_STATE_LABELS: Readonly<Record<VerificationState, string>> = {
  none: "Sin verificar",
  in_review: "En revisión",
  verified: "Propietario verificado",
  rejected: "No se pudo verificar",
  stale: "Hay que verificar de nuevo",
};

/**
 * Where the verification of one property stands.
 *
 * Derived, never stored. **The order of the checks is the rule**, and the one that matters is that
 * `stale` beats `verified`: a landlord who changes the matrícula after being approved has an
 * approval about a different property, and it must stop counting the moment the number moves — not
 * when somebody remembers to review it again.
 *
 * `rejectedAt` and `verifiedAt` are compared rather than ordered by presence, because a refusal can
 * be followed by a corrected submission and an approval: the later verdict is the one that stands.
 */
export function verificationState(
  verification: PropertyVerification | null,
  currentRegistryNumber: string,
): VerificationState {
  if (!verification?.submittedAt) return "none";

  const verified = Date.parse(verification.verifiedAt ?? "");
  const rejected = Date.parse(verification.rejectedAt ?? "");
  const decided = Math.max(Number.isNaN(verified) ? 0 : verified, Number.isNaN(rejected) ? 0 : rejected);

  if (decided === 0) return "in_review";
  if (!Number.isNaN(rejected) && rejected === decided) return "rejected";

  return sameRegistry(verification.registryNumber, currentRegistryNumber) ? "verified" : "stale";
}

/**
 * Whether two matrículas are the same number written two ways.
 *
 * `050-123456`, `050 123456` and `50-123456` are the same property, and a landlord retyping the
 * number when they edit the address must not lose a badge over a hyphen. `property.ts` already
 * validates the number loosely for exactly this reason — the shapes in the wild are not one shape —
 * so the comparison has to be as loose as the validation is.
 *
 * Leading zeros are dropped on the circle: the registry writes `050` and people type `50`.
 */
export function sameRegistry(one: string, other: string): boolean {
  return normalizeRegistry(one) === normalizeRegistry(other) && normalizeRegistry(one) !== "";
}

function normalizeRegistry(value: string): string {
  return value.replace(/[^0-9]/g, "").replace(/^0+/, "");
}

/** Whether the public badge should be drawn. The one question the catalogue and the page ask. */
export function isVerified(state: VerificationState): boolean {
  return state === "verified";
}

/**
 * Why the landlord cannot ask for a verification right now.
 *
 * A property has to be **published**: verifying a draft would spend a reviewer's time on a listing
 * nobody can see, and the point of the badge is what a stranger reads. And the matrícula has to be
 * there — it is the number the certificate is pulled with, so without it there is nothing to check
 * against.
 *
 * `in_review` blocks a second request rather than queueing one: two submissions of the same
 * property are two reviewers reading the same certificate.
 */
export function verificationBlocker(
  property: { readonly status: string },
  registryNumber: string,
  state: VerificationState,
): "not_published" | "no_registry" | "in_review" | "already_verified" | null {
  if (property.status !== "available") return "not_published";
  if (!registryNumber.trim()) return "no_registry";
  if (state === "in_review") return "in_review";
  if (state === "verified") return "already_verified";

  return null;
}

/**
 * The uploader's own folder, keyed by uid for the reason every other one is: Storage rules cannot
 * read Firestore, so "is this person the owner of property X?" is a question they cannot ask.
 */
export function verificationFolder(uid: string): string {
  return `verifications/${uid}/`;
}

export function isOwnVerificationPath(path: string, uid: string): boolean {
  return path.startsWith(verificationFolder(uid)) && !path.includes("..");
}

/** Why this file cannot be attached, or `null`. */
export function verificationDocumentProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!(VERIFICATION_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return "Adjunta el certificado en PDF, o una foto en JPG, PNG o WebP.";
  }
  if (file.size <= 0) return "Ese archivo llegó vacío.";
  if (file.size > VERIFICATION_DOCUMENT_MAX_BYTES) {
    return "Cada archivo puede pesar hasta 8 MB.";
  }

  return null;
}
