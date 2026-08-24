import type { ReactNode } from "react";

import { PublicHeader } from "@/app/public-header";
import { LegalFooter } from "@/shared/shell/legal-footer";

/**
 * The frame of the public landing.
 *
 * **A separate chrome from `PublicChrome`, and the reason is one line of CSS.** That one is
 * `lg:fixed lg:inset-0` on purpose — the catalogue is a frame where only the results column
 * scrolls, so a filter you applied never leaves the screen. A landing is the opposite shape: it is
 * one long scroll and every section below the fold depends on the document scrolling normally.
 * Reusing it would have meant either breaking the catalogue's frame or nesting a scroller inside a
 * pinned viewport, which on a phone fights the address bar and pull-to-refresh.
 *
 * **The header, though, is literally the same component.** It used to be a second copy living here,
 * and the copy was the better of the two — so the catalogue was walking people into a thinner
 * header than the one they arrived through. `PublicHeader` is now the single one; what stays
 * different between the two chromes is only what scrolls.
 *
 * The footer is `LegalFooter`, not a second copy of it. Ley 1480 art. 50 obliges an e-commerce
 * provider to publish its identity where it can be found, and the landing is now the most-found
 * page there is — a footer written fresh here would be the copy that drifts.
 */
export async function LandingChrome({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">{children}</main>

      <div className="mx-auto w-full max-w-6xl px-6">
        <LegalFooter />
      </div>
    </div>
  );
}
