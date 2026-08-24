/**
 * The record of what somebody authorised, and when.
 *
 * Decreto 1074 de 2015 (art. 2.2.2.25.2.4) puts the burden of **proving** the authorisation on
 * the Responsable, which is us. So a consent is not a boolean: it is an event with a version, a
 * timestamp and the same audit trail the electronic signature already keeps — the request's ip
 * and user agent.
 *
 * Pure. The read lives in `../data/consent.ts`.
 *
 * **The write lives in `completeProfile`, not here**, and that is deliberate: the profile and the
 * authorisation to process it are one event, so they go in one batch. Split across two actions,
 * one of them can succeed alone — and the half that would survive is a profile full of personal
 * data with no record of anybody having authorised it.
 */

import {
  CONSENT_KINDS,
  LEGAL_DOCUMENTS,
  type ConsentKind,
  type LegalDocument,
} from "@/shared/legal/documents";

/** One authorisation, as it crosses to a component: serializable, no `Timestamp`. */
export type ConsentRecord = {
  readonly id: string;
  readonly kind: ConsentKind;
  readonly version: number;
  /** ISO instant. */
  readonly grantedAt: string;
  /**
   * Where it came from. Both may be absent — a consent recorded before this was kept, or a
   * request behind a proxy that stripped the header — and an absent one is not a broken record.
   */
  readonly ip: string | null;
  readonly userAgent: string | null;
};

/**
 * The version a stored consent counts as.
 *
 * A document written before consents were versioned has no such field, and it is not corrupt:
 * it is an authorisation to version 1, which is what was in force when it was given. Same
 * reasoning as `clauseVersion` falling back to `SIGNATURE_CLAUSE_VERSION`'s first value and as
 * `normalizeStage()` mapping the stage names that are still in the database — no migration to
 * run, and the old records keep meaning what they meant.
 */
export function normalizeConsentVersion(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

/**
 * The consent that counts for one document: the highest version, and among equals the latest.
 *
 * Highest version first rather than simply latest: re-accepting an older version is not
 * something the product can produce, but if a stale tab ever managed it, the newer authorisation
 * is the one that should stand.
 */
export function latestConsent(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
): ConsentRecord | null {
  return records
    .filter((record) => record.kind === kind)
    .reduce<ConsentRecord | null>((best, record) => {
      if (!best) return record;
      if (record.version !== best.version) return record.version > best.version ? record : best;

      return record.grantedAt > best.grantedAt ? record : best;
    }, null);
}

/**
 * Whether one authorisation still counts against a given version of a document.
 *
 * It takes the document rather than reading the constants, for the same reason
 * `validateBirthDate` takes its reference date: the interesting cases are the ones that are not
 * true today, and a function that reads the module it is being tested against cannot be shown
 * them. `null` — never authorised — is never current.
 *
 * A reworded paragraph leaves `reconsentFrom` where it is and this answers `true`; a change of
 * finalidad raises it and this answers `false`, which is exactly the distinction Decreto 1074
 * art. 2.2.2.25.2.5 draws.
 */
export function consentIsCurrent(
  consent: ConsentRecord | null,
  document: LegalDocument,
): boolean {
  if (!consent) return false;

  return consent.version >= document.reconsentFrom;
}

/** Whether this person has to authorise one document again, against the version in force. */
export function needsReconsent(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
): boolean {
  return !consentIsCurrent(latestConsent(records, kind), LEGAL_DOCUMENTS[kind]);
}

/** Every document this person still owes an authorisation for. */
export function pendingConsents(records: readonly ConsentRecord[]): readonly ConsentKind[] {
  return CONSENT_KINDS.filter((kind) => needsReconsent(records, kind));
}

/**
 * Folds a legacy `termsAcceptedAt` into the list.
 *
 * Every account created before this module has one timestamp on `users/{uid}` and no consent
 * documents at all, and that timestamp *is* an authorisation — to both documents, at version 1,
 * because onboarding asked for them together in a single checkbox. Reading it as nothing would
 * tell thousands of perfectly consenting users that they had never consented, and asking them
 * again would be asking for something they already gave.
 *
 * A real consent document always wins: the fold only supplies a kind the subcollection is
 * missing, so once somebody re-authorises, the synthesised record disappears on its own.
 */
export function withLegacyConsent(
  records: readonly ConsentRecord[],
  legacyAcceptedAt: string | null,
): readonly ConsentRecord[] {
  if (!legacyAcceptedAt) return records;

  const missing = CONSENT_KINDS.filter((kind) => latestConsent(records, kind) === null);

  return [
    ...records,
    ...missing.map((kind) => ({
      id: `legacy-${kind}`,
      kind,
      version: 1,
      grantedAt: legacyAcceptedAt,
      ip: null,
      userAgent: null,
    })),
  ];
}
