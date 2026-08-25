/**
 * The three legal documents, and what version of each is in force.
 *
 * **Why a version and not just a date.** The product already learned this once, for the
 * electronic signature: `SIGNATURE_CLAUSE_VERSION` exists because an authorisation whose text
 * nobody can reconstruct is a claim, not a record. Consent to a privacy policy has exactly the
 * same problem — `termsAcceptedAt` on its own answers *when* somebody agreed and says nothing
 * about *what* they agreed to, which is the half that matters the day the policy changes.
 *
 * **Why it is in `shared/` and not in `features/legal/`.** Four unrelated places read it: the
 * pages that render each document, the footer, the onboarding form that submits the version it is
 * consenting to, and the consent logic that compares against it. Two of those are `features/`
 * modules, and putting this inside one of them produced a real dependency cycle —
 * `profile → legal → application → profile` — because the onboarding form needs the version and
 * the erasure action needs to know about processes. A constant that four layers read is a
 * `shared/` constant; the same shape as `shared/lib/support-contact.ts`.
 *
 * Pure and dependency-free. Client-safe: the forms and the pages both read it.
 */

/** The documents a person consents to, as opposed to the cookie decision (see `cookies.ts`). */
export const CONSENT_KINDS = ["terms", "privacy"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/**
 * Where the authorisations live: `users/{uid}/consents/{consentId}`, append-only.
 *
 * A subcollection and not fields on `users/{uid}`, for two reasons. The audit trail — the ip and
 * the user agent of the request that granted it — has no business sitting among somebody's name
 * and address; and one authorisation per version is a *history*, which a set of fields cannot be.
 * The sibling `users/{uid}/documents/{documentId}` already establishes the shape.
 *
 * Named here rather than at each end because the writer (`completeProfile`) and the reader
 * (`features/legal/data/consent.ts`) are in different modules.
 */
export const CONSENTS_SUBCOLLECTION = "consents";

/** What each one is called on screen. Keys in English, labels in es-CO. */
export const CONSENT_KIND_LABELS: Readonly<Record<ConsentKind, string>> = {
  terms: "Términos y condiciones",
  privacy: "Política de tratamiento de datos personales",
};

/**
 * One document's state.
 *
 * `reconsentFrom` is the oldest version whose consent still counts. It is **not** the same as
 * `version`, and conflating the two is the mistake this field exists to prevent: Decreto 1074 de
 * 2015 (art. 2.2.2.25.2.5) requires a fresh authorisation when the **finalidad** changes, not
 * when a sentence is reworded. Bumping `version` for a typo and leaving `reconsentFrom` alone is
 * the normal case; raising `reconsentFrom` is the deliberate, rare one.
 */
export type LegalDocument = {
  readonly kind: ConsentKind;
  readonly version: number;
  readonly reconsentFrom: number;
  /** `YYYY-MM-DD`. What the page prints as "última actualización". */
  readonly effectiveDate: string;
};

/** First published version of everything. */
const FIRST_EFFECTIVE_DATE = "2026-08-24";

export const LEGAL_DOCUMENTS: Readonly<Record<ConsentKind, LegalDocument>> = {
  terms: {
    kind: "terms",
    version: 1,
    reconsentFrom: 1,
    effectiveDate: FIRST_EFFECTIVE_DATE,
  },
  /*
   * v2: el colaborador. El propietario puede pedirle a otra persona que muestre su inmueble, y esa
   * persona recibe el nombre y el teléfono de quien se postuló — una **categoría nueva de
   * destinatario**, que la política ahora nombra.
   *
   * **`reconsentFrom` se queda en 1, y esa es la decisión que hay que revisar con un abogado.** El
   * criterio del art. 2.2.2.25.2.5 es el cambio de *finalidad*, y la finalidad no cambió: sigue
   * siendo gestionar el arriendo, y mostrar el inmueble es un acto de ese mismo proceso. Lo que
   * cambió es *quién* lo ejecuta, y eso es un deber de información —cumplido nombrándolo en la
   * política y mostrando su nombre en la etapa antes de la visita— y no una finalidad nueva.
   * Subirlo obligaría a cada persona con un proceso abierto a re-autorizar en mitad del trámite.
   */
  privacy: {
    kind: "privacy",
    version: 2,
    reconsentFrom: 1,
    effectiveDate: "2026-08-25",
  },
};

/**
 * The cookie policy has a version too, but **no `ConsentKind`**.
 *
 * Nobody signs the cookie policy: the decision it describes is taken per browser and lives in a
 * cookie, not on a person's record. It carries a version so the page can say when it last
 * changed, which is the only thing a reader needs from it.
 */
export const COOKIE_POLICY_VERSION = 1;
export const COOKIE_POLICY_EFFECTIVE_DATE = FIRST_EFFECTIVE_DATE;

/** The version in force for one document. */
export function currentVersion(kind: ConsentKind): number {
  return LEGAL_DOCUMENTS[kind].version;
}

/**
 * `24 de agosto de 2026`, from a `YYYY-MM-DD`.
 *
 * Built from the parts rather than through `new Date(value)`: that constructor reads a bare
 * `YYYY-MM-DD` as UTC midnight, so in Bogotá (UTC-5) it formats as the *previous* day — which on
 * a legal document's effective date is not a cosmetic difference.
 */
export function formatEffectiveDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
