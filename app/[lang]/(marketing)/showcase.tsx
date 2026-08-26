import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ArrowRightIcon } from "lucide-react";

import { PropertyTeaserCard, type Property } from "@/features/property";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";
import type { Dictionary } from "@/shared/i18n";

/**
 * The most recent listings, as proof rather than as decoration.
 *
 * A landing that describes a marketplace without showing anything in it is asking to be taken on
 * faith. These are real published inmuebles with their real total price, and pressing one goes to
 * the same public detail page a link pasted into WhatsApp resolves to.
 *
 * **The section removes itself when there is nothing to show.** With an empty catalogue the honest
 * page is one that goes straight from "cómo funciona" to the invitation to publish — a row of
 * skeletons or "muy pronto" cards would be an empty shop window with the lights on.
 */
export function Showcase({
  listings,
  copy,
}: {
  readonly listings: readonly Property[];
  readonly copy: Dictionary["landing"]["showcase"];
}) {
  if (listings.length === 0) return null;

  return (
    <section className="bg-muted/50 py-16 sm:py-20 dark:bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {copy.body}
            </p>
          </div>

          <Button asChild variant="brand" size="xl">
            <Link href={PROPERTIES_ROUTE}>
              {copy.seeAll}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/*
            Every card here stays lazy — the opposite call from the catalogue, where the first two
            are marked eager because they are the first thing on screen. This section is well below
            the fold, so nothing in it is the LCP, and making one eager would pull a full-size photo
            into the critical path of a page whose LCP is the hero's headline.
          */}
          {listings.map((property) => (
            <PropertyTeaserCard key={property.id} property={property} />
          ))}
        </ul>
      </div>
    </section>
  );
}
