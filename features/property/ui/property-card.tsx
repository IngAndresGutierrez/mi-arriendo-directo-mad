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

import { VerifiedBadge } from "./verified-badge";

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
 * One listing in the public catalog: photo on top, what a tenant decides with underneath.
 *
 * **It used to be a row** — photo on the left, a six-fact grid on the right — and the shape was
 * right while the catalogue was one column. Three to a row is what a wide screen has the width
 * for, and a row card cannot be three to a row: at a third of the column the photo either becomes
 * a stamp or eats the facts. Stacked, the photo keeps a real 4:3 and the facts keep their two
 * columns, and the same six of them are still on the card. What changed is the axis, not what a
 * tenant is told.
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
    /*
      `flex flex-col` so the button can claim `mt-auto`: the grid stretches every card in a row to
      the height of the tallest, so a card with a one-line title would otherwise end in a band of
      card-coloured nothing with its button halfway up the row. The middle absorbs the difference
      instead, and the three buttons line up across the row.

      **And no `h-full` next to it**, which the first version had: a grid item is already stretched
      by `align-items: stretch`, so `height: 100%` is a percentage of a row height being derived
      from this very item. It was not what clipped the card — that was the grid handing each row an
      equal share of a container with a definite height, and the note on the `<ul>` in
      `app/[lang]/(public)/inmuebles/page.tsx` has it — but it is the same circularity from the
      other end, and it buys nothing the stretch does not already do.
    */
    <li className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block shrink-0"
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            width={640}
            height={480}
            loading={eager ? "eager" : "lazy"}
            unoptimized
            className="aspect-4/3 w-full object-cover"
          />
        ) : (
          <span className="flex aspect-4/3 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            {t.noPhotos}
          </span>
        )}

        {/*
          The video is announced on the card and **not** played there. Six cards each fetching a
          walkthrough is six heavy requests on the page where somebody is comparing six
          listings, and what should draw the eye in a card is the price. But a walkthrough nobody
          knows exists is a walkthrough nobody watches, and the catalogue is where the choice
          between the six is actually made — so the badge is the whole of it, and the video
          itself lives one click away on the detail page.

          Not `tone="accent"`: `furnished` already holds the one cyan on this card, and a second
          would be two shouts. Same rule as one `accent` per view, inside a card.
        */}
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge>{labels.types[property.type]}</Badge>
          {property.furnished && <Badge tone="accent">{t.furnished}</Badge>}
          {property.video && <Badge>{t.videoBadge}</Badge>}
          {property.petsAllowed && <Badge>{t.petsAllowed}</Badge>}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        {/*
          El orden es el de la ficha de un portal y no el de la fila que había antes: dónde, cuánto,
          qué. En una fila el título podía ir primero porque tenía el ancho para leerse entero de un
          vistazo; en una columna de un tercio lo que decide si alguien sigue leyendo es el precio,
          y ponerlo al final obligaba a recorrer seis datos para llegar a él. La marca del lector
          baja por la columna de precios de las tres tarjetas de una fila, que es exactamente la
          comparación que se viene a hacer al catálogo.
        */}
        <p className="truncate text-sm text-muted-foreground">
          {publicLocationLabel(property.area)} · {property.area.department}
        </p>

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
        </div>

        <div>
          <h2 className="text-base font-semibold text-balance text-primary dark:text-foreground">
            {/*
              The heading is the link: one target, and the accessible name is the title.

              `line-clamp-2` clamps what is *drawn*, never what is read: the whole title stays in
              the DOM and is still the link's accessible name. Without it a landlord who typed a
              sentence made their card three lines taller than the two beside it, and the grid
              takes the tallest of the row — so one long title left a band of empty card under the
              other two. The full one is one click away on the listing.
            */}
            <Link href={href} className="line-clamp-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              {property.title}
            </Link>
          </h2>
          {/*
            La insignia va **aquí y no en la fila de etiquetas sobre la foto**: aquellas describen
            el inmueble —tipo, amoblado, video— y esta describe a quien lo publica. Mezclarlas
            sería pedirle al lector que distinga dos clases de afirmación por su posición.

            Verde y no cian: el cian de esta tarjeta lo tiene "Amoblado", y la regla de un solo
            acento vale también dentro de una tarjeta.
          */}
          {property.ownershipVerifiedAt ? <VerifiedBadge className="mt-2" /> : null}
        </div>

        {/*
          Los seis datos siguen estando: son con lo que se descarta un inmueble sin abrirlo, y
          quitar cuatro para que la tarjeta se pareciera más a la de un portal que cobra por el
          contacto sería quitarle al lector justo lo que le ahorra un clic.

          Dos columnas y `gap-x-3` en vez de `gap-x-6`: a un tercio de la columna de resultados
          cada celda son unos 135px, y con la separación anterior "No tiene parqueadero" se partía
          en dos líneas. Que un dato ocupe dos no rompe nada —la fila ya se estira a la tarjeta más
          alta—, pero tres de seis haciéndolo se lee como un error.
        */}
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-sm text-foreground">
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

        <p className="text-xs text-muted-foreground">
          {t.availableFrom}{" "}
          <strong className="font-medium text-foreground">
            {availableFromLabel(property.availableFrom, LOCALE_HTML_LANG[locale])}
          </strong>
        </p>

        {/*
          `outline`, no `accent`: una página del catálogo son seis tarjetas, y seis botones cian
          son seis llamadas a la acción compitiendo entre sí — que es ninguna. Lo que tiene que
          destacar en una tarjeta es el precio, y lo que decide en cuál entrar son las fotos y
          los metros; este botón es el atajo, no el protagonista. Además la tarjeta entera ya
          lleva a la misma página desde el título.

          A lo ancho y al pie, con `mt-auto`: en una columna de un tercio no caben el precio y el
          botón en la misma fila sin que el precio pierda el tamaño con el que destaca, y `mt-auto`
          es lo que deja los tres botones de una fila alineados cuando un título ocupa dos líneas
          y los otros una.
        */}
        <Button asChild variant="outline" size="xl" className="mt-auto w-full">
          <Link href={href}>{t.seeProperty}</Link>
        </Button>
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
    <li className="flex items-center gap-1.5 text-muted-foreground">
      <span className="shrink-0 text-primary dark:text-accent">{icon}</span>
      {children}
    </li>
  );
}
