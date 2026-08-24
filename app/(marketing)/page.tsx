import type { Metadata } from "next";
import { Suspense } from "react";
import { cache } from "react";

import {
  countCities,
  listAvailableProperties,
  showcaseListings,
  type Property,
} from "@/features/property";
import { LANDING_ROUTE } from "@/shared/auth/routes";

import { CityStrip } from "./city-strip";
import { ClosingCta } from "./closing-cta";
import { Hero, SearchCard } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Showcase } from "./showcase";
import { WhyDirect } from "./why-direct";

/** How many cities the strip shows before it stops being a grid and starts being a list. */
const CITIES_SHOWN = 6;
/** Two rows of three on a wide screen. */
const LISTINGS_SHOWN = 6;

export const metadata: Metadata = {
  /*
   * **`title.absolute`, not `title`.** The root layout's template appends
   * " · miarriendoDIRECTO.com" to every page title, which on the homepage would produce the brand
   * name twice in one tab and one search result.
   */
  title: {
    absolute: "miarriendoDIRECTO.com · Arrienda directo, sin intermediarios",
  },
  description:
    "Arrienda directamente con el propietario en Colombia: sin comisión de inmobiliaria y sin fiador. Perfiles verificados, contrato firmado en línea y cada pago con su soporte.",
  /*
   * The one URL this site is published at. `metadataOrigin()` is already the `metadataBase` in the
   * root layout, so a relative canonical resolves against it — and against the *canonical* origin
   * rather than the request's, which is what stops a preview deployment declaring itself the home
   * of the brand.
   */
  alternates: { canonical: LANDING_ROUTE },
  openGraph: {
    title: "miarriendoDIRECTO.com · Arrienda directo, sin intermediarios",
    description:
      "Arrienda directamente con el propietario en Colombia: sin comisión de inmobiliaria y sin fiador.",
    url: LANDING_ROUTE,
  },
  /*
   * Inherits `index: true` from the root layout, and says nothing about robots on purpose.
   * Metadata merges per field, so an object here would replace the layout's whole one and take
   * `max-image-preview: large` with it — the mistake two pages in this product already made.
   */
};

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
export default function LandingPage() {
  return (
    <>
      {/*
        The hero renders at once; only its city list waits on Firestore, and its fallback is the
        same form offering every city. See `Hero`'s note — the headline is the LCP of the most
        fetched page on the site and must not sit behind a query.
      */}
      <Hero
        searchCard={
          <Suspense fallback={<SearchCard cities={[]} />}>
            <SearchCardWithCities />
          </Suspense>
        }
      />

      <WhyDirect />

      {/*
        The data-driven sections stream together behind one boundary: they are adjacent, they come
        from the same read, and two boundaries would pop the page into place in two steps. The
        fallback is `null` rather than a skeleton because both sections remove themselves entirely
        when the catalogue is empty — a skeleton would promise content that may never arrive, then
        collapse, which is a worse flicker than the section simply appearing.
      */}
      <Suspense fallback={null}>
        <CatalogSections />
      </Suspense>

      <HowItWorks />
      <ClosingCta />
    </>
  );
}

async function SearchCardWithCities() {
  return <SearchCard cities={countCities(await published())} />;
}

async function CatalogSections() {
  const listings = await published();

  return (
    <>
      <CityStrip cities={countCities(listings, CITIES_SHOWN)} />
      <Showcase listings={showcaseListings(listings, LISTINGS_SHOWN)} />
    </>
  );
}
