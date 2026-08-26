import { LOCALE_HTML_LANG, type Locale } from "@/shared/i18n/locale";
import { dictionaryFor } from "@/shared/i18n/dictionary";
import type { CatalogFilters } from "./catalog";
import {
  propertyMonthlyCost,
  publicLocationLabel,
  type Property,
} from "./property";

/**
 * What a listing says about itself outside this site.
 *
 * Everything here is **pure and unit-tested**, and it lives in the domain rather than inside the
 * page for one reason: the same sentence has to come out of three places that never see each
 * other — the `<title>`, the Open Graph card a link paste produces, and the JSON-LD a search
 * engine reads. Three copies of "how do we describe a property" is three chances to describe it
 * differently, and the one people notice is the one in the WhatsApp preview.
 *
 * **The street and the exact coordinate are not here, and must never be.** The whole point of
 * `properties/{id}/private/location` is that a precise position *is* the address; a `geo` block in
 * structured data would hand it over through the back door, and even the blunted one would invite
 * a search engine to draw the pin this product deliberately does not draw. Neighbourhood, city and
 * department are what the listing already publishes in words, and they are what goes out.
 */

/** Amounts in the metadata read as a person would say them, not as `1400000`. */
const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Google truncates a title around 60 characters, and this one is a *fragment*: the root layout
 * appends " · miarriendoDIRECTO.com". So the budget is what is left, and the brand is what gets
 * cut if the budget is blown — which is the wrong half to lose.
 */
export const TITLE_MAX = 60;

/** Around where a description stops being shown. Cutting it ourselves beats a machine's "…". */
export const DESCRIPTION_MAX = 160;

/**
 * Trims on a word boundary, never mid-word, and only when it actually has to.
 *
 * A description cut at "apartame…" reads as broken rather than as abbreviated, and it is the one
 * sentence a person sees before deciding whether to open the link.
 */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * The `<title>` of one listing: what it is, where, and what it costs.
 *
 * The price is in the title on purpose. It is the first thing anybody wants to know and the one
 * thing a generic "Apartamento en arriendo" cannot say — and in a results page full of listings it
 * is what makes this one worth clicking instead of the next.
 *
 * The property's own title is *not* used: landlords write "HERMOSO APTO REMODELADO 😍", which is
 * neither specific nor coherent with the rest of the results. What the page's `<h1>` shows is
 * still theirs; what search engines and link previews get is the fact sheet.
 */
export function propertyMetaTitle(property: Property, locale: Locale): string {
  const copy = dictionaryFor(locale).property;
  const what = copy.types[property.type];
  const where = publicLocationLabel(property.area);
  const price = COP.format(propertyMonthlyCost(property));

  /*
   * Una escalera, no un recorte. Lo que sobra se quita entero y en orden de importancia: primero
   * el precio, después el barrio — y la ciudad no se toca nunca, porque "dónde" es la pregunta
   * anterior a "cuánto". Recortar la cadena larga sin más dejaba
   * "Apartamento en arriendo en Ciudadela del Norte La Enea…", que es un título que ya no dice en
   * qué ciudad está el inmueble.
   */
  const withPrice = copy.seoTitle(what, where, price);
  if (withPrice.length <= TITLE_MAX) return withPrice;

  const withoutPrice = copy.seoTitle(what, where, null);
  if (withoutPrice.length <= TITLE_MAX) return withoutPrice;

  return clampText(copy.seoTitle(what, property.area.city, null), TITLE_MAX);
}

/**
 * The sentence under the link, everywhere: the search result, the WhatsApp preview, the card in a
 * Facebook group.
 *
 * Facts in the order somebody asks for them — what, where, how much, how big — and then the one
 * thing that makes this product different, which is that there is no agency in the middle.
 *
 * The landlord's own description is not in here, and that is the decision worth defending: it is
 * theirs, it runs to paragraphs, and the first 160 characters of it are usually a greeting. What a
 * link preview needs is the fact sheet, identical in shape across every listing, so that six
 * results in a WhatsApp group can be compared at a glance. The date is left out for space — it is
 * on the page and in the JSON-LD, where nothing is truncating it.
 */
export function propertyMetaDescription(property: Property, locale: Locale): string {
  const copy = dictionaryFor(locale).property;
  const what = copy.types[property.type];
  const where = publicLocationLabel(property.area);
  const price = COP.format(propertyMonthlyCost(property));
  /* `m²` is a symbol, not a word: it is the same in both languages and stays out of the dictionary. */
  const facts = [
    copy.bedroomsFact(property.bedrooms),
    copy.bathroomsFact(property.bathrooms),
    `${property.areaM2} m²`,
  ].join(" · ");

  return clampText(copy.seoDescription(what, where, price, facts), DESCRIPTION_MAX);
}

/**
 * The alt text of the shared card.
 *
 * An Open Graph image needs one — it is read out where the image cannot be seen, and it is the
 * only description a screen reader gets of a card that is otherwise pure picture.
 */
export function propertyImageAlt(property: Property, locale: Locale): string {
  const copy = dictionaryFor(locale).property;

  return copy.imageAlt(copy.types[property.type], publicLocationLabel(property.area));
}

/**
 * The catalog's `<title>`, which is the city's name when there is one.
 *
 * **`locale` is required and has no default.** A default would be the one thing that must not
 * happen here: a caller that forgot to pass it would render a Spanish `<title>` on an indexed
 * English page, silently — which is precisely the bug this parameter was added to fix, found by
 * reading the head of `/en/inmuebles` rather than by any check in the bar.
 */
export function catalogMetaTitle(filters: Pick<CatalogFilters, "city">, locale: Locale): string {
  return dictionaryFor(locale).propertySeo.catalogTitle(filters.city);
}

/**
 * And its sentence, which says the same thing whether or not a city narrowed it.
 *
 * The clamp stays on this side of the dictionary: `DESCRIPTION_MAX` is a fact about what a search
 * result shows, not about Spanish, and English prose of the same meaning is a different length.
 */
export function catalogMetaDescription(
  filters: Pick<CatalogFilters, "city">,
  locale: Locale,
): string {
  return clampText(dictionaryFor(locale).propertySeo.catalogDescription(filters.city), DESCRIPTION_MAX);
}

/**
 * A JSON-LD document, as a plain object.
 *
 * Typed loosely on purpose — schema.org is an open vocabulary and pinning it to an interface here
 * would mean maintaining a copy of it. What it is *not* is `any`: the value is a JSON tree, and
 * saying so is what stops a `Timestamp` or a function from being handed to `JSON.stringify`.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonLd = { readonly [key: string]: JsonValue };

/**
 * One listing, for a machine.
 *
 * `RealEstateListing` describes *the page*; what the page is about is an `Accommodation`, which is
 * where the rooms and the floor size belong. Splitting them is not pedantry: an `Offer` hung
 * straight off the listing says "this web page costs $1.400.000", which is what a price mismatch
 * warning in Search Console looks like six months later.
 *
 * Three deliberate omissions:
 *
 * - **No `geo` and no `streetAddress`.** See the note at the top of this file: that is the whole
 *   privacy design of this product, and structured data is the easiest place to leak it by
 *   accident — nobody looks at a `<script>` tag when reviewing a page.
 * - **No `priceValidUntil` or `availabilityEnds`.** The listing has no expiry; inventing one so a
 *   validator stops warning would be publishing a date the product does not know.
 * - **No `aggregateRating` or `review`.** There are none. Marking up ratings that do not exist is
 *   the one structured-data mistake that gets a site a manual action.
 */
export function propertyJsonLd(property: Property, url: string, locale: Locale): JsonLd {
  const monthly = propertyMonthlyCost(property);

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: propertyMetaTitle(property, locale),
    description: propertyMetaDescription(property, locale),
    datePosted: property.createdAt,
    /* Same rule as the catalogue's block: claiming Spanish on an English page is a checkable lie. */
    inLanguage: LOCALE_HTML_LANG[locale],
    ...(property.photos.length > 0
      ? { image: property.photos.map((photo) => photo.url) as JsonValue }
      : {}),
    about: {
      "@type": accommodationType(property),
      name: property.title,
      numberOfRooms: property.bedrooms,
      numberOfBathroomsTotal: property.bathrooms,
      floorSize: { "@type": "QuantitativeValue", value: property.areaM2, unitCode: "MTK" },
      // La dirección pública: barrio, ciudad y departamento. La calle vive en `private/location`.
      address: {
        "@type": "PostalAddress",
        addressLocality: property.area.city,
        addressRegion: property.area.department,
        addressCountry: "CO",
      },
      petsAllowed: property.petsAllowed,
    },
    /*
     * `MTK` es metro cuadrado y `MON` es mes, en el código de unidades UN/CEFACT que es el que
     * schema.org espera. Escribir "m2" o "month" ahí es la forma silenciosa de que el canon mensual
     * se lea como el precio total del inmueble.
     */
    offers: {
      "@type": "Offer",
      price: monthly,
      priceCurrency: "COP",
      availability: "https://schema.org/InStock",
      availabilityStarts: property.availableFrom,
      // Arrendar, no vender: sin esto la oferta se lee como el precio de compra del inmueble.
      businessFunction: "https://schema.org/LeaseOut",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: monthly,
        priceCurrency: "COP",
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
    },
  };
}

/** The schema.org type closest to what was published. `Accommodation` is the honest fallback. */
function accommodationType(property: Property): string {
  switch (property.type) {
    case "apartment":
      return "Apartment";
    case "studio":
      return "Apartment";
    case "house":
      return "House";
    case "retail":
    case "office":
      return "Accommodation";
  }
}

/**
 * The trail above a listing, for a machine — the same two links the page itself offers.
 *
 * A breadcrumb that names a page the reader cannot reach from here is a breadcrumb Google drops,
 * so this mirrors exactly what is on screen: back to the catalog, and across to the city.
 */
export function propertyBreadcrumbJsonLd(
  property: Property,
  origin: string,
  catalogPath: string,
  detailPath: string,
): JsonLd {
  const items: JsonValue[] = [
    { "@type": "ListItem", position: 1, name: "Inmuebles", item: `${origin}${catalogPath}` },
    {
      "@type": "ListItem",
      position: 2,
      name: property.area.city,
      item: `${origin}${catalogPath}?city=${encodeURIComponent(property.area.city)}`,
    },
    { "@type": "ListItem", position: 3, name: property.title, item: `${origin}${detailPath}` },
  ];

  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

/**
 * The catalog page, for a machine: what this list is, and what is on it.
 *
 * Only the items **on the page being rendered** go in, and their position counts from where the
 * page starts. An `ItemList` claiming positions 1..6 on page four would be telling a search engine
 * that four different URLs are all the first six results.
 */
export function catalogJsonLd(
  properties: readonly Property[],
  filters: Pick<CatalogFilters, "city" | "page">,
  origin: string,
  canonicalPath: string,
  detailPath: (slug: string) => string,
  pageSize: number,
  locale: Locale,
): JsonLd {
  const start = (Math.max(1, filters.page) - 1) * pageSize;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: catalogMetaTitle(filters, locale),
    description: catalogMetaDescription(filters, locale),
    url: `${origin}${canonicalPath}`,
    /*
     * `inLanguage` has to move with the page. Hard-coded to `es-CO` it told a search engine that the
     * English catalogue was written in Spanish, which is a claim it can check against the text and
     * is the sort of contradiction that gets the whole block distrusted.
     */
    inLanguage: LOCALE_HTML_LANG[locale],
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: properties.length,
      itemListElement: properties.map((property, index) => ({
        "@type": "ListItem",
        position: start + index + 1,
        url: `${origin}${detailPath(property.slug)}`,
        name: propertyMetaTitle(property, locale),
      })) as JsonValue,
    },
  };
}
