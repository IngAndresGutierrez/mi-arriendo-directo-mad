/**
 * The brand, as literal values, for the one place that cannot read a CSS variable.
 *
 * Everywhere else in this product a colour is a semantic token in `app/globals.css` and writing a
 * hex value in a component is a mistake. An Open Graph card is the exception, and not by choice:
 * it is rendered by satori, which lays out inline styles into a PNG with no stylesheet, no
 * cascade and no `var(--primary)` to resolve. So the values live here, once, named after the
 * tokens they mirror — rather than typed again into each card, which is how the shared image and
 * the site would end up two different purples.
 *
 * If a token in `globals.css` changes, this file changes with it. There is no way to make the two
 * derive from one source without shipping a CSS parser into an image route.
 */

/** `--primary` — deep purple. Headings, structure, the panel of the card. */
export const BRAND_PURPLE = "#2D124D";

/** `--accent` — electric cyan. The one thing on the card that is allowed to shout. */
export const BRAND_CYAN = "#00E5FF";

/** `--background` — the off-white the site sits on. */
export const BRAND_SAND = "#F8F9FA";

/** A purple light enough to read a caption on, over the panel. */
export const BRAND_PURPLE_SOFT = "#B9A6CC";

/**
 * 1200×630 — the size Facebook, WhatsApp and X all crop to 1.91:1.
 *
 * It is fixed rather than "whatever the photo was" for exactly that reason: a portrait photo of a
 * kitchen previews as a centre crop of a cupboard, and the price and the city — the two things a
 * person decides on — are not in the picture at all.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/** Amounts on a card read as a person would say them. Same formatter as the metadata. */
export const OG_COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
