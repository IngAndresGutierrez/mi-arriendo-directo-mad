import type { ReactNode } from "react";
import Link from "next/link";

import {
  LANDING_ROUTE,
  LOGIN_ROUTE,
  PROPERTIES_ROUTE,
  PUBLISH_PROPERTY_ROUTE,
  SUPPORT_ROUTE,
} from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { Logo } from "@/shared/brand/logo";
import { AccountMenu } from "@/shared/shell/account-menu";
import { LegalFooter } from "@/shared/shell/legal-footer";
import { Button } from "@/shared/ui/button";

/** The in-page anchor the header points at, so the section and the link cannot drift apart. */
export const HOW_IT_WORKS_ANCHOR = "como-funciona";

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
 * It reads the session for the same reason the catalogue's header does: offering "Iniciar sesión"
 * to somebody already signed in reads as a session that quietly expired, and leaves them with no
 * way back into the product from the page they typed the brand into.
 *
 * The footer is `LegalFooter`, not a second copy of it. Ley 1480 art. 50 obliges an e-commerce
 * provider to publish its identity where it can be found, and the landing is now the most-found
 * page there is — a footer written fresh here would be the copy that drifts.
 */
export async function LandingChrome({ children }: { readonly children: ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/*
        Sticky rather than fixed: `fixed` takes the header out of flow, and then every anchor in
        this page (`#como-funciona` from the nav) scrolls its target to underneath it. Sticky keeps
        the header in flow, and `scroll-mt` on the sections covers the rest.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href={LANDING_ROUTE} aria-label="miarriendoDIRECTO.com, inicio">
            <Logo width={170} preload />
          </Link>

          {/*
            The section links are hidden below `sm`: a phone header that also had to fit them would
            push the way in off the screen, and everything they point at is reachable by scrolling
            the page they are on. What survives at every width is the way into the product.
          */}
          <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="lg">
              <Link href={PROPERTIES_ROUTE}>Inmuebles</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href={`${LANDING_ROUTE}#${HOW_IT_WORKS_ANCHOR}`}>Cómo funciona</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href={SUPPORT_ROUTE}>Contacto</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/*
              "Publicar inmueble" is `brand` and not `accent`: the one cyan action on this page is
              the search, which is what the overwhelming majority of visitors came to do. A landlord
              is the smaller audience here and gets a real control, not the page's single CTA.
            */}
            <Button asChild variant="brand" size="lg" className="hidden sm:inline-flex">
              <Link href={PUBLISH_PROPERTY_ROUTE}>Publicar inmueble</Link>
            </Button>

            {user ? (
              <AccountMenu email={user.email ?? ""} />
            ) : (
              <Button asChild variant="outline" size="lg">
                <Link href={LOGIN_ROUTE}>Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <div className="mx-auto w-full max-w-6xl px-6">
        <LegalFooter />
      </div>
    </div>
  );
}
