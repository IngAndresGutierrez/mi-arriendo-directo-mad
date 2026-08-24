/**
 * The client-safe half of the legal module.
 *
 * `index.ts` re-exports the data layer, which is `server-only`, so a Client Component that
 * imported it would fail the build — the guard working as intended. Everything here is pure or is
 * a Client Component, and `@/features/legal/client` is a public entry that eslint and
 * dependency-cruiser allow alongside the index.
 */
export {
  acceptAll,
  acceptNecessaryOnly,
  analyticsAllowed,
  decodeCookieConsent,
  encodeCookieConsent,
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  OPTIONAL_COOKIE_CATEGORIES,
  type CookieConsent,
  type OptionalCookieCategory,
} from "./domain/cookies";

export {
  consentIsCurrent,
  latestConsent,
  needsReconsent,
  normalizeConsentVersion,
  pendingConsents,
  withLegacyConsent,
  type ConsentRecord,
} from "./domain/consent";

export {
  erasureBlocker,
  erasureBlockerMessage,
  erasureDeletions,
  erasureRetentions,
  ERASURE_PLAN,
  type ErasureBlocker,
  type ErasureItem,
  type ErasureSubject,
} from "./domain/erasure";

export { deleteAccountSchema, ERASURE_CONFIRMATION } from "./validations/erasure";

export { ConsentGate } from "./ui/consent-gate";
export { CookieBanner } from "./ui/cookie-banner";
export { CookiePreferences } from "./ui/cookie-preferences";
export { DeleteAccountCard } from "./ui/delete-account-card";
