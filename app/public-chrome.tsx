import type { ReactNode } from "react";
import Link from "next/link";

import { getSessionUser } from "@/shared/auth/session";
import { LOGIN_ROUTE, PROPERTIES_ROUTE, SUPPORT_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { AccountMenu } from "@/shared/shell/account-menu";
import { Button } from "@/shared/ui/button";
import { TooltipProvider } from "@/shared/ui/tooltip";

/**
 * Chrome for the pages anyone can reach: the catalog, a property's detail, support.
 *
 * Deliberately thin — a logo, a way to reach a person, and a way in. The sidebar belongs to the
 * product, and showing it to someone with no session would promise sections they cannot open.
 *
 * It reads the session because the header lied without it: "Iniciar sesión" shown to somebody
 * already signed in reads as a session that expired, and there was no way back into the product
 * from here. **Contacto is there either way** — needing help is not something you should have to
 * sign in to do, which is why `/soporte` renders in this chrome too when there is no session.
 *
 * It lives under `app/` rather than in `shared/shell` so the support page can use the same
 * header the catalog uses instead of a second copy of it.
 *
 * **Where the logo goes is decided by whoever renders this, not by the header.** Everything in the
 * `(public)` route group is the catalog — the list and one property's detail — and there the logo
 * belongs to the catalog: someone three listings deep who presses it is asking to go back to the
 * results, not to a login screen they may already be past. `/soporte` renders this same header
 * outside that group and keeps the default, because from there "el inicio" really is the way in.
 * A prop and not `usePathname()`: the answer is a fact about the route, known at build time, and
 * reading it at runtime would make a Client Component out of the whole header for it.
 */
export async function PublicChrome({
  children,
  homeHref = LOGIN_ROUTE,
}: {
  readonly children: ReactNode;
  readonly homeHref?: string;
}) {
  const user = await getSessionUser();

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
        <header className="shrink-0 border-b border-border">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href={homeHref}
              aria-label={
                homeHref === PROPERTIES_ROUTE
                  ? "miarriendoDIRECTO.com, volver a los inmuebles"
                  : "miarriendoDIRECTO.com, ir al inicio"
              }
            >
              <Logo width={170} preload />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button asChild variant="ghost" size="lg">
                <Link href={SUPPORT_ROUTE}>Contacto</Link>
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:min-h-0 lg:overflow-y-auto lg:py-6">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
