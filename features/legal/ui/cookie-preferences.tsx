"use client";

import { useSyncExternalStore } from "react";

import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";

import { acceptAll, acceptNecessaryOnly, analyticsAllowed } from "../domain/cookies";
import {
  readCookieConsent,
  serverCookieConsent,
  subscribeCookieConsent,
  writeCookieConsent,
} from "./cookie-consent-store";

/**
 * The switch that makes the cookie authorisation revocable.
 *
 * **This is the half that turns the banner from an announcement into a consent.** Ley 1581 art. 8,
 * lit. e gives the titular the right to revoke, and a decision that can only be taken once — in a
 * banner that never comes back — is not revocable. So it lives on `/cookies`, which is where the
 * banner and the footer both point.
 *
 * It reads the same external store the banner writes, so flipping it here makes the banner
 * disappear and Analytics stop, in this tab and in any other on the next focus. No Server Action:
 * the decision belongs to the browser and the cookie is the record.
 *
 * The switch's checked colour is `--brand-panel` by construction — in dark mode `--primary` *is*
 * the cyan, so a `primary` switch would compete with whatever CTA the page has.
 */
export function CookiePreferences() {
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    serverCookieConsent,
  );
  const allowed = analyticsAllowed(consent);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {/*
            **`id` here and `aria-labelledby` on the switch, not `htmlFor` alone.** A Radix
            `Switch` renders a `<button role="switch">`, and a button's accessible name comes from
            its own subtree — a `<label for>` pointing at it names nothing, so a screen reader
            announced this control as an unnamed switch. `aria-labelledby` rather than a duplicated
            `aria-label`, so the announced name cannot drift from the words on screen.
          */}
          <Label
            id="analytics-consent-label"
            htmlFor="analytics-consent"
            className="block text-sm font-medium text-foreground"
          >
            Cookies de analítica
          </Label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nos dicen qué páginas se usan y cuáles no, para saber qué arreglar. No las usamos para
            publicidad ni las compartimos con anunciantes.
          </p>
        </div>

        <Switch
          id="analytics-consent"
          aria-labelledby="analytics-consent-label"
          checked={allowed}
          onCheckedChange={(checked) =>
            writeCookieConsent(checked ? acceptAll() : acceptNecessaryOnly())
          }
        />
      </div>

      {/*
        The state in words as well as in the switch's position. State communicated by one visual
        cue alone is state somebody misreads, and this is the sentence that confirms the click did
        something — the same reason turning the notification sound on plays it.
      */}
      <p
        role="status"
        className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground"
      >
        {consent === null
          ? "Todavía no has decidido. Mientras tanto, la analítica está apagada."
          : allowed
            ? "Autorizada. Puedes retirarla cuando quieras desde aquí."
            : "No autorizada. Solo se usan las cookies necesarias."}
      </p>
    </div>
  );
}
