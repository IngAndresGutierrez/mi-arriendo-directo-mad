import type { Metadata } from "next";
import Link from "next/link";
import { HouseIcon } from "lucide-react";

import {
  CATALOG_PAGE_SIZE,
  CityFilter,
  listAvailableCities,
  listAvailableProperties,
  parseCityFilter,
  PropertyCard,
} from "@/features/property";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

type CatalogProps = PageProps<"/inmuebles">;

export async function generateMetadata(props: CatalogProps): Promise<Metadata> {
  const city = parseCityFilter((await props.searchParams).city);
  const where = city ? ` en ${city}` : " en Colombia";

  return {
    title: city ? `Arriendos en ${city}` : "Inmuebles en arriendo",
    description:
      `Inmuebles en arriendo${where} por 6 o 12 meses, directamente con el propietario. ` +
      "Sin intermediarios y con el proceso a la vista de ambas partes.",
    alternates: { canonical: city ? `${PROPERTIES_ROUTE}?city=${encodeURIComponent(city)}` : PROPERTIES_ROUTE },
  };
}

export default async function CatalogPage(props: CatalogProps) {
  const city = parseCityFilter((await props.searchParams).city);

  // Independent reads: the listings and the filter's options do not depend on each other.
  const [properties, cities] = await Promise.all([
    listAvailableProperties({ city }),
    listAvailableCities(),
  ]);

  const count = properties.length;
  const isFull = count === CATALOG_PAGE_SIZE;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
            {city ? `Arriendos en ${city}` : "Inmuebles en arriendo"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count === 0
              ? "Nada publicado por ahora."
              : `${count} ${count === 1 ? "inmueble disponible" : "inmuebles disponibles"}${
                  // No pagination yet: say so rather than let the list look complete.
                  isFull ? ", los más recientes" : ""
                }.`}
          </p>
        </div>

        <CityFilter cities={cities} selected={city} />
      </div>

      {count === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <HouseIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            {city
              ? `Todavía no hay inmuebles publicados en ${city}. Mira los de las demás ciudades: puede que el tuyo esté cerca.`
              : "Todavía no hay inmuebles publicados. Vuelve pronto: los propietarios están llegando."}
          </p>
          {city ? (
            <Button asChild variant="outline" size="lg">
              <Link href={PROPERTIES_ROUTE}>Ver todas las ciudades</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              /*
                The first row, which is three cards on a wide screen. On a phone only the
                first is above the fold, so the other two start a little early — the trade
                for not leaving the desktop LCP to lazy loading, which is what the browser
                warned about. Everything below the first row stays lazy.
              */
              eager={index < 3}
            />
          ))}
        </ul>
      )}
    </>
  );
}
