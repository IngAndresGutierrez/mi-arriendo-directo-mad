import { currentLocale } from "@/shared/i18n/server";

import { propertyLabels } from "../domain/labels";
import Image from "next/image";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { BedDoubleIcon, RulerIcon } from "lucide-react";

import { propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";

import {
  propertyMonthlyCost,
  publicLocationLabel,
  type Property,
} from "../domain/property";

/**
 * One listing as a shop-window card: photo on top, price under it.
 *
 * **A second card rather than a variant of `PropertyCard`, and the reason moved.** It used to be
 * the axis: that one was the catalogue's row — a photo beside a six-fact grid — and this one
 * stacked, so they shared almost no markup. The catalogue is three across now and its card stacks
 * too, so what keeps them apart is density rather than shape. A shop window is glanced at on the
 * way past: it carries the price, two facts and nothing else, with no badges, no verification and
 * no button, because the whole card is one link to the listing. The catalogue's card is what
 * somebody compares six of, so it carries all six facts, the tags, the breakdown of the canon and
 * the date it frees up. Merging them would mean a `density` prop whose two branches disagree about
 * most of the card. What they do share is the rules that matter, and those live where they always
 * lived: `propertyMonthlyCost` and `publicLocationLabel`.
 *
 * So the two invariants come across intact. **The price is the total**, rent plus administration,
 * because a card showing only the rent makes every listing with a fee look cheaper than it is. And
 * **the street never appears** — barrio and city, the same as everywhere else public.
 *
 * There is no "no photo" branch here: `showcaseListings()` has already dropped those, because this
 * is the one surface where leading with an empty frame does the landlord no favours.
 */
export async function PropertyTeaserCard({
  property,
  eager = false,
}: {
  readonly property: Property;
  /** `true` for the cards a wide screen shows without scrolling; the rest stay lazy. */
  readonly eager?: boolean;
}) {
  const labels = propertyLabels(await currentLocale());
  const cover = property.photos[0];
  const href = propertyDetailRoute(property.slug);

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      {cover && (
        <Image
          src={cover.url}
          alt=""
          width={640}
          height={480}
          loading={eager ? "eager" : "lazy"}
          unoptimized
          className="aspect-4/3 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      )}

      <div className="p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {labels.types[property.type]}
        </p>

        <h3 className="mt-1 text-base font-semibold text-balance text-primary dark:text-foreground">
          {/*
            The title's link is stretched over the whole card, so the hit area is the card and not
            four words at the top — the same `after:absolute after:inset-0` the tenancy card uses.
            It stays a real heading link: one target, and the accessible name is the title.
          */}
          <Link
            href={href}
            className="after:absolute after:inset-0 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {property.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {publicLocationLabel(property.area)}
        </p>

        <p className="mt-3 text-lg font-semibold text-primary dark:text-foreground">
          {formatCOP(propertyMonthlyCost(property))}
          <span className="text-sm font-normal text-muted-foreground"> /mes</span>
        </p>

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <BedDoubleIcon className="size-4" aria-hidden="true" />
            {property.bedrooms === 1 ? "1 habitación" : `${property.bedrooms} habitaciones`}
          </li>
          <li className="flex items-center gap-1.5">
            <RulerIcon className="size-4" aria-hidden="true" />
            {property.areaM2} m²
          </li>
        </ul>
      </div>
    </li>
  );
}
