import type { Metadata } from "next";
import { Suspense } from "react";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ChevronLeftIcon, ChevronRightIcon, HouseIcon } from "lucide-react";

import {
  catalogJsonLd,
  catalogMetaDescription,
  catalogMetaTitle,
  catalogQuery,
  CATALOG_PAGE_SIZE,
  CatalogFilters,
  CatalogToolbar,
  countFacets,
  filterProperties,
  hasActiveFilters,
  listAvailableProperties,
  paginate,
  parseCatalogFilters,
  propertyLabels,
  PropertyCard,
  sortProperties,
} from "@/features/property";
import { PROPERTIES_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { LOCALE_OG, type Dictionary, type Locale } from "@/shared/i18n";
import type { PropertyLabels } from "@/features/property";
import { localeAlternates } from "@/shared/i18n/seo";
import { currentLocale, dictionary } from "@/shared/i18n/server";
import { metadataOrigin } from "@/shared/lib/site-url";
import { JsonLd } from "@/shared/seo/json-ld";
import { Button } from "@/shared/ui/button";
import { LoadingScreen, Skeleton } from "@/shared/ui/skeleton";

type CatalogProps = PageProps<"/[lang]/inmuebles">;

export async function generateMetadata(props: CatalogProps): Promise<Metadata> {
  const filters = parseCatalogFilters(await props.searchParams);
  const locale = await currentLocale();
  const title = catalogMetaTitle(filters, locale);
  const description = catalogMetaDescription(filters, locale);
  /*
   * The canonical is the city alone: the facets and the page number are ways of looking at the
   * same catalog, not pages a search engine should index separately.
   *
   * And deliberately **without** a `noindex` on the filtered variants. Combining a `noindex` with
   * a canonical pointing somewhere else is a contradiction — one tag says "drop this page", the
   * other says "credit it to that one" — and Google's documented answer to the pair is to trust
   * neither. The canonical alone is the whole instruction, and discovery of the listings behind
   * page four is the sitemap's job, not the pager's.
   */
  const path = filters.city
    ? `${PROPERTIES_ROUTE}?city=${encodeURIComponent(filters.city)}`
    : PROPERTIES_ROUTE;

  /*
   * The canonical is still the city alone — the facets and the page number collapse into it — but it
   * is now the city **in the language being rendered**, with the other language named beside it.
   * A single canonical pointing at the Spanish URL would have told a search engine to drop every
   * English catalogue page, which is the opposite of what publishing them is for.
   */
  const alternates = localeAlternates(locale, path);

  return {
    title,
    description,
    alternates,
    // Sin esto, un enlace a "/inmuebles?city=Manizales" pegado en un grupo de WhatsApp previsualiza
    // la descripción genérica del sitio y no la ciudad que alguien acaba de buscar.
    /*
     * `locale` is restated here, and it has to be. Metadata merges **per field**, so this object
     * replaces the root layout's whole `openGraph` — the trap two pages in this product already fell
     * into with `robots`. Without it the English catalogue shipped with no `og:locale` at all, so a
     * shared link previewed as though it were the Spanish page.
     */
    openGraph: { title, description, url: alternates.canonical, locale: LOCALE_OG[locale] },
  };
}

export default async function CatalogPage(props: CatalogProps) {
  const [filters, copy, locale] = await Promise.all([
    parseCatalogFilters(await props.searchParams),
    dictionary(),
    currentLocale(),
  ]);
  const t = copy.catalog;
  const labels = propertyLabels(locale);

  /*
   * The heading renders at once and the catalog itself streams in behind a `Suspense`.
   *
   * Not a `loading.tsx`: that file covers a segment **and its children**, so the one that would
   * serve this list would also sit above `/inmuebles/<slug>` — and a boundary above a route turns
   * its `notFound()` into a 200 with the not-found page streamed inside, which for the one public
   * page search engines index is a soft 404. In here it costs nothing and reaches only the part
   * that is actually waiting on Firestore.
   */
  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
        {filters.city ? t.titleInCity(filters.city) : t.titleDefault}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t.body}</p>

      <Suspense key={catalogQuery(filters)} fallback={<CatalogSkeleton label={t.loading} />}>
        <CatalogResults
          filters={filters}
          copy={t}
          locale={locale}
          labels={labels}
          propertyCopy={copy.property}
        />
      </Suspense>
    </div>
  );
}

/** The part that reads Firestore, so the heading above it does not have to wait for it. */
async function CatalogResults({
  filters,
  copy,
  locale,
  labels,
  propertyCopy,
}: {
  readonly filters: ReturnType<typeof parseCatalogFilters>;
  readonly copy: Dictionary["catalog"];
  readonly locale: Locale;
  /**
   * The listing vocabulary, for the two Client Components below.
   *
   * Resolved here rather than inside them: `CatalogFilters` and `CatalogToolbar` are
   * `"use client"`, and importing the dictionary there would ship **both** languages in the
   * browser bundle of the most-fetched page on the site.
   */
  readonly labels: PropertyLabels;
  readonly propertyCopy: Dictionary["property"];
}) {
  // One read; the filtering, counting, sorting and paging happen over it. `CATALOG_MAX_SCAN`
  // explains why, and when that stops being the right shape.
  const published = await listAvailableProperties();
  const facets = countFacets(published, filters);
  const page = paginate(sortProperties(filterProperties(published, filters), filters.sort), filters.page);

  return (
    <div className="mt-8 grid items-start gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-stretch">
        {/*
          Lo que hay en esta página, para una máquina. Va aquí dentro y no en el componente de la
          página porque necesita los resultados ya filtrados y paginados: un `ItemList` que
          enumerara el catálogo entero estaría describiendo una página que nadie ve.
        */}
        <JsonLd
          data={catalogJsonLd(
            page.items,
            filters,
            metadataOrigin(),
            filters.city
              ? `${PROPERTIES_ROUTE}?city=${encodeURIComponent(filters.city)}`
              : PROPERTIES_ROUTE,
            propertyDetailRoute,
            CATALOG_PAGE_SIZE,
            locale,
          )}
        />

        {/* From `lg` the facets have a column; below that they are behind the toolbar's button. */}
        <aside
          aria-label={copy.filtersAriaLabel}
          className="hidden rounded-2xl border border-border bg-card p-5 lg:block lg:h-full lg:overflow-y-auto"
        >
          <CatalogFilters filters={filters} facets={facets} labels={labels} />
        </aside>

        <div className="flex min-w-0 flex-col space-y-6 lg:h-full lg:min-h-0">
          <CatalogToolbar
            filters={filters}
            facets={facets}
            total={page.total}
            labels={labels}
            foundLabel={propertyCopy.found(page.total)}
          />

          {page.total === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <HouseIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-md text-sm text-muted-foreground">
                {hasActiveFilters(filters) ? copy.emptyFiltered : copy.emptyCatalog}
              </p>
              {hasActiveFilters(filters) && (
                <Button asChild variant="outline" size="lg">
                  <Link href={PROPERTIES_ROUTE}>{copy.clearFilters}</Link>
                </Button>
              )}
            </div>
          ) : (
            /* La lista es la única zona con desplazamiento propio; `pr-1` deja aire para su barra. */
            <ul className="space-y-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {page.items.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  /*
                    The first two are above the fold on a wide screen; on a phone only the
                    first is, so the second starts a little early. The trade is for not
                    leaving the LCP to lazy loading. Everything below stays lazy.
                  */
                  eager={index < 2}
                />
              ))}
            </ul>
          )}

          {page.pages > 1 && (
            <nav
              aria-label={copy.paginationAriaLabel}
              /* `shrink-0`: se queda visible al pie de la columna en vez de irse con el scroll. */
              className="flex shrink-0 items-center justify-between gap-4 border-t border-border pt-4"
            >
              <PageLink
                to={page.page - 1}
                disabled={page.page === 1}
                filters={filters}
                label={copy.previous}
                icon="left"
              />
              <p className="text-sm text-muted-foreground">
                {copy.pageOf(page.page, page.pages)}
              </p>
              <PageLink
                to={page.page + 1}
                disabled={page.page === page.pages}
                filters={filters}
                label={copy.next}
                icon="right"
              />
            </nav>
          )}
        </div>
    </div>
  );
}

/** The catalog's shape while it loads: the facets column and a few cards. */
function CatalogSkeleton({ label }: { readonly label: string }) {
  return (
    <LoadingScreen label={label}>
      <div className="mt-8 grid items-start gap-6 lg:mt-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 w-full rounded-2xl lg:block" />
        <div className="space-y-5">
          <Skeleton className="h-24 w-full rounded-2xl" />
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </LoadingScreen>
  );
}

/**
 * A real `<a>` per page, not a button: paging is navigation, so it has to be openable in a new
 * tab and reachable without JavaScript. The unavailable end is a disabled span rather than a
 * link to nowhere.
 */
function PageLink({
  to,
  disabled,
  filters,
  label,
  icon,
}: {
  readonly to: number;
  readonly disabled: boolean;
  readonly filters: Parameters<typeof catalogQuery>[0];
  readonly label: string;
  readonly icon: "left" | "right";
}) {
  const Icon = icon === "left" ? ChevronLeftIcon : ChevronRightIcon;
  const content = (
    <>
      {icon === "left" && <Icon className="size-4" aria-hidden="true" />}
      {label}
      {icon === "right" && <Icon className="size-4" aria-hidden="true" />}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className="flex items-center gap-1.5 text-sm text-muted-foreground/50">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={`${PROPERTIES_ROUTE}${catalogQuery({ ...filters, page: to })}`}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-foreground"
    >
      {content}
    </Link>
  );
}
