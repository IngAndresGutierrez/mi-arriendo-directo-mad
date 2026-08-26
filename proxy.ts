import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
  splitLocale,
} from "@/shared/i18n/locale";

/**
 * What language a URL is in, decided before anything renders.
 *
 * Three jobs, and the order they are in is the whole logic.
 *
 * **1. `/es/...` is not a URL this product publishes.** Spanish is the unprefixed locale, so the
 * Spanish catalogue is `/inmuebles`. But `[lang]` is a dynamic segment and it matches the literal
 * string `es` perfectly well, so without this branch `/es/inmuebles` would render the same page as
 * `/inmuebles` — two URLs, one page, each able to accumulate links, which is the duplicate-content
 * problem the canonical tags exist to avoid. A `301` collapses them permanently.
 *
 * **2. An unprefixed path is Spanish, always, with no sniffing.** This is the decision worth
 * defending, because the obvious alternative — redirect by `Accept-Language`, as Next's own guide
 * shows — is wrong for this product. Every listing URL here is made to be pasted into a WhatsApp
 * group; if the server redirected by browser language, a link shared between two people would open
 * in different languages for each of them, and the Spanish page would never be served to an
 * English-configured browser at all, Googlebot included. So the path is authoritative and the only
 * thing that changes language is asking for it. `hreflang` on both pages is what tells a search
 * engine the pair exists.
 *
 * **3. The one exception is the bare root**, and only for a visitor who has never been here: somebody
 * typing the brand with no cookie yet gets one `307` towards their browser's `Accept-Language`.
 * Temporary, because the answer depends on who is asking and must never be cached as though it did
 * not.
 *
 * **Once the cookie exists, `/` is never redirected again — and that is a fix, not a limitation.**
 * The first version let a remembered choice win here, which trapped anybody who had ever read a page
 * in English: the switcher's Spanish target *is* `/`, so clicking "Español" from `/en` went to `/`,
 * the proxy read `locale=en` and bounced them straight back to `/en`. From the screen it looked like
 * the control did nothing at all, which is exactly how it was reported. The drivers missed it
 * because they exercised the round trip on `/inmuebles?city=…`, and `/` is the only path with a
 * redirect on it.
 *
 * So the cookie's job is narrower than "remember the language": it records that we have **already
 * negotiated once**, so we do not do it again on every visit to the root. The cost is that somebody
 * who chose English and later types the brand fresh lands on Spanish — which is the same rule the
 * other two branches already follow, that the path is authoritative and only asking changes the
 * language.
 *
 * Everything else is a **rewrite**, not a redirect: the URL the visitor sees stays `/inmuebles`
 * while the route that renders is `/es/inmuebles`, which is what lets Spanish keep the URLs it has
 * already published while `app/[lang]/` gives `next/root-params` the segment it needs.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* 1. The default locale never appears in a path. */
  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = splitLocale(pathname).path;

    return NextResponse.redirect(url, 301);
  }

  const { locale } = splitLocale(pathname);

  /* Already explicit — `/en/...`. Nothing to decide, only something to remember. */
  if (locale !== DEFAULT_LOCALE) {
    return remember(NextResponse.next(), request, locale);
  }

  /*
   * 3. The root, and only the root, and only on a first visit.
   *
   * `hasNegotiated` is the whole guard: with a cookie present this branch does not run, so `/` is
   * served as what it is — the Spanish landing — and the switcher can actually get back to it.
   */
  const hasNegotiated = isLocale(request.cookies.get(LOCALE_COOKIE)?.value);

  if (pathname === "/" && !hasNegotiated) {
    const preferred = negotiateLocale(request.headers.get("accept-language"));

    if (preferred !== DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = `/${preferred}`;

      return NextResponse.redirect(url, 307);
    }
  }

  /* 2. Spanish, rendered by `/es/...`, at the URL the visitor asked for. */
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;

  return remember(NextResponse.rewrite(url), request, DEFAULT_LOCALE);
}

/**
 * Remember the language the visitor is actually reading, so the root can honour it next time.
 *
 * **Only when it changed.** A `Set-Cookie` on every response would make each one unique to its
 * request and cost the CDN's ability to serve the landing and the catalogue from cache — the two
 * pages where that matters most. Written from the path rather than from a switch being pressed,
 * because the switcher is a plain `<a>`: a link cannot set a cookie, and turning it into a Server
 * Action to record a UI preference would put a round trip in front of a navigation.
 *
 * It is a **necessary** cookie in the sense `/cookies` uses — it stores no personal data and only
 * remembers a preference — and it is named on that page, like the other four. A cookie this product
 * sets and does not declare is exactly what that document exists to prevent.
 */
function remember(response: NextResponse, request: NextRequest, locale: string): NextResponse {
  if (request.cookies.get(LOCALE_COOKIE)?.value === locale) return response;

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export const config = {
  /*
   * Everything except what has no language.
   *
   * `api` is excluded because those are not localised URLs — `POST /api/session` is called by
   * literal path from client code and the cron routes are called by Vercel — and because Route
   * Handlers cannot read a root param anyway. `_next` is the build output. The `\\.` clause excludes
   * any path with a file extension in its last segment, which covers `robots.txt`, `sitemap.xml`,
   * `favicon.ico`, the icons and the generated Open Graph images: rewriting one of those under a
   * locale would move a file a crawler fetches by a fixed, well-known name.
   */
  matcher: ["/((?!api|_next|.*\\.[^/]+$).*)"],
};
