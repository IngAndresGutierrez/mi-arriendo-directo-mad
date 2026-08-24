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
import { Button } from "@/shared/ui/button";

/** The in-page anchor the header points at, so the section and the link cannot drift apart. */
export const HOW_IT_WORKS_ANCHOR = "como-funciona";

/**
 * The one header every public page wears: the landing, the catalogue, a listing's detail, the
 * legal documents and `/soporte`.
 *
 * **It exists because there were two of them and they disagreed.** The landing was built with the
 * full header — the sections, the landlord's way in, the way to sign in — while the catalogue kept
 * the thin one it had from before the landing existed: a logo, "Contacto", and a button. Walking
 * from the front door into the catalogue therefore dropped half the navigation, which reads as
 * having left the site. One component, so the two cannot drift again.
 *
 * **The logo goes to the landing from everywhere, and that reverses an earlier decision.** The
 * catalogue used to override it to `/inmuebles`, on the argument that somebody three listings deep
 * who presses the mark is asking to go back to the results rather than out of what they were
 * browsing. That argument was sound when it was made and is not any more, for two reasons: `/` was
 * a login then, so it was a dead end for a visitor, and this header now carries an explicit
 * **"Inmuebles"** link, so "back to the results" has its own control and no longer needs to borrow
 * the logo. What is left is the plain convention — the mark is the way home — and a header that
 * behaves differently depending on which page you are on is the thing this component exists to stop.
 *
 * It reads the session because the header lied without it: "Iniciar sesión" shown to somebody
 * already signed in reads as a session that expired, and left no way back into the product.
 * **Contacto is there either way** — needing help is not something you should have to sign in to do.
 *
 * A Server Component under `app/`, like the chromes that render it: it reads the session, and the
 * answer is a fact about the request rather than something a client needs to re-derive.
 */
export async function PublicHeader() {
  const user = await getSessionUser();

  return (
    /*
      Sticky rather than fixed: `fixed` takes the header out of flow, and then `#como-funciona`
      scrolls its target to underneath it. Inside the catalogue's `lg:fixed lg:inset-0` frame this
      is inert — the header is a `shrink-0` flex child of something that does not scroll — so it
      costs nothing there and does the right thing on a phone, where the page scrolls as a page.
    */
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href={LANDING_ROUTE} aria-label="miarriendoDIRECTO.com, inicio">
          <Logo width={170} preload />
        </Link>

        {/*
          The section links are hidden below `md`: a phone header that also had to fit them would
          push the way in off the screen. What survives at every width is the way into the product.
        */}
        <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="lg">
            <Link href={PROPERTIES_ROUTE}>Inmuebles</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            {/*
              Absolute, never a bare `#como-funciona`: from the catalogue or a listing there is no
              such section on the page, and a bare fragment would scroll nowhere and look broken.
              With the path in front of it the browser navigates to the landing and then scrolls.
            */}
            <Link href={`${LANDING_ROUTE}#${HOW_IT_WORKS_ANCHOR}`}>Cómo funciona</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href={SUPPORT_ROUTE}>Contacto</Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/*
            "Publicar inmueble" is `brand` and not `accent`: the one cyan action belongs to whatever
            page this header sits on — the landing's search, a listing's own CTA — and a cyan button
            in chrome that appears on every public page would compete with all of them.
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
  );
}
