import type { ReactNode } from "react";

import { LegalFooter } from "@/shared/shell/legal-footer";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { PublicHeader } from "./public-header";

/**
 * Chrome for the pages anyone can reach: the catalog, a property's detail, support.
 *
 * The sidebar belongs to the product, and showing it to someone with no session would promise
 * sections they cannot open.
 *
 * **The header is `PublicHeader`, the same component the landing renders**, and this file no longer
 * builds one of its own. It used to, and the two had drifted: the landing carried the sections, the
 * landlord's way in and the way to sign in, while this one had only a logo, "Contacto" and a button
 * — so walking from the front door into the catalogue silently dropped half the navigation.
 *
 * **`homeHref` is gone with it.** This chrome used to take a prop so the catalogue could point the
 * mark at `/inmuebles` instead of at the root. Two things retired that: `/` is no longer a login, so
 * it is not a dead end for a visitor, and the shared header carries an explicit "Inmuebles" link, so
 * "back to the results" has its own control and does not need to borrow the logo. A header that
 * behaves differently depending on the page is exactly what the shared component exists to prevent.
 *
 * It lives under `app/` rather than in `shared/shell` so the support page and the legal documents
 * can use the same chrome the catalog uses instead of a second copy of it.
 *
 * **It no longer pins itself to the viewport.** See the comment on the wrapper below: the frame
 * was `lg:fixed lg:inset-0`, and what that bought in stationary filters it paid for in cards
 * clipped by an inner scroller and a footer that was never at the foot of the document.
 */
export function PublicChrome({ children }: { readonly children: ReactNode }) {
  return (
    // The price card renders a "coming soon" tooltip, and Radix needs its provider above it.
    <TooltipProvider>
      {/*
        **The page scrolls as a page, at every width.** This used to be `lg:fixed lg:inset-0` with
        the scrolling handed to `main` and, inside the catalogue, to the results column: a frame
        where the header and the facets never moved. The argument for it was that a filter you
        cannot see is a filter you forget you applied, and it is a real argument — but it was paid
        for with a listing cut off by the bottom edge of a panel with no page under it, which is
        what actually reached somebody looking at the screen. A nested scroller also puts the
        footer at the end of a region rather than at the end of the document, so the legal footer
        sat inside the frame instead of under the content.

        What replaces it is not nothing: the header is `sticky top-0` — which was inert inside the
        fixed frame and does its job now — and the catalogue's facets column is sticky under it.
        The filters stay in view, the page scrolls the way every other page in this product does,
        and there is no inner scrollbar for a card to be clipped by.
      */}
      <div
        /*
          `data-shell` is what `:has()` reads in `app/globals.css`: a page inside this frame can
          mark itself `data-shell-width="wide"` and the header, the content and the footer widen
          together. Only the catalogue does.
        */
        data-shell
        className="flex min-h-svh flex-col bg-background"
      >
        <PublicHeader />

        {/* `flex-1` so a short page still pushes the footer to the bottom of the viewport. */}
        <main className="mx-auto flex w-full max-w-(--shell-measure) flex-1 flex-col px-6 py-8 lg:py-6">
          {children}
          <LegalFooter />
        </main>
      </div>
    </TooltipProvider>
  );
}
