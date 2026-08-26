import { LocaleLink as Link } from "@/shared/i18n/locale-link";

import { COOKIES_ROUTE, PRIVACY_ROUTE, SUPPORT_ROUTE, TERMS_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { controllerIdentityLines } from "@/shared/legal/controller";
import { dictionary } from "@/shared/i18n/server";

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
 *
 * **It is one line from `sm` up, and that is the whole point of it.** The identity used to stack
 * three paragraphs, which on the landing and on a listing left a block of legal boilerplate with
 * more vertical presence than the content above it — reported from the screen as taking away the
 * page's protagonism. The three facts are still all published verbatim (Ley 1480 art. 50 is not
 * something a redesign gets to trade away): they sit on one row separated by a middle dot drawn
 * as a `::before`, so nothing is added to the text a crawler or a screen reader receives.
 *
 * The dot is gated on `sm` together with the row, and that pairing is the point: with the
 * separator left on at every width, a phone wrapped the line and put a leading "·" at the start of
 * the wrapped one, which reads as a bullet for a list of one. Below `sm` the three facts are a
 * column again, which is the only shape that fits 390px anyway.
 */
export async function LegalFooter() {
  const t = (await dictionary()).footer;

  return (
    <footer className="mt-8 shrink-0 border-t border-border pt-3 pb-2 lg:mt-4">
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <ul className="flex flex-col gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5">
          {/*controllerIdentityLines().map((line) => (
            <li key={line} className="sm:not-first:before:mr-1.5 sm:not-first:before:content-['·']">
              {line}
            </li>
          ))*/}
        </ul>

        <nav aria-label={t.legalAriaLabel}>
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
            <li>
              <NewTabLink href={TERMS_ROUTE} className="underline underline-offset-2 hover:text-foreground">
                {t.terms}
              </NewTabLink>
            </li>
            <li>
              <NewTabLink
                href={PRIVACY_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t.privacy}
              </NewTabLink>
            </li>
            <li>
              <NewTabLink
                href={COOKIES_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t.cookies}
              </NewTabLink>
            </li>
            <li>
              <Link
                href={SUPPORT_ROUTE}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t.contact}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
