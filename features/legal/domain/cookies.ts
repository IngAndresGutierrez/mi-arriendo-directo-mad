/**
 * The cookie decision: what this browser allows, encoded into one cookie.
 *
 * **Why cookies need a decision at all here.** Colombia has no ePrivacy directive, and it is
 * tempting to conclude nothing is required. The SIC's position is the opposite: a cookie that
 * identifies a browser is personal data, so the general regime applies — prior, informed
 * authorisation — and its Resolución 32126 de 2022 classifies cookies without exempting any
 * category from it. What is genuinely exempt is what the service cannot work without.
 *
 * **Why per browser and not per user.** This is a decision about *this* device, and that is where
 * the record belongs. Storing it under a uid would be a second source of truth that contradicts
 * itself the moment somebody opens the product in another browser — and it would answer nothing
 * at all for a visitor browsing the catalogue with no account, which is most of them. The cookie
 * *is* the record. Everything a *person* authorises is in `consent.ts`.
 *
 * Pure: no `document`, no `cookies()`. The reader is `../ui/consent-gate.tsx`.
 */

/**
 * The two categories, and the whole of the honesty of this design.
 *
 * `necessary` is not a choice and is not presented as one: the session cookie, the sidebar width
 * and the language the reader was last in are what make the product work, and a toggle that cannot
 * be switched off is a lie about who is deciding. `analytics` is the only optional category, because Firebase Analytics is the
 * only optional thing that runs. **There is no `advertising` category** — declaring one for a
 * product that serves no ads would be describing a processing that does not happen, which is the
 * one structured-data-style mistake that turns a policy into a liability.
 */
export const OPTIONAL_COOKIE_CATEGORIES = ["analytics"] as const;
export type OptionalCookieCategory = (typeof OPTIONAL_COOKIE_CATEGORIES)[number];

/** The cookie that carries the decision. Readable by client JS on purpose: the banner writes it. */
export const COOKIE_CONSENT_NAME = "cookie-consent";

/**
 * Bumping this invalidates every stored decision and asks again.
 *
 * Raise it only when the categories or their purposes change — the same distinction
 * `reconsentFrom` draws for the written documents. A reworded policy page is not a reason.
 */
export const COOKIE_CONSENT_VERSION = 1;

/**
 * A year.
 *
 * Long enough that the banner is not furniture, short enough that the decision gets revisited:
 * an authorisation that never expires is one nobody is ever asked about again. Revoking earlier
 * does not depend on this — `/cookies` offers it at any time, which is what makes the
 * authorisation revocable in the sense Ley 1581 art. 8 requires.
 */
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/** What the browser has decided. `null` means it has not been asked yet. */
export type CookieConsent = {
  readonly version: number;
  readonly granted: readonly OptionalCookieCategory[];
};

function isOptionalCategory(value: string): value is OptionalCookieCategory {
  return (OPTIONAL_COOKIE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * `1` for a decision that granted nothing, `1-analytics` for one that granted analytics.
 *
 * Readable in devtools on purpose: a consent record nobody can inspect is one nobody can check.
 * The version leads so a stale value is recognisable without parsing the rest.
 */
export function encodeCookieConsent(consent: CookieConsent): string {
  return [consent.version, ...consent.granted].join("-");
}

/**
 * Reads the cookie back, and answers `null` to **anything** it does not fully understand.
 *
 * Absent, malformed, or stamped with an older `COOKIE_CONSENT_VERSION` all mean the same thing
 * operationally — this browser has not made a decision that is still valid — and collapsing them
 * is what makes the caller simple. Erring towards `null` errs towards asking again and towards
 * *not* loading analytics, which is the safe direction for both.
 */
export function decodeCookieConsent(value: string | undefined | null): CookieConsent | null {
  if (!value) return null;

  const [rawVersion, ...rest] = value.split("-");
  const version = Number(rawVersion);

  if (!Number.isInteger(version) || version !== COOKIE_CONSENT_VERSION) return null;

  return { version, granted: rest.filter(isOptionalCategory) };
}

/**
 * Whether Firebase Analytics may run.
 *
 * `false` for a browser that has not decided, which is the point: before this existed, Analytics
 * loaded on every public page for everyone, including a first-time visitor who had been asked
 * nothing.
 */
export function analyticsAllowed(consent: CookieConsent | null): boolean {
  return consent?.granted.includes("analytics") ?? false;
}

/** The decision "everything", ready to encode. */
export function acceptAll(): CookieConsent {
  return { version: COOKIE_CONSENT_VERSION, granted: [...OPTIONAL_COOKIE_CATEGORIES] };
}

/** The decision "only what the product cannot work without". */
export function acceptNecessaryOnly(): CookieConsent {
  return { version: COOKIE_CONSENT_VERSION, granted: [] };
}
