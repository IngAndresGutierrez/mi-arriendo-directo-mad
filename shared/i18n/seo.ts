import { DEFAULT_LOCALE, LOCALES, localeHref, type Locale } from "./locale";

/**
 * The `hreflang` set for one page, in both languages.
 *
 * **This is the half of the URL-prefix decision that makes it worth anything.** Two URLs serving the
 * same listing in two languages, with nothing connecting them, is the duplicate-content problem the
 * prefix was supposed to solve — a search engine has no way to know `/inmuebles/x` and
 * `/en/inmuebles/x` are one page in two languages rather than two pages competing for the same
 * query, and it picks one and drops the other. `hreflang` is what says they are a pair, and it is
 * only believed when **every** version points at every version, itself included: a page that lists
 * only the *other* language is a broken cluster, which is why `languages` here always holds both.
 *
 * The `canonical` is **self-referencing per language** and that is not a contradiction with the
 * above — it is what the pair needs. The English page's canonical is the English URL; pointing it at
 * the Spanish one would ask for the English page to be dropped from the index, which is the exact
 * outcome the whole change exists to avoid.
 *
 * `x-default` names the version for a visitor whose language we do not speak. It is Spanish: the
 * product is Colombian and Spanish is the unprefixed locale, so the fallback and the canonical
 * default are the same answer.
 *
 * `path` is a **canonical, unprefixed** path — a `shared/auth/routes.ts` constant, or one built from
 * `propertyDetailRoute`. Every value here is relative; `metadataBase` in the root layout resolves
 * them against `metadataOrigin()`, which is the canonical origin and deliberately not the request's.
 */
export function localeAlternates(
  locale: Locale,
  path: string,
): { canonical: string; languages: Record<string, string> } {
  return {
    canonical: localeHref(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((one) => [one, localeHref(one, path)])),
      "x-default": localeHref(DEFAULT_LOCALE, path),
    },
  };
}

/**
 * The same page in every language, as sitemap rows.
 *
 * One row per locale — not one row with the alternates hidden inside it — because a sitemap is a
 * list of URLs being submitted for indexing and the English URL has to be in that list to be
 * crawled. The `alternates.languages` block on each row is what ties them together, and it repeats
 * on both rows for the same reason the tags do: a cluster where only one member names the other is
 * a cluster Google discards.
 */
export function localeSitemapRows<T extends object>(
  path: string,
  row: T,
): readonly (T & { url: string; alternates: { languages: Record<string, string> } })[] {
  const { languages } = localeAlternates(DEFAULT_LOCALE, path);

  return LOCALES.map((locale) => ({
    ...row,
    url: localeHref(locale, path),
    alternates: { languages },
  }));
}
