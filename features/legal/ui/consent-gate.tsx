"use client";

import { useSyncExternalStore } from "react";

import { Analytics } from "@/shared/analytics";

import { acceptAll, acceptNecessaryOnly, analyticsAllowed } from "../domain/cookies";
import { CookieBanner } from "./cookie-banner";
import {
  readCookieConsent,
  serverCookieConsent,
  subscribeCookieConsent,
  writeCookieConsent,
} from "./cookie-consent-store";

/**
 * Analytics, and the question that has to be answered before it runs.
 *
 * **This replaces the unconditional `<Analytics />` in the root layout.** Firebase Analytics used
 * to load on every public page for everybody, including a first-time visitor who had been asked
 * nothing — and the SIC's position (Resolución 32126 de 2022 and its guidance) is that no cookie
 * category is exempt from prior authorisation except what the service cannot work without.
 * Analytics is not that.
 *
 * **Why the decision is read in the browser and not on the server.** Reading `cookies()` in
 * `app/layout.tsx` would opt the entire route tree into dynamic rendering — the catalogue and a
 * listing's detail included, which are the two pages in this product that exist to be indexed and
 * shared. `Analytics` already mounts after hydration through a dynamic `import()`, so gating it
 * here costs nothing that was not already deferred.
 *
 * The consequence, stated rather than hidden: the banner appears **after** hydration, so it is not
 * in the HTML a crawler receives. That is correct — a crawler is not a person who can consent —
 * and it is why the server snapshot is "undecided", which renders neither the banner nor Analytics.
 */
export function ConsentGate() {
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    serverCookieConsent,
  );

  return (
    <>
      {/* Only with a decision that granted it. Undecided is not permission. */}
      {analyticsAllowed(consent) ? <Analytics /> : null}

      {consent === null ? (
        <CookieBanner
          onAcceptAll={() => writeCookieConsent(acceptAll())}
          onRejectOptional={() => writeCookieConsent(acceptNecessaryOnly())}
        />
      ) : null}
    </>
  );
}
