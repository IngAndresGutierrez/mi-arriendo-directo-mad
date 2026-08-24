import Link from "next/link";

import { COOKIES_ROUTE, PRIVACY_ROUTE, SUPPORT_ROUTE, TERMS_ROUTE } from "@/shared/auth/routes";
import { controllerIdentityLines } from "@/shared/legal/controller";

/**
 * Who runs this and where its policies are.
 *
 * **It exists because the links already did.** `/terminos` and `/privacidad` were linked from the
 * signup screen and the onboarding form and answered 404 for as long as those links existed, and
 * there was no route to either from anywhere a visitor actually is — the catalogue, a listing.
 * Fincaraíz and Metrocuadrado both put theirs in the footer, and for once the convention is also
 * the requirement: Ley 1480 de 2011 art. 50 obliges an e-commerce provider to publish its identity
 * and contact details where they can be found.
 *
 * `controllerIdentityLines()` and not four hard-coded strings: the NIT does not exist yet, and a
 * footer that rendered "NIT " with nothing after it would be worse than one that omits the line.
 *
 * A Server Component with nothing but links. It renders inside whatever scrolls the page — in the
 * public chrome that is `main`, not the viewport, because from `lg` up that chrome is
 * `fixed inset-0` and a footer outside the scroller would be pinned over the content.
 */
export function LegalFooter() {
  return (
    <footer className="mt-12 shrink-0 border-t border-border pt-6 pb-2 lg:mt-6 lg:pt-4">
      <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          {controllerIdentityLines().map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <nav aria-label="Información legal">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            <li>
              <Link href={TERMS_ROUTE} className="underline underline-offset-2 hover:text-foreground">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link
                href={PRIVACY_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Tratamiento de datos
              </Link>
            </li>
            <li>
              <Link
                href={COOKIES_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Cookies
              </Link>
            </li>
            <li>
              <Link
                href={SUPPORT_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Contacto
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
