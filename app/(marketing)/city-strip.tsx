import Image from "next/image";
import Link from "next/link";

import { type CityCount } from "@/features/property";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";

/**
 * Where this product actually has inmuebles, with the count beside each one.
 *
 * Codomo's equivalent is three cities with a bed count each, and the count is the part worth
 * copying: a city with a number next to it is a promise the next page can keep. **A city with no
 * listings is simply not here** — the same rule `app/sitemap.ts` follows, for the same reason.
 * Offering "Arriendos en Pereira" with nothing in Pereira is how a catalogue teaches somebody on
 * their first visit that it is empty.
 *
 * The whole section disappears when nothing is published. A grid of empty slots saying "muy pronto"
 * is worse than the section not existing: it tells a visitor the product has no supply, on the
 * screen where they are deciding whether to bother.
 */
export function CityStrip({ cities }: { readonly cities: readonly CityCount[] }) {
  if (cities.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
      <h2 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
        Vive donde quieres vivir
      </h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Estas son las ciudades donde hay inmuebles publicados hoy. El número es real y cambia con el
        catálogo.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((entry) => (
          <li key={entry.city}>
            <Link
              href={`${PROPERTIES_ROUTE}?city=${encodeURIComponent(entry.city)}`}
              className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/*
                A photograph of a real listing in that city, or the brand panel when the city has
                none yet. Not a grey placeholder box: a card that is half empty grey reads as an
                image that failed to load, which is the same call the Open Graph card makes when a
                listing has no photo — a different composition, not the same one with a hole.
              */}
              {entry.cover ? (
                <Image
                  src={entry.cover}
                  alt=""
                  width={640}
                  height={420}
                  unoptimized
                  className="aspect-3/2 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex aspect-3/2 w-full items-center justify-center bg-brand-panel text-2xl font-semibold text-brand-panel-muted"
                >
                  {entry.city}
                </span>
              )}

              <span className="flex items-baseline justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold text-primary dark:text-foreground">
                    {entry.city}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {entry.department}
                  </span>
                </span>
                {/*
                  The count is text, not only a colour or a size: "12 inmuebles" is read out as it
                  stands, and the singular is spelled because "1 inmuebles" is the kind of thing a
                  visitor reads as a site nobody maintains.
                */}
                <span className="shrink-0 text-sm font-medium text-foreground">
                  {entry.count === 1 ? "1 inmueble" : `${entry.count} inmuebles`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
