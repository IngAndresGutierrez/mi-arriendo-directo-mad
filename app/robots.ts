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

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
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
        "/api/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
