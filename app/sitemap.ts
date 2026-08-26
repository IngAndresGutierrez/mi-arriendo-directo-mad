import type { MetadataRoute } from "next";

import { listAvailableProperties } from "@/features/property";
import {
  COOKIES_ROUTE,
  LANDING_ROUTE,
  PRIVACY_ROUTE,
  PROPERTIES_ROUTE,
  propertyDetailRoute,
  SUPPORT_ROUTE,
  TERMS_ROUTE,
} from "@/shared/auth/routes";
import { localeSitemapRows } from "@/shared/i18n/seo";
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

/**
 * A relative row made absolute, alternates included.
 *
 * The `hreflang` values have to be absolute too. A relative `href` inside `<xhtml:link>` is not
 * resolved by the crawler against anything — it is simply ignored, which silently turns a
 * two-language cluster back into two unrelated pages, exactly the failure the alternates were added
 * to prevent. `metadataBase` does this for a page's own metadata; a sitemap has no such base.
 */
function withOrigin(origin: string) {
  return <T extends { url: string; alternates: { languages: Record<string, string> } }>(
    row: T,
  ): T => ({
    ...row,
    url: `${origin}${row.url}`,
    alternates: {
      languages: Object.fromEntries(
        Object.entries(row.alternates.languages).map(([tag, href]) => [tag, `${origin}${href}`]),
      ),
    },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = metadataOrigin();
  const absolute = withOrigin(origin);

  /*
   * `/` is the landing: what this product is, for somebody who has never heard of it. It carries
   * the same priority as the catalogue because it is the other page this site is *about* — the
   * catalogue answers "what is available" and this one answers "what is this".
   *
   * **The login is deliberately not here any more.** While `/` was the login it was in this list
   * with a low priority, which was the honest description of a page with a form on it. Now that it
   * lives at `/ingresar` it is plain `noindex` like the rest of `(auth)`, and asking a crawler to
   * index a page that asks not to be indexed is the contradiction the catalogue's canonical note
   * already warns about.
   */
  /**
   * **Every URL is submitted in both languages, and each row carries the whole cluster.**
   *
   * `localeSitemapRows` turns one canonical path into one row per locale with the same
   * `alternates.languages` on both. The English URL has to be *in* the list to be crawled at all —
   * an `hreflang` tag on a page nobody fetched is a tag nobody reads — and the alternates are what
   * stop the pair from competing with each other for the same query.
   *
   * `absolute()` is applied at the end rather than here: the helper deals in canonical relative
   * paths, which is what keeps it testable without an origin, and a sitemap needs absolute URLs.
   */
  const paths: readonly { path: string; row: Omit<MetadataRoute.Sitemap[number], "url"> }[] = [
    { path: PROPERTIES_ROUTE, row: { changeFrequency: "daily", priority: 1 } },
    { path: LANDING_ROUTE, row: { changeFrequency: "weekly", priority: 1 } },
    { path: SUPPORT_ROUTE, row: { changeFrequency: "yearly", priority: 0.3 } },
    /*
     * The three legal documents, and they belong here rather than being merely reachable.
     *
     * A policy nobody can find is not published, which is half of the point of Ley 1480 art. 50
     * for an e-commerce provider — and both Fincaraíz and Metrocuadrado index theirs. They are
     * also what somebody checking whether this product is real goes looking for, and a search
     * result is where they look first. Low priority and `yearly`, which is the truth about a
     * document whose version only moves when the policy does.
     *
     * **They are submitted in both languages even though the documents themselves are Spanish
     * only.** The URL exists in both — `/en/terminos` renders the Spanish text inside the English
     * chrome and says so on the page — and declaring the pair is what stops a search engine
     * treating the two as duplicates of unknown relation. Translating the documents is a lawyer's
     * job, not a build step; see the note on the page.
     */
    { path: TERMS_ROUTE, row: { changeFrequency: "yearly", priority: 0.3 } },
    { path: PRIVACY_ROUTE, row: { changeFrequency: "yearly", priority: 0.3 } },
    { path: COOKIES_ROUTE, row: { changeFrequency: "yearly", priority: 0.3 } },
  ];

  const entries: MetadataRoute.Sitemap = paths.flatMap(({ path, row }) =>
    localeSitemapRows(path, row).map(absolute),
  );


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
    entries.push(
      ...localeSitemapRows(`${PROPERTIES_ROUTE}?city=${encodeURIComponent(city)}`, {
        lastModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }).map(absolute),
    );
  }

  /*
   * **The slug is the same in both languages, on purpose.** It is minted from the landlord's own
   * Spanish title and reserved in `propertySlugs/{slug}`, whose document id *is* the slug — one
   * listing, one slug, and the language lives in the prefix in front of it. Translating slugs would
   * mean a second reservation collection and two URLs that can drift apart for one property.
   */
  for (const property of published) {
    entries.push(
      ...localeSitemapRows(propertyDetailRoute(property.slug), {
        lastModified: property.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      }).map(absolute),
    );
  }

  return entries;
}
