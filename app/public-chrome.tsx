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
 */
export function PublicChrome({ children }: { readonly children: ReactNode }) {
  return (
    // The price card renders a "coming soon" tooltip, and Radix needs its provider above it.
    <TooltipProvider>
      {/*
        From `lg` the frame *is* the window — `fixed inset-0`, not `h-svh`: with a height alone
        the document still scrolled the header out of view by its own height, and the point of
        this is that the header and the filters do not move. The content scrolls inside `main`,
        which is what lets the catalog hand its scrolling to the results column.
        Below `lg` the page scrolls as a page — an inner scroller on a phone fights the address
        bar and pull-to-refresh, and there the filters are behind a button anyway.
      */}
      <div className="flex min-h-svh flex-col bg-background lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
        <PublicHeader />

        {/*
          `lg:flex lg:flex-col` is what lets the footer coexist with the catalogue's fixed frame.
          The footer goes **inside** `main` — outside it, and `fixed inset-0` would pin it across
          the bottom of the page — but the catalogue claims `lg:flex-1` rather than `lg:h-full`, so
          the two share the height instead of the footer pushing `main` into scrolling. That
          matters: scrolling `main` scrolls the facets out of view, and a filter you cannot see is
          a filter you forget you applied.
        */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:min-h-0 lg:overflow-y-auto lg:py-6">
          {children}
          <LegalFooter />
        </main>
      </div>
    </TooltipProvider>
  );
}
