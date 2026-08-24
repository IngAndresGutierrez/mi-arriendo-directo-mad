import { describe, expect, it } from "vitest";

import {
  acceptAll,
  acceptNecessaryOnly,
  analyticsAllowed,
  COOKIE_CONSENT_VERSION,
  decodeCookieConsent,
  encodeCookieConsent,
  OPTIONAL_COOKIE_CATEGORIES,
} from "./cookies";

describe("the codec", () => {
  it("round-trips a decision that granted everything", () => {
    expect(decodeCookieConsent(encodeCookieConsent(acceptAll()))).toEqual(acceptAll());
  });

  it("round-trips a decision that granted nothing", () => {
    const encoded = encodeCookieConsent(acceptNecessaryOnly());

    expect(encoded).toBe(String(COOKIE_CONSENT_VERSION));
    expect(decodeCookieConsent(encoded)).toEqual({
      version: COOKIE_CONSENT_VERSION,
      granted: [],
    });
  });

  /* Somebody has to be able to look at this in devtools and know what it says. */
  it("is readable rather than opaque", () => {
    expect(encodeCookieConsent(acceptAll())).toBe(`${COOKIE_CONSENT_VERSION}-analytics`);
  });
});

/*
 * The whole reason `decodeCookieConsent` collapses every failure into `null`: the caller has one
 * question — "has this browser made a decision that still counts?" — and every one of these is
 * the same answer to it.
 */
describe("anything it does not fully understand is no decision at all", () => {
  it("treats an absent cookie as undecided", () => {
    expect(decodeCookieConsent(undefined)).toBeNull();
    expect(decodeCookieConsent(null)).toBeNull();
    expect(decodeCookieConsent("")).toBeNull();
  });

  it("treats a malformed value as undecided", () => {
    expect(decodeCookieConsent("yes")).toBeNull();
    expect(decodeCookieConsent("-analytics")).toBeNull();
    expect(decodeCookieConsent("1.5-analytics")).toBeNull();
  });

  /*
   * A decision taken against an older set of categories is not a decision about the current one.
   * Bumping the version is how the product asks again, so this must not survive it.
   */
  it("treats a decision from an older policy version as undecided", () => {
    expect(decodeCookieConsent(`${COOKIE_CONSENT_VERSION - 1}-analytics`)).toBeNull();
  });

  /* A category the code no longer knows must not smuggle a grant through. */
  it("drops categories it does not recognise", () => {
    expect(decodeCookieConsent(`${COOKIE_CONSENT_VERSION}-advertising`)).toEqual({
      version: COOKIE_CONSENT_VERSION,
      granted: [],
    });
  });
});

describe("analyticsAllowed", () => {
  it("is true only when analytics was actually granted", () => {
    expect(analyticsAllowed(acceptAll())).toBe(true);
    expect(analyticsAllowed(acceptNecessaryOnly())).toBe(false);
  });

  /*
   * The bug this whole module exists to fix: before it, Analytics ran for a first-time visitor
   * who had been asked nothing. Undecided must never mean allowed.
   */
  it("is false for a browser that has not been asked", () => {
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(decodeCookieConsent(undefined))).toBe(false);
  });
});

/*
 * Declaring a category for a processing that does not happen is how a policy becomes a
 * liability: this product serves no ads, so it must not claim to set advertising cookies.
 */
describe("the declared categories", () => {
  it("declares analytics and nothing this product does not do", () => {
    expect(OPTIONAL_COOKIE_CATEGORIES).toEqual(["analytics"]);
  });
});
