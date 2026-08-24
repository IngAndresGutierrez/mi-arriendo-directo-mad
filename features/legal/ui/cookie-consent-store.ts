"use client";

import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  decodeCookieConsent,
  encodeCookieConsent,
  type CookieConsent,
} from "../domain/cookies";

/**
 * The cookie decision, as an external store.
 *
 * **`useSyncExternalStore` and not `useState` plus an effect**, for the reason
 * `features/notification/ui/chime.ts` reads the sound preference that way: a cookie *is* an
 * external store, copying it into state from an effect is a second source of truth, and the React
 * compiler refuses the pattern outright. It also means two tabs cannot disagree about a decision
 * one of them just took.
 *
 * The write is `document.cookie`, exactly as `shared/shell/app-sidebar.tsx` writes the sidebar
 * width. Not httpOnly, on purpose: the banner has to be able to read what it wrote.
 */

/** Subscribers, so a write in this tab re-renders every reader of it. */
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeCookieConsent(listener: () => void): () => void {
  listeners.add(listener);
  // A decision taken in another tab arrives as a `storage` event only if it were localStorage, and
  // it is not — but a `focus` is when a returning tab is worth re-reading.
  window.addEventListener("focus", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", listener);
  };
}

/*
 * ── The snapshot has to be reference-stable, and getting this wrong took the page down ────────
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`. `decodeCookieConsent` builds a fresh
 * `{ version, granted: [...] }` every call, so returning it directly told React the store had
 * changed on **every** render: "Maximum update depth exceeded", and the page died.
 *
 * The vicious part is when it appears. With no cookie the snapshot is `null`, which is stable, so
 * a first-time visitor saw a working page and a working banner — and the loop began the instant
 * they answered it. Every visit after the first, for every user. `chime.ts` reads its preference
 * the same way and never had the bug because a boolean is a primitive; the moment a snapshot is an
 * object, memoising it stops being an optimisation and becomes the contract.
 *
 * So the decode is memoised on the raw cookie string: same string, same object, and a real change
 * still produces a new one.
 */
let cachedRaw: string | null = null;
let cachedConsent: CookieConsent | null = null;

/**
 * The decoded decision for one raw cookie value, **returning the same object for the same input**.
 *
 * Split out from `readCookieConsent` so the property `useSyncExternalStore` depends on can be
 * tested without a DOM — which is the only way to have a test that fails for the right reason here.
 */
export function stableConsent(raw: string): CookieConsent | null {
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedConsent = decodeCookieConsent(raw);
  }

  return cachedConsent;
}

/**
 * Reads the cookie. **Never throws**: `document` is unavailable during server rendering of a
 * Client Component, and a page must not fail over a preference.
 */
export function readCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_CONSENT_NAME}=`));

  return stableConsent(match?.slice(COOKIE_CONSENT_NAME.length + 1) ?? "");
}

/**
 * What the server renders before hydration: nobody has been asked yet.
 *
 * `useSyncExternalStore` requires a server snapshot, and this is the honest one — the server
 * genuinely does not know, because the whole point of reading this in the browser is that reading
 * `cookies()` in the root layout would make every page in the product dynamic, including the
 * catalogue and a listing's detail, which are the two that need to be static.
 */
export function serverCookieConsent(): CookieConsent | null {
  return null;
}

/** Records the decision for this browser. */
export function writeCookieConsent(consent: CookieConsent): void {
  document.cookie = [
    `${COOKIE_CONSENT_NAME}=${encodeCookieConsent(consent)}`,
    "path=/",
    `max-age=${COOKIE_CONSENT_MAX_AGE}`,
    // `lax` and not `strict`: a person arriving from a WhatsApp link must not be re-asked.
    "samesite=lax",
  ].join("; ");

  notify();
}
