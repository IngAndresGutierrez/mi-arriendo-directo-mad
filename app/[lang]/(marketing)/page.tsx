import type { Metadata } from "next";
import { Suspense } from "react";
import { cache } from "react";

import {
  countCities,
  listAvailableProperties,
  showcaseListings,
  propertyLabels,
  type Property,
} from "@/features/property";
import { LANDING_ROUTE } from "@/shared/auth/routes";
import { LOCALE_OG, type Dictionary } from "@/shared/i18n";
import { localeAlternates } from "@/shared/i18n/seo";
import { currentLocale, dictionary } from "@/shared/i18n/server";

import { CityStrip } from "./city-strip";
import { ClosingCta } from "./closing-cta";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Showcase } from "./showcase";
import { WhyDirect } from "./why-direct";

/** How many cities the strip shows before it stops being a grid and starts being a list. */
const CITIES_SHOWN = 6;
/** Two rows of three on a wide screen. */
const LISTINGS_SHOWN = 6;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, copy] = await Promise.all([currentLocale(), dictionary()]);
  const t = copy.metadata;

  return {
    /*
     * **`title.absolute`, not `title`.** The root layout's template appends
     * " · miarriendoDIRECTO.com" to every page title, which on the homepage would produce the brand
     * name twice in one tab and one search result.
     */
    title: { absolute: t.landingTitle },
    description: t.landingDescription,
    /*
     * The canonical is now **self-referencing per language**, with both versions named as
     * alternates. `/` and `/en` are one page in two languages; without the `hreflang` pair a search
     * engine has no way to know that and picks one, and pointing the English canonical at `/` would
     * ask for the English landing to be dropped outright. `metadataOrigin()` is already
     * `metadataBase` in the root layout, so these stay relative — and resolve against the canonical
     * origin rather than the request's, which is what stops a preview deployment declaring itself
     * the home of the brand.
     */
    alternates: localeAlternates(locale, LANDING_ROUTE),
    openGraph: {
      title: t.landingTitle,
      description: t.landingOgDescription,
      url: localeAlternates(locale, LANDING_ROUTE).canonical,
      /*
       * Restated because metadata merges **per field**: this object replaces the root layout's whole
       * `openGraph`, so without it the landing shipped no `og:locale` — the same shape as the two
       * pages that once replaced the layout's `robots` and silently dropped `nofollow`.
       */
      locale: LOCALE_OG[locale],
    },
    /*
     * Inherits `index: true` from the root layout, and says nothing about robots on purpose.
     * Metadata merges per field, so an object here would replace the layout's whole one and take
     * `max-image-preview: large` with it — the mistake two pages in this product already made.
     */
  };
}

/**
 * One read, three consumers.
 *
 * `cache()` dedupes it for the length of the request, so the search card's city list, the city
 * strip and the showcase share a single Firestore query rather than issuing one each. It is the
 * same query the catalogue runs, capped by `CATALOG_MAX_SCAN` for the same reason.
 *
 * **It never throws.** This is the front door — the page a person reaches by typing the brand and
 * the one a crawler fetches first — and a Firestore hiccup must cost the listings, not the page.
 * `app/sitemap.ts` and `listNotifications()` already make this trade for the same reason: the
 * static half of the landing is the half that explains the product, and it is worth serving alone.
 */
const published = cache(async (): Promise<readonly Property[]> => {
  try {
    return await listAvailableProperties();
  } catch (error) {
    console.error("landing: could not read the published listings:", error);

    return [];
  }
});

/**
 * The public landing — what `miarriendodirecto.com` answers with.
 *
 * **This route used to be the login**, which meant the one URL somebody reaches by typing the brand
 * answered with a password field: nothing about what the product is, and nothing to do for a
 * visitor who does not have an account yet. The form moved to `/ingresar` and this took its place.
 *
 * The structure is Codomo's, re-aimed at a two-sided marketplace: a statement of the model with the
 * search right there, the cities we actually have supply in, what the platform adds, the process
 * from *both* sides, real listings, and a way out. What did not come across is the photography —
 * this product owns no housing and no photographs of any, so what fills that role is the catalogue
 * itself.
 */
export default async function LandingPage() {
  /*
   * One read for the whole page, sliced per section. The sections take **data**, not a `t()`
   * function: several of them are the kind of thing that later needs to be a Client Component, and
   * a function does not cross the RSC boundary — the same rule that already forbids passing a lucide
   * icon down as a prop.
   */
  const [copy, labels] = await Promise.all([
    dictionary().then((all) => all.landing),
    currentLocale().then(propertyLabels),
  ]);

  return (
    <>
      {/*
        The hero renders at once; only the city `<option>`s wait on Firestore. The boundary is
        **inside** the `<select>` rather than around the form — see `SearchCard`'s note: around the
        form, resolving it replaced the node and reset a choice the visitor had already made.
      */}
      <Hero
        copy={copy.hero}
        types={labels.types}
        cityOptions={
          <Suspense fallback={null}>
            <CityOptions />
          </Suspense>
        }
      />

      <WhyDirect copy={copy.why} />

      {/*
        The data-driven sections stream together behind one boundary: they are adjacent, they come
        from the same read, and two boundaries would pop the page into place in two steps. The
        fallback is `null` rather than a skeleton because both sections remove themselves entirely
        when the catalogue is empty — a skeleton would promise content that may never arrive, then
        collapse, which is a worse flicker than the section simply appearing.
      */}
      <Suspense fallback={null}>
        <CatalogSections copy={copy} />
      </Suspense>

      <HowItWorks copy={copy.how} />
      <ClosingCta copy={copy.closing} />
    </>
  );
}

/**
 * The cities with listings, as bare `<option>`s.
 *
 * A fragment of options and nothing else, because it is streamed straight into the `<select>` the
 * hero already rendered. The empty-catalogue case needs no branch: no cities is no options, and the
 * "Todas las ciudades" option the form renders itself is then the only one — a select with one
 * choice, which is the honest shape of a catalogue with nothing in it.
 */
async function CityOptions() {
  return (
    <>
      {countCities(await published()).map((entry) => (
        <option key={entry.city} value={entry.city}>
          {entry.city}
        </option>
      ))}
    </>
  );
}

async function CatalogSections({ copy }: { readonly copy: Dictionary["landing"] }) {
  const listings = await published();

  return (
    <>
      <CityStrip cities={countCities(listings, CITIES_SHOWN)} copy={copy.cities} />
      <Showcase listings={showcaseListings(listings, LISTINGS_SHOWN)} copy={copy.showcase} />
    </>
  );
}
