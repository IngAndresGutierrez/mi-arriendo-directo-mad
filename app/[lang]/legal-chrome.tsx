import type { ReactNode } from "react";

import { getSessionUser } from "@/shared/auth/session";
import { DEFAULT_LOCALE } from "@/shared/i18n";
import { currentLocale, dictionary } from "@/shared/i18n/server";

import { ProductChrome } from "./product-chrome";
import { PublicChrome } from "./public-chrome";

/**
 * The frame a legal document wears: the product's when there is a session, the public one when
 * there is not.
 *
 * The same reasoning as `/soporte`, which was the first page to need it: **reading a policy must
 * not require an account.** Somebody deciding whether to sign up is exactly the person who needs
 * to read the privacy policy, and putting it behind the login would mean the document explaining
 * what we do with their data is only readable once they have given us some.
 *
 * It exists as a component rather than as three copies of the same six lines because there are now
 * three of these pages, and the day the chrome changes it should change once. `/soporte` predates
 * it and keeps its own copy: it also greets by name, which these do not.
 *
 * They live outside both route groups, so they inherit the root layout's `index: true`. That is
 * deliberate — a policy nobody can find is not published, and both Fincaraíz and Metrocuadrado
 * index theirs.
 *
 * **The documents themselves are Spanish in every language, and this is where that is admitted.**
 * `/terminos`, `/privacidad` and `/cookies` are operative under Ley 1581 and Ley 1480 — the text is
 * what the company is bound by, not a description of it — so a translation is not a rendering of
 * the same document, it is a second document making the same promises in words no lawyer has read.
 * The wrong way to handle that is silence: an English reader landing on a wall of Spanish with an
 * English header cannot tell whether the page is broken, whether it is the right document, or
 * whether an English version exists somewhere they have not found. So the page says it, once, at the
 * top. The URL and the chrome still follow the reader — `/en/terminos` exists, is in the sitemap and
 * names its Spanish twin in `hreflang` — because a document that cannot be reached from the language
 * somebody is browsing in is worse than one they have to read in Spanish.
 */
export async function LegalChrome({ children }: { readonly children: ReactNode }) {
  const [user, locale, copy] = await Promise.all([getSessionUser(), currentLocale(), dictionary()]);
  const Chrome = user ? ProductChrome : PublicChrome;

  return (
    <Chrome>
      {locale !== DEFAULT_LOCALE && (
        /*
         * `lang="es"` on the notice's own wrapper is not decoration: from here down the page really
         * is Spanish inside a document declared `en`, and that attribute is what stops a screen
         * reader reading Colombian legal prose in an English voice. It is announced as a `note`
         * rather than an `alert` — nothing has gone wrong, and an alert would interrupt.
         */
        <aside
          role="note"
          className="mb-6 rounded-2xl border border-border bg-muted/50 p-4 text-sm dark:bg-card/40"
        >
          <p className="font-medium text-primary dark:text-foreground">
            {copy.legal.spanishOnlyHeading}
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{copy.legal.spanishOnlyBody}</p>
        </aside>
      )}
      <div lang={DEFAULT_LOCALE}>{children}</div>
    </Chrome>
  );
}
