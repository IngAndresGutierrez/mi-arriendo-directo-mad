/**
 * Which language a request is in, and how that is written into a URL.
 *
 * **The locale lives in the path, and Spanish is the one that does not say so.** `/inmuebles` is
 * the Spanish catalogue and `/en/inmuebles` is the English one. That asymmetry is not untidiness:
 * every link this product has ever sent — a notification email pointing at
 * `/contratos/<id>#etapa-guarantee`, a listing pasted into a WhatsApp group, the two permanent
 * redirects in `next.config.ts` — is an unprefixed Spanish path, and a scheme where the default
 * locale carries a prefix invalidates all of them at once. So the prefix is what *English* costs,
 * and Spanish keeps the URLs it already published.
 *
 * Everything here is pure and unit-tested. `proxy.ts` decides what a request means with it before
 * anything renders, `shared/i18n/server.ts` reads it back out of the route, and `safeRedirect`
 * rejects the English spelling of the four screens it already rejected in Spanish — three
 * different layers that have to agree about what `/en/ingresar` is, which is exactly the kind of
 * agreement that belongs in one tested module rather than in three regexes.
 */

/** Every language the product answers in. Order is the order the switcher offers them in. */
export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Spanish, and it is the **unprefixed** one.
 *
 * The product is Colombian PropTech and speaks es-CO to tenants and landlords; English is the
 * addition. Changing this constant is therefore not a one-line change — it moves which set of URLs
 * carries a prefix, and with it every link already in somebody's inbox.
 */
export const DEFAULT_LOCALE: Locale = "es";

/** What each language is called **in itself**, which is the only name a switcher can use. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

/**
 * Where the visitor's last language is remembered, so `/` can honour it next time.
 *
 * A **necessary** cookie in the sense `/cookies` uses: it holds two characters of UI preference, no
 * personal data, and the product does not work as intended without it — the same category as
 * `sidebar`. It is named on that page, because a cookie this product sets and does not declare is
 * precisely what that document exists to prevent.
 *
 * It is written by `proxy.ts` from the path being served, never by the switcher: the switcher is a
 * plain `<a>`, and a link cannot set a cookie.
 */
export const LOCALE_COOKIE = "locale";

/** The `lang` attribute, which wants a region for Spanish: this product's Spanish is Colombian. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  es: "es-CO",
  en: "en",
};

/** The Open Graph `locale`, which is neither of the two above and wants an underscore. */
export const LOCALE_OG: Record<Locale, string> = {
  es: "es_CO",
  en: "en_US",
};

/**
 * A stored, possibly-absent preference turned into a language.
 *
 * **The one place "we do not know" becomes an answer**, and it answers Spanish. Three different
 * absences arrive here and they all mean the same thing to a reader: an account created before the
 * field existed, somebody who never opened the setting, and a Firestore read that failed. The
 * alternative — refusing to send until a language is known — would drop the email that says a
 * document was rejected, which is strictly worse than sending it in the product's own language.
 * It is `allowsChannel`'s "fail towards delivering", one field over.
 */
export function localeFor(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The locale a path is in, and the path with that answer removed.
 *
 * The returned `path` is always the **canonical, unprefixed** form, which is what the rest of the
 * product deals in: `shared/auth/routes.ts` constants, `AUTH_ROUTES`, the `Disallow` list. So a
 * caller can compare against those constants without knowing which language it is looking at.
 *
 * It matches a **whole segment** and nothing less. `/entrevista` starts with the three characters
 * `/en` and is Spanish; a `startsWith("/en")` would have called it English and stripped it into
 * `trevista`, which is a 404 on a URL that used to work.
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first = "", ...rest] = pathname.split("/");

  if (isLocale(first)) {
    const path = `/${rest.join("/")}`;
    return { locale: first, path: path === "/" ? "/" : path.replace(/\/$/, "") };
  }

  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * Where an internal path lives in a given language.
 *
 * Anything that is not an internal absolute path comes back untouched — `mailto:`, `tel:`, an
 * absolute URL, a bare `#etapa-guarantee`. That is what lets `LocaleLink` sit in front of every
 * `<Link>` in the product without each call site having to know which kind of href it holds.
 */
export function localeHref(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const { path } = splitLocale(href);
  if (locale === DEFAULT_LOCALE) return path;

  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Hoisted: rebuilt on every request otherwise, and this runs in the proxy. */
const QUALITY = /;\s*q=([0-9.]+)/;

/**
 * The best supported language for an `Accept-Language` header.
 *
 * Region is dropped before comparing (`en-GB` is English), and the header's own `q` weights decide
 * between two languages the visitor named. A header naming neither, or no header at all, is
 * Spanish — the product's own language, and the one whose URLs carry no prefix.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  let best: { locale: Locale; quality: number } | null = null;

  for (const part of acceptLanguage.split(",")) {
    const tag = part.trim();
    if (!tag) continue;

    const language = tag.split(";")[0]?.trim().split("-")[0]?.toLowerCase();
    if (!isLocale(language)) continue;

    const matched = QUALITY.exec(tag);
    const quality = matched ? Number.parseFloat(matched[1] ?? "0") : 1;
    if (!Number.isFinite(quality) || quality <= 0) continue;

    if (!best || quality > best.quality) best = { locale: language, quality };
  }

  return best?.locale ?? DEFAULT_LOCALE;
}
