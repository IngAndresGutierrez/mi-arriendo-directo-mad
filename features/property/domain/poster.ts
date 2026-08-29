/**
 * The rental notice: a listing as a sheet of paper and as something you post in a group chat.
 *
 * The product's link already previews well — `domain/seo.ts` builds the Open Graph card that a
 * paste into WhatsApp produces. This is the other half of the same problem: what a landlord hands
 * to somebody who is **not** looking at a link. A page of A4 taped to the doorway of the building,
 * and a square image dropped into an Instagram story. Both carry a QR, and the QR is the whole
 * mechanism — it is what turns a photograph of a wall into the listing, with its photos, its price
 * and the button that starts an application.
 *
 * ## What is deliberately not on it
 *
 * **The street, and any coordinate.** Same rule as the card, the JSON-LD and the map, and here it
 * matters more than anywhere else: a poster is a *file*, and the feature exists so that file gets
 * shared onward. An address printed on it cannot be taken back the way a page can. A poster stuck
 * to the building does not need the address — it is at it — and one posted to Instagram must not
 * carry it.
 *
 * **The landlord's phone number.** The obvious thing to put on a "se arrienda" sign, and the wrong
 * thing here for two separate reasons. It is personal data on a file that circulates with no way
 * to withdraw it, and it routes the tenant around the product: the QR leads to the listing and
 * from there to an application with a validated profile behind it, which is the thing this
 * platform is for. A phone number leads to a WhatsApp conversation with a stranger.
 *
 * **The landlord's own headline.** They write "HERMOSO APTO REMODELADO 😍". `domain/seo.ts`
 * already refuses it for the `<title>` and the reasoning is identical at two metres on a wall:
 * what sells is the price, where it is, and how big it is, in the same shape every time.
 */
import { propertyDetailRoute } from "@/shared/auth/routes";
import { dictionaryFor } from "@/shared/i18n/dictionary";
import { localeHref, type Locale } from "@/shared/i18n/locale";

import type { PropertyLabels } from "./labels";
import { propertyMonthlyCost, publicLocationLabel, type Property } from "./property";

/**
 * The two shapes, and there are two because the link reaches a person in two different ways.
 *
 * `wall` is A4 portrait: printed, taped up, read from across a lobby. The only way from that sheet
 * into the listing is a camera, so it carries a QR code and the code is the point of it.
 *
 * `social` is the square every feed and every status crops to — and **it carries no QR at all**,
 * which is the correction that shaped this whole module. A square posted to a WhatsApp status or an
 * Instagram feed is looked at *on the phone that would have to scan it*, and a phone cannot scan its
 * own screen. The code was a quarter of the composition doing nothing. What travels on social is
 * **text**: `shareText` below, which the share sheet hands to the target app as the caption and
 * which the screen also offers as one button to copy, because that is where a link actually becomes
 * tappable — a caption in a WhatsApp group, a Facebook post, an Instagram story's link sticker.
 *
 * A third — a 9:16 story — was left out: the square already sits inside a story with room to spare,
 * and a third layout is a third thing to keep in step with the other two.
 */
export const POSTER_FORMATS = ["wall", "social"] as const;
export type PosterFormat = (typeof POSTER_FORMATS)[number];

/**
 * The pixel sizes, and the print one is a resolution decision rather than an aspect ratio.
 *
 * 1240×1754 is A4 at **150 dpi**. 300 dpi would be 2480×3508, four times the pixels for an image
 * whose content is flat colour, one photograph and a QR code — none of which gains anything from
 * it, and a QR least of all, since what a scanner needs is contrast and whole modules rather than
 * resolution. 150 dpi is where a laser printer stops showing the difference on a poster read from
 * a metre away, and it is a quarter of the memory to encode.
 */
export const POSTER_SIZES: Readonly<Record<PosterFormat, { readonly width: number; readonly height: number }>> = {
  wall: { width: 1240, height: 1754 },
  social: { width: 1080, height: 1080 },
};

/**
 * How each format is spelled in a URL — in Spanish, like every other segment in this product.
 *
 * The keys stay English because they are code (`role: "tenant"`, `status: "available"`); the
 * segments are Spanish because a person can land on one. It is the same "keys in English, labels
 * in es-CO" split the label records already make, applied to the one place a label is a path.
 */
export const POSTER_FORMAT_SEGMENTS: Readonly<Record<PosterFormat, string>> = {
  wall: "pared",
  social: "redes",
};

/**
 * The format a URL segment names, or `null`.
 *
 * The single entry point for that question, so the route handler has no reason to reach for a cast:
 * a segment comes out of a URL and is therefore `unknown` until this has looked at it, and anything
 * this does not recognise is a 404 rather than a poster of the wrong shape.
 */
export function posterFormatFromSegment(segment: unknown): PosterFormat | null {
  return (
    POSTER_FORMATS.find((format) => POSTER_FORMAT_SEGMENTS[format] === segment) ?? null
  );
}

/**
 * Why this listing cannot have a notice yet, or `null`.
 *
 * **The QR is the whole point, so a poster is only honest while the URL behind it resolves.** Only
 * an `available` listing is public — `getVisibleProperty` answers `null` to everybody but the
 * owner for anything else — so a poster printed from a draft is a sheet of paper whose code opens
 * a 404 for every person who scans it, and the landlord has no way of finding that out, because
 * for *them* the link works. It is the same failure the manage card already avoids by swapping
 * "Copiar enlace" for "Publicar" on a draft, one step further along: there the bad link is in a
 * clipboard, here it is on a wall.
 *
 * The two reasons stay apart because they are acted on differently. A draft is one button away
 * from being publishable; a listing marked rented is finished, and what its owner wants is not a
 * poster.
 */
export function posterBlocker(property: Pick<Property, "status">): "draft" | "unavailable" | null {
  if (property.status === "draft") return "draft";
  if (property.status !== "available") return "unavailable";

  return null;
}

/**
 * The absolute URL the code carries.
 *
 * **`origin` is the canonical one — `metadataOrigin()` — never the request's**, and this is the
 * same distinction `shared/lib/site-url.ts` draws between a canonical tag and a link in an email,
 * pushed to its limit. A link in an email has to reach the person who is reading it now; a link
 * printed on paper has to work in eight months, from a stranger's phone, long after the preview
 * deployment that generated it has been torn down. "Wherever this request came from" is the one
 * answer that is guaranteed wrong there.
 *
 * The locale prefix travels with it: a landlord who generated the notice from the English side of
 * the product gets a code that opens the English listing. Nothing else about the URL is added — no
 * campaign parameter, no tracking tail — because the printed line below the code is meant to be
 * typed by somebody whose camera will not focus, and because a URL with a query string on it reads
 * as untrustworthy in exactly the places these get shared. Same reasoning that keeps the id off
 * the slug.
 */
export function posterQrTarget(origin: string, slug: string, locale: Locale): string {
  return `${origin}${localeHref(locale, propertyDetailRoute(slug))}`;
}

/**
 * The same URL as something a person can read and retype: no scheme, no `www.`
 *
 * It is on the poster because a QR code is not universally usable — an old phone, a cracked
 * camera, a person who does not know what the square is — and a notice whose only route in is a
 * code is a notice that fails silently for them. What it must stay is *the same link*, which is
 * why it is derived from the target rather than composed a second time.
 */
export function posterReadableUrl(target: string): string {
  return target.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/** Everything the drawing needs, already resolved into strings. */
export type PosterContent = {
  readonly headline: string;
  readonly kind: string;
  readonly price: string;
  readonly priceNote: string;
  readonly where: string;
  readonly facts: readonly string[];
  /** The line above the code on the printed sheet. `wall` only: there is no code on the square. */
  readonly scanPrompt: string;
  /** The line above the address on the square. `social` only, for the same reason. */
  readonly linkPrompt: string;
  /**
   * The caption, ready to post: the fact sheet and the link, in the reader's language.
   *
   * This is the **mechanism** of the social format, not a convenience beside it. An image carries
   * no tappable link on any network; a caption does. It is resolved here rather than composed in
   * the browser because it is parameterised copy, and the `poster` namespace has to stay
   * function-free to survive the trip to a Client Component.
   */
  readonly shareText: string;
  readonly brandPrefix: string;
  readonly brandSuffix: string;
  /** Absolute, and what the code encodes. */
  readonly target: string;
  /** The same link, printed for somebody to type. */
  readonly readableUrl: string;
  /** The cover photo's URL, or `null` — which is a different composition, not a hole. */
  readonly photoUrl: string | null;
};

/**
 * What goes on the notice, for one listing in one language.
 *
 * Resolved here rather than inside the drawing so that a unit test can read it. A satori tree is
 * the one kind of component in this repository that no test and no browser driver can inspect —
 * it is laid out into a PNG on the server and what comes back is pixels — so everything that could
 * be *wrong* rather than merely ugly is pulled out into this function, and the component that
 * remains only decides where each string sits.
 *
 * `money` is passed in rather than imported: `Intl.NumberFormat` is expensive to construct and the
 * poster and the Open Graph card want the identical formatter, which already exists as `OG_COP`.
 */
export function posterContent(
  property: Property,
  {
    locale,
    labels,
    origin,
    money,
  }: {
    readonly locale: Locale;
    readonly labels: PropertyLabels;
    readonly origin: string;
    readonly money: Intl.NumberFormat;
  },
): PosterContent {
  const copy = dictionaryFor(locale);
  const target = posterQrTarget(origin, property.slug, locale);

  return {
    headline: copy.poster.headline,
    kind: labels.types[property.type],
    price: money.format(propertyMonthlyCost(property)),
    priceNote: copy.poster.perMonth,
    where: publicLocationLabel(property.area),
    /*
     * A studio is named, not counted. "0 habitaciones" reads as a mistake on a sheet of paper
     * somebody is looking at from four metres away — the same call the Open Graph card makes.
     */
    facts: posterFacts(property, copy, labels),
    scanPrompt: copy.poster.scanPrompt,
    linkPrompt: copy.poster.linkPrompt,
    /*
     * `seoDescription` and **not** `propertyMetaDescription`: the two want the same sentence and
     * only one of them wants it clamped. 160 characters is a fact about what a search result shows,
     * and a caption in a WhatsApp group is not a search result — trimming it there would publish a
     * fact sheet ending in an ellipsis for no reason. Reusing the sentence is the point: what a
     * paste previews as and what the caption above it says are then the same claim.
     */
    shareText: `${copy.property.seoDescription(
      labels.types[property.type],
      publicLocationLabel(property.area),
      money.format(propertyMonthlyCost(property)),
      factsOf(property, copy, labels),
    )}\n\n${target}`,
    brandPrefix: copy.poster.brandPrefix,
    brandSuffix: copy.poster.brandSuffix,
    target,
    readableUrl: posterReadableUrl(target),
    photoUrl: property.photos[0]?.url ?? null,
  };
}

/**
 * The three facts, in the order somebody asks for them.
 *
 * Pulled out because the drawing and the caption both need them, and two lists that could disagree
 * is the poster saying one thing and the post under it saying another.
 *
 * A studio is **named, not counted**: "0 habitaciones" reads as a mistake on a sheet of paper
 * somebody is looking at from four metres away, and as a typo in a caption. The same call the Open
 * Graph card makes.
 */
function posterFacts(
  property: Property,
  copy: ReturnType<typeof dictionaryFor>,
  labels: PropertyLabels,
): readonly string[] {
  return [
    property.bedrooms === 0 ? labels.types.studio : copy.property.bedroomsFact(property.bedrooms),
    copy.property.bathroomsFact(property.bathrooms),
    `${property.areaM2} m²`,
  ];
}

/** The same three, as the one string `seoDescription` takes. */
function factsOf(
  property: Property,
  copy: ReturnType<typeof dictionaryFor>,
  labels: PropertyLabels,
): string {
  return posterFacts(property, copy, labels).join(" · ");
}
