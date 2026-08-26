import type { MetadataRoute } from "next";

import {
  CONTRACTS_ROUTE,
  COMPLETE_PROFILE_ROUTE,
  HOME_ROUTE,
  MY_PROPERTIES_ROUTE,
  PUBLISH_PROPERTY_ROUTE,
  RENTALS_ROUTE,
  SIGNUP_ROUTE,
  TENANT_PROFILE_ROUTE,
} from "@/shared/auth/routes";
import { LOCALES, localeHref } from "@/shared/i18n/locale";
import { metadataOrigin } from "@/shared/lib/site-url";

/**
 * `/robots.txt`.
 *
 * **Two halves of this product, and only one of them is for search engines.** The catalog and a
 * property's detail exist to be found and shared; everything behind a session is the private
 * workspace of two named people, and there is nothing there a stranger should reach — nor anything
 * a crawler could reach anyway, since every one of those pages calls `requireCompleteProfile()` and
 * answers a redirect to the login without one.
 *
 * That last part is why the `Disallow` list is about **crawl budget rather than secrecy**: nothing
 * is being hidden here that is not already behind an authorisation check. It matters anyway,
 * because a crawler that spends its visit following `/contratos/<id>` links out of an email into a
 * redirect chain is a crawler that did not fetch the six new listings published this week.
 *
 * The `noindex` that keeps those URLs *out of the index* is a separate control and it lives in the
 * layouts of `(app)` and `(auth)`. The two do not overlap by accident: a `Disallow` alone can still
 * leave a bare URL in the results when somebody links to it, and a `noindex` alone is only seen by
 * a crawler that fetched the page. Both are cheap and they fail in different directions.
 *
 * `/api/` is disallowed for the same reason: a Route Handler is not a page and has no business
 * being crawled. `/publicar` and the profile forms are here rather than trusted to their own
 * metadata because a form is never a search result worth having.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = metadataOrigin();

  /**
   * **Every rule twice, once per language.**
   *
   * The paths below are canonical Spanish, and the English portal lives at the same paths behind an
   * `/en` prefix — so a list of literal Spanish paths tells a crawler to stay out of `/contratos`
   * and says nothing at all about `/en/contratos`. That is not a secrecy hole (every one of those
   * pages redirects to the login without a session, which is the point the note above makes) but it
   * is exactly the crawl budget this file exists to protect: a crawler working through the English
   * spelling of the whole private portal is a crawler that did not fetch this week's listings.
   *
   * `localeHref` rather than string concatenation, so the prefix cannot drift from the one
   * `proxy.ts` and `LocaleLink` use.
   */
  const everyLocale = (paths: readonly string[]): string[] =>
    LOCALES.flatMap((locale) => paths.map((path) => localeHref(locale, path)));

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: everyLocale([
        `${HOME_ROUTE}/`,
        HOME_ROUTE,
        `${CONTRACTS_ROUTE}/`,
        CONTRACTS_ROUTE,
        `${RENTALS_ROUTE}/`,
        RENTALS_ROUTE,
        `${MY_PROPERTIES_ROUTE}/`,
        MY_PROPERTIES_ROUTE,
        TENANT_PROFILE_ROUTE,
        PUBLISH_PROPERTY_ROUTE,
        `${SIGNUP_ROUTE}/`,
        SIGNUP_ROUTE,
        COMPLETE_PROFILE_ROUTE,
        // "Postularme" es un formulario que exige sesión; el anuncio que lleva a él sí se indexa.
        "/postularme/",
      ]).concat(
        /*
         * `/api/` is outside the loop because it is outside `[lang]`: a Route Handler has no
         * language, and `/en/api/` is not a URL that exists.
         */
        "/api/",
      ),
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
