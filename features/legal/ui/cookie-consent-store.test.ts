import { describe, expect, it } from "vitest";

import { COOKIE_CONSENT_VERSION } from "../domain/cookies";
import { stableConsent } from "./cookie-consent-store";

/**
 * **The property `useSyncExternalStore` actually depends on**, and the one whose absence took the
 * page down.
 *
 * React compares snapshots with `Object.is`. `decodeCookieConsent` builds a fresh object every
 * call, so handing it straight to the hook reported a change on every render — "Maximum update
 * depth exceeded". It only appeared *after* somebody answered the banner: with no cookie the
 * snapshot is `null`, which is stable, so a first visit looked fine and every visit afterwards did
 * not.
 *
 * These assert reference identity with `toBe`, never `toEqual`: `toEqual` passes on two equal
 * objects, which is exactly the state that caused the bug.
 */
describe("stableConsent", () => {
  it("returns the very same object for the same cookie", () => {
    const first = stableConsent(`${COOKIE_CONSENT_VERSION}-analytics`);
    const second = stableConsent(`${COOKIE_CONSENT_VERSION}-analytics`);

    expect(first).toBe(second);
  });

  it("returns the same object for a decision that granted nothing", () => {
    const first = stableConsent(String(COOKIE_CONSENT_VERSION));

    expect(stableConsent(String(COOKIE_CONSENT_VERSION))).toBe(first);
    expect(first).toEqual({ version: COOKIE_CONSENT_VERSION, granted: [] });
  });

  /* Stability must not become staleness: a real change still has to produce a new snapshot. */
  it("produces a new object when the cookie actually changes", () => {
    const denied = stableConsent(String(COOKIE_CONSENT_VERSION));
    const granted = stableConsent(`${COOKIE_CONSENT_VERSION}-analytics`);

    expect(granted).not.toBe(denied);
    expect(granted?.granted).toEqual(["analytics"]);
  });

  /* An absent cookie is `null`, which is stable by construction — the case that hid the bug. */
  it("answers null for no cookie at all", () => {
    expect(stableConsent("")).toBeNull();
  });
});
