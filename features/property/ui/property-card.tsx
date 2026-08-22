import Image from "next/image";
import Link from "next/link";
import { BathIcon, BedIcon, RulerIcon } from "lucide-react";

import { propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";

import {
  propertyMonthlyCost,
  publicLocationLabel,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "../domain/property";

/**
 * One listing in the public catalog.
 *
 * The whole card is the link: on a phone a small "Ver más" is a target you miss. The price is
 * the total — rent plus administration — because a card that shows only the rent makes every
 * listing with a fee look cheaper than it is, and the tenant finds out at the detail page.
 *
 * The address is deliberately absent: the card carries neighbourhood and city, and the street
 * stays private until a tenant is approved.
 */
export function PropertyCard({
  property,
  eager = false,
}: {
  readonly property: Property;
  /**
   * `true` for the cards visible without scrolling: their cover is the Largest Contentful
   * Paint, and Next lazy-loads by default, which makes the catalog measure slower than it is.
   *
   * `loading="eager"` rather than `preload`: in a grid, which image is the LCP depends on the
   * viewport, and that is exactly the case Next's docs say not to preload.
   */
  readonly eager?: boolean;
}) {
  const cover = property.photos[0];
  const bathrooms = property.bathrooms === 1 ? "1 baño" : `${property.bathrooms} baños`;
  const bedrooms = property.bedrooms === 1 ? "1 hab" : `${property.bedrooms} hab`;

  return (
    <li>
      <Link
        href={propertyDetailRoute(property.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            width={600}
            height={450}
            loading={eager ? "eager" : "lazy"}
            unoptimized
            className="aspect-4/3 w-full object-cover"
          />
        ) : (
          <span className="flex aspect-4/3 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            Sin fotos
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <p className="text-xs text-muted-foreground">{PROPERTY_TYPE_LABELS[property.type]}</p>
          <h2 className="line-clamp-2 font-semibold text-foreground group-hover:underline">
            {property.title}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {publicLocationLabel(property.area)}
          </p>

          <p className="mt-2 font-semibold text-primary dark:text-foreground">
            {formatCOP(propertyMonthlyCost(property))}
            <span className="text-sm font-normal text-muted-foreground"> al mes</span>
          </p>

          <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <BedIcon className="size-4" aria-hidden="true" />
              {bedrooms}
            </li>
            <li className="flex items-center gap-1.5">
              <BathIcon className="size-4" aria-hidden="true" />
              {bathrooms}
            </li>
            <li className="flex items-center gap-1.5">
              <RulerIcon className="size-4" aria-hidden="true" />
              {property.areaM2} m²
            </li>
          </ul>
        </div>
      </Link>
    </li>
  );
}
