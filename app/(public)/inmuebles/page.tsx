import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, HouseIcon } from "lucide-react";

import {
  catalogQuery,
  CatalogFilters,
  CatalogToolbar,
  countFacets,
  filterProperties,
  hasActiveFilters,
  listAvailableProperties,
  paginate,
  parseCatalogFilters,
  PropertyCard,
  sortProperties,
} from "@/features/property";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

type CatalogProps = PageProps<"/inmuebles">;

export async function generateMetadata(props: CatalogProps): Promise<Metadata> {
  const { city } = parseCatalogFilters(await props.searchParams);
  const where = city ? ` en ${city}` : " en Colombia";

  return {
    title: city ? `Arriendos en ${city}` : "Inmuebles en arriendo",
    description:
      `Inmuebles en arriendo${where} por 6 o 12 meses, directamente con el propietario. ` +
      "Sin intermediarios y con el proceso a la vista de ambas partes.",
    // The canonical is the city alone: the facets and the page number are ways of looking at
    // the same catalog, not pages a search engine should index separately.
    alternates: {
      canonical: city ? `${PROPERTIES_ROUTE}?city=${encodeURIComponent(city)}` : PROPERTIES_ROUTE,
    },
  };
}

export default async function CatalogPage(props: CatalogProps) {
  const filters = parseCatalogFilters(await props.searchParams);

  // One read; the filtering, counting, sorting and paging happen over it. `CATALOG_MAX_SCAN`
  // explains why, and when that stops being the right shape.
  const published = await listAvailableProperties();
  const facets = countFacets(published, filters);
  const page = paginate(sortProperties(filterProperties(published, filters), filters.sort), filters.page);

  return (
    // `h-full` + `overflow-hidden` desde lg: el alto lo pone la ventana y el que se desplaza es
    // el listado, no la página. El encabezado, los filtros y la paginación se quedan quietos.
    <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
        {filters.city ? `Arriendos en ${filters.city}` : "Encuentra tu próximo hogar"}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Directamente con el propietario, por 6 o 12 meses. Sin intermediarios y sin comisión de
        inmobiliaria.
      </p>

      <div className="mt-8 grid items-start gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-stretch">
        {/* From `lg` the facets have a column; below that they are behind the toolbar's button. */}
        <aside
          aria-label="Filtros"
          className="hidden rounded-2xl border border-border bg-card p-5 lg:block lg:h-full lg:overflow-y-auto"
        >
          <CatalogFilters filters={filters} facets={facets} />
        </aside>

        <div className="flex min-w-0 flex-col space-y-6 lg:h-full lg:min-h-0">
          <CatalogToolbar filters={filters} facets={facets} total={page.total} />

          {page.total === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <HouseIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-md text-sm text-muted-foreground">
                {hasActiveFilters(filters)
                  ? "Ningún inmueble coincide con lo que buscas. Prueba quitando un filtro: puede que el tuyo esté a una cuadra."
                  : "Todavía no hay inmuebles publicados. Vuelve pronto: los propietarios están llegando."}
              </p>
              {hasActiveFilters(filters) && (
                <Button asChild variant="outline" size="lg">
                  <Link href={PROPERTIES_ROUTE}>Quitar filtros</Link>
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
              aria-label="Paginación"
              /* `shrink-0`: se queda visible al pie de la columna en vez de irse con el scroll. */
              className="flex shrink-0 items-center justify-between gap-4 border-t border-border pt-4"
            >
              <PageLink
                to={page.page - 1}
                disabled={page.page === 1}
                filters={filters}
                label="Anteriores"
                icon="left"
              />
              <p className="text-sm text-muted-foreground">
                Página {page.page} de {page.pages}
              </p>
              <PageLink
                to={page.page + 1}
                disabled={page.page === page.pages}
                filters={filters}
                label="Siguientes"
                icon="right"
              />
            </nav>
          )}
        </div>
      </div>
    </div>
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
