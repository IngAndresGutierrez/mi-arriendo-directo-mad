import type { MetadataRoute } from "next";

import { listAvailableProperties } from "@/features/property";
import {
  COOKIES_ROUTE,
  LOGIN_ROUTE,
  PRIVACY_ROUTE,
  PROPERTIES_ROUTE,
  propertyDetailRoute,
  SUPPORT_ROUTE,
  TERMS_ROUTE,
} from "@/shared/auth/routes";
import { metadataOrigin } from "@/shared/lib/site-url";

/**
 * `/sitemap.xml` — every public URL, and only public URLs.
 *
 * The catalog is the entry point, one entry per **available** listing is the substance, and the
 * city facets are in here because they are the only faceted URLs this product treats as canonical
 * (`generateMetadata` on the catalog says the same thing, from the other side). A sitemap that
 * disagreed with the canonical tags would be asking a search engine to pick, and it picks badly.
 *
 * Nothing behind a session appears here, which is the whole point: a sitemap is a list of pages you
 * are asking to have indexed, and the management portal is the private workspace of two named
 * people.
 *
 * **`lastModified` is the listing's own `updatedAt`**, not "now". A sitemap where every URL changed
 * today is a sitemap whose dates a crawler learns to ignore, and then the one listing whose price
 * actually moved gets re-fetched a week late.
 *
 * It **never throws**. It is a public endpoint reached by machines with no session and no retry
 * loop, and a 500 here means the whole file is unusable rather than short by a few listings — so a
 * failed read still produces the static half. Same contract as `listNotifications`, for the same
 * kind of reason.
 */
/**
 * **Rendered per request, never at build time.**
 *
 * Next prerenders a sitemap by default, and a prerendered one here is wrong twice over: it would
 * freeze the catalogue as it looked the day of the deploy, and it would freeze it *empty* — on
 * Vercel the service account lives in environment variables that deliberately never reach the
 * build step, so `listAvailableProperties()` at build time is a read with no credentials. The
 * `catch` below would do its job and produce the three static entries, and that stub would then be
 * served as the sitemap until somebody deployed again.
 *
 * A sitemap is fetched by a handful of crawlers a few times a day; one Firestore read per fetch is
 * the cheapest half of this trade.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = metadataOrigin();

  /*
   * `/` is the login, and it is also the site's front door — somebody searching the brand should
   * find it. It is here with a low priority, which is the honest description of a page with a form
   * on it: real, worth resolving, not what this site is about.
   */
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}${PROPERTIES_ROUTE}`,
      changeFrequency: "daily",
      priority: 1,
    },
    { url: `${origin}${LOGIN_ROUTE}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}${SUPPORT_ROUTE}`, changeFrequency: "yearly", priority: 0.3 },
    /*
     * The three legal documents, and they belong here rather than being merely reachable.
     *
     * A policy nobody can find is not published, which is half of the point of Ley 1480 art. 50
     * for an e-commerce provider — and both Fincaraíz and Metrocuadrado index theirs. They are
     * also what somebody checking whether this product is real goes looking for, and a search
     * result is where they look first. Low priority and `yearly`, which is the truth about a
     * document whose version only moves when the policy does.
     */
    { url: `${origin}${TERMS_ROUTE}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}${PRIVACY_ROUTE}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}${COOKIES_ROUTE}`, changeFrequency: "yearly", priority: 0.3 },
  ];

  let published: readonly Awaited<ReturnType<typeof listAvailableProperties>>[number][] = [];
  try {
    published = await listAvailableProperties();
  } catch (error) {
    console.error("sitemap: could not read the published listings:", error);

    return entries;
  }

  /*
   * Una ciudad por cada una que tiene inmuebles publicados, y ninguna más — la misma regla que el
   * selector del catálogo: ofrecer "Arriendos en Pereira" sin nada en Pereira es prometer una
   * página vacía, y una página vacía indexada es peor que ninguna.
   *
   * La fecha de la ciudad es la del anuncio más reciente que tiene, que es cuando esa lista cambió
   * de verdad.
   */
  const cities = new Map<string, string>();
  for (const property of published) {
    const previous = cities.get(property.area.city);
    if (!previous || property.updatedAt > previous) {
      cities.set(property.area.city, property.updatedAt);
    }
  }

  for (const [city, lastModified] of cities) {
    entries.push({
      url: `${origin}${PROPERTIES_ROUTE}?city=${encodeURIComponent(city)}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const property of published) {
    entries.push({
      url: `${origin}${propertyDetailRoute(property.slug)}`,
      lastModified: property.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  return entries;
}
