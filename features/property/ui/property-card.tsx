import Image from "next/image";
import Link from "next/link";
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
  LEASE_TERM_LABELS,
  PARKING_LABELS,
  propertyMonthlyCost,
  publicLocationLabel,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "../domain/property";

/** `2026-09-01` as `1 de septiembre de 2026`, in Bogotá time so the day cannot slide. */
function availableFromLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;

  return new Intl.DateTimeFormat("es-CO", {
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
export function PropertyCard({
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
              Sin fotos
            </span>
          )}

          <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge>{PROPERTY_TYPE_LABELS[property.type]}</Badge>
            {property.furnished && <Badge tone="accent">Amoblado</Badge>}
            {property.petsAllowed && <Badge>Acepta mascotas</Badge>}
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
              {property.bedrooms === 1 ? "1 habitación" : `${property.bedrooms} habitaciones`}
            </Fact>
            <Fact icon={<RulerIcon className="size-4" aria-hidden="true" />}>
              {property.areaM2} m²
            </Fact>
            <Fact icon={<BathIcon className="size-4" aria-hidden="true" />}>
              {property.bathrooms === 1 ? "1 baño" : `${property.bathrooms} baños`}
            </Fact>
            <Fact icon={<LayersIcon className="size-4" aria-hidden="true" />}>
              Estrato {property.stratum}
            </Fact>
            <Fact icon={<CarIcon className="size-4" aria-hidden="true" />}>
              {PARKING_LABELS[property.parking]}
            </Fact>
            <Fact icon={<CalendarRangeIcon className="size-4" aria-hidden="true" />}>
              Mínimo {LEASE_TERM_LABELS[property.minLeaseMonths]}
            </Fact>
          </ul>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-1">
            <div>
              <p className="text-2xl font-semibold text-primary dark:text-foreground">
                {formatCOP(total)}
                <span className="text-sm font-normal text-muted-foreground"> al mes</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {property.adminFee > 0
                  ? `Canon ${formatCOP(property.rent)} + administración ${formatCOP(property.adminFee)}`
                  : "Administración incluida"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Disponible desde{" "}
                <strong className="font-medium text-foreground">
                  {availableFromLabel(property.availableFrom)}
                </strong>
              </p>
            </div>

            <Button asChild variant="accent" size="lg">
              <Link href={href}>Ver inmueble</Link>
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
