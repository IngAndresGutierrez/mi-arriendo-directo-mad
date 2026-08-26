import { LOCALE_HTML_LANG } from "@/shared/i18n";
import { currentLocale, dictionary } from "@/shared/i18n/server";

import { propertyLabels } from "../domain/labels";
import Image from "next/image";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import {
  BathIcon,
  BedDoubleIcon,
  CalendarRangeIcon,
  CarIcon,
  LayersIcon,
  RulerIcon,
} from "lucide-react";

import { propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";

import {

  propertyMonthlyCost,
  publicLocationLabel,
  type Property,
} from "../domain/property";

/** `2026-09-01` as `1 de septiembre de 2026`, in Bogotá time so the day cannot slide. */
function availableFromLabel(day: string, locale: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;

  /*
   * **The locale picks the wording and the order; the time zone stays Bogotá.** When a flat becomes
   * available is a fact about Colombia, not about where the reader is sitting — so `America/Bogota`
   * is not a default to be localised away. This was `es-CO` hard-coded, which left "24 de agosto de
   * 2026" sitting inside an otherwise English card.
   */
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/**
 * One listing in the public catalog: photo on one side, what a tenant decides with on the other.
 *
 * The price shown is the total — rent plus administration — because a card that shows only the
 * rent makes every listing with a fee look cheaper than it is, and the tenant finds out at the
 * detail page. The breakdown is right underneath when there is a fee.
 *
 * The street address is deliberately absent: the card carries neighbourhood and city, and the
 * exact address is only revealed to an approved tenant.
 */
export async function PropertyCard({
  property,
  eager = false,
}: {
  readonly property: Property;
  /**
   * `true` for the cards visible without scrolling: their cover is the Largest Contentful
   * Paint, and Next lazy-loads by default, which makes the catalog measure slower than it is.
   *
   * `loading="eager"` rather than `preload`: in a list, which image is the LCP depends on the
   * viewport, and that is exactly the case Next's docs say not to preload.
   */
  readonly eager?: boolean;
}) {
  /*
   * A Server Component, so it reads the language itself rather than taking it as a prop: the card is
   * rendered from three different places (the catalogue, the landing's showcase, a search) and
   * threading a `labels` prop through each of them is three chances to forget one.
   */
  const [locale, copy] = await Promise.all([currentLocale(), dictionary()]);
  const t = copy.property;
  const labels = propertyLabels(locale);
  const cover = property.photos[0];
  const href = propertyDetailRoute(property.slug);
  const total = propertyMonthlyCost(property);

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative shrink-0 self-stretch sm:w-64 lg:w-72"
        >
          {cover ? (
            <Image
              src={cover.url}
              alt=""
              width={640}
              height={480}
              loading={eager ? "eager" : "lazy"}
              unoptimized
              /*
                Stacked on a phone the photo keeps its 4:3; beside the facts it fills the row
                instead, or the ratio fights the card's height and leaves bands of background
                above and below.
              */
              className="aspect-4/3 w-full object-cover sm:aspect-auto sm:h-full"
            />
          ) : (
            <span className="flex aspect-4/3 w-full items-center justify-center bg-muted text-xs text-muted-foreground sm:aspect-auto sm:h-full">
              {t.noPhotos}
            </span>
          )}

          <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge>{labels.types[property.type]}</Badge>
            {property.furnished && <Badge tone="accent">{t.furnished}</Badge>}
            {property.petsAllowed && <Badge>{t.petsAllowed}</Badge>}
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-balance text-primary dark:text-foreground">
              {/* The heading is the link: one target, and the accessible name is the title. */}
              <Link href={href} className="hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {property.title}
              </Link>
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {publicLocationLabel(property.area)} · {property.area.department}
            </p>
          </div>

          <ul className="grid gap-x-6 gap-y-2 text-sm text-foreground sm:grid-cols-2">
            <Fact icon={<BedDoubleIcon className="size-4" aria-hidden="true" />}>
              {t.bedroomsFact(property.bedrooms)}
            </Fact>
            <Fact icon={<RulerIcon className="size-4" aria-hidden="true" />}>
              {property.areaM2} m²
            </Fact>
            <Fact icon={<BathIcon className="size-4" aria-hidden="true" />}>
              {t.bathroomsFact(property.bathrooms)}
            </Fact>
            <Fact icon={<LayersIcon className="size-4" aria-hidden="true" />}>
              {t.stratum(property.stratum)}
            </Fact>
            <Fact icon={<CarIcon className="size-4" aria-hidden="true" />}>
              {labels.parking[property.parking]}
            </Fact>
            <Fact icon={<CalendarRangeIcon className="size-4" aria-hidden="true" />}>
              {t.minimumTerm(labels.lease[property.minLeaseMonths])}
            </Fact>
          </ul>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-1">
            <div>
              <p className="text-2xl font-semibold text-primary dark:text-foreground">
                {formatCOP(total)}
                <span className="text-sm font-normal text-muted-foreground"> {copy.common.perMonth}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {property.adminFee > 0
                  ? t.rentPlusAdmin(formatCOP(property.rent), formatCOP(property.adminFee))
                  : t.adminIncluded}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.availableFrom}{" "}
                <strong className="font-medium text-foreground">
                  {availableFromLabel(property.availableFrom, LOCALE_HTML_LANG[locale])}
                </strong>
              </p>
            </div>

            {/*
              `outline`, no `accent`: una página del catálogo son seis tarjetas, y seis botones cian
              son seis llamadas a la acción compitiendo entre sí — que es ninguna. Lo que tiene que
              destacar en una tarjeta es el precio, y lo que decide en cuál entrar son las fotos y
              los metros; este botón es el atajo, no el protagonista. Además la tarjeta entera ya
              lleva a la misma página desde el título.
            */}
            <Button asChild variant="outline" size="lg">
              <Link href={href}>{t.seeProperty}</Link>
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  readonly children: React.ReactNode;
  readonly tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground"
          : "rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground"
      }
    >
      {children}
    </span>
  );
}

function Fact({
  icon,
  children,
}: {
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      <span className="text-primary dark:text-accent">{icon}</span>
      {children}
    </li>
  );
}
