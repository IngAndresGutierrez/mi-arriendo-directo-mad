import Image from "next/image";
import Link from "next/link";
import { BedDoubleIcon, RulerIcon } from "lucide-react";

import { propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";

import {
  propertyMonthlyCost,
  publicLocationLabel,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "../domain/property";

/**
 * One listing as a shop-window card: photo on top, price under it.
 *
 * **A second card rather than a variant of `PropertyCard`.** That one is the catalogue's row — a
 * photo beside a six-fact grid, laid out to be scanned vertically against the five rows under it —
 * and it is the right shape there. A landing shows three across, where the same component would
 * either squeeze the facts into a column too narrow to read or force a `layout` prop whose two
 * branches share almost no markup. What they do share is the rules that matter, and those live
 * where they already lived: `propertyMonthlyCost` and `publicLocationLabel`.
 *
 * So the two invariants come across intact. **The price is the total**, rent plus administration,
 * because a card showing only the rent makes every listing with a fee look cheaper than it is. And
 * **the street never appears** — barrio and city, the same as everywhere else public.
 *
 * There is no "no photo" branch here: `showcaseListings()` has already dropped those, because this
 * is the one surface where leading with an empty frame does the landlord no favours.
 */
export function PropertyTeaserCard({
  property,
  eager = false,
}: {
  readonly property: Property;
  /** `true` for the cards a wide screen shows without scrolling; the rest stay lazy. */
  readonly eager?: boolean;
}) {
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
          {PROPERTY_TYPE_LABELS[property.type]}
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
