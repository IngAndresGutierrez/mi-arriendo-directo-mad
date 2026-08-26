import { lang } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, localeHref, type Locale } from "./locale";
import { dictionaryFor, type Dictionary } from "./dictionary";

/**
 * The locale of the request being rendered, readable from **any** Server Component.
 *
 * This is the reason the whole `app/` tree moved under `app/[lang]/`. `next/root-params` only
 * exposes a getter for a dynamic segment that sits *above* the root layout, so `app/layout.tsx` had
 * to become `app/[lang]/layout.tsx` — with the old file in place, `lang` was an ordinary route
 * param and every one of the ~200 components that needs the language would have had to receive it
 * as a prop from whichever page rendered it. That is the prop-drilling this getter exists to avoid,
 * and it is the difference between a migration that is mechanical and one that touches every
 * component signature in the product.
 *
 * **Three places it does not work**, and each has its own answer:
 *
 * - **Client Components.** Handed their dictionary slice as a prop by a server parent, which is the
 *   project's existing rule about passing data rather than functions across the boundary. The bare
 *   locale, for `LocaleLink`, comes from `LocaleProvider` instead.
 * - **Server Actions.** `revalidate`d paths and redirect targets are built from the locale the
 *   *form* submits, so an action that needs it takes it as a field. Copy an action returns is
 *   looked up with `dictionaryFor` from that same value.
 * - **Route Handlers.** Not supported yet (Next says a future release). `/api/**` deliberately did
 *   not move under `[lang]`: those are not localised URLs, `POST /api/session` is called by literal
 *   path from client code, and the cron routes are called by Vercel.
 */
export async function currentLocale(): Promise<Locale> {
  const value = await lang();

  /*
   * `proxy.ts` guarantees this segment is a locale — an unknown one is rewritten as a Spanish path
   * and 404s, which is the right answer for `/fr/inmuebles`. The check is here anyway because a
   * root param is a string as far as the type system knows, and falling back is cheaper than being
   * the reason the root layout throws.
   */
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The copy for this request. The one call most Server Components need. */
export async function dictionary(): Promise<Dictionary> {
  return dictionaryFor(await currentLocale());
}

/**
 * An internal path in the language of the request being rendered.
 *
 * For a Server Component building an href by hand — a `redirect()`, a `<link rel="canonical">`, an
 * absolute URL for an email. Inside JSX, `LocaleLink` does this without the `await`.
 */
export async function localePath(href: string): Promise<string> {
  return localeHref(await currentLocale(), href);
}
