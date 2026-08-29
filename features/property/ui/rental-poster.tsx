/*
 * This file is a satori tree, not a React DOM tree: `next/image` has no meaning inside an
 * `ImageResponse` — there is no browser, no loader and no srcset, and satori understands exactly
 * one image element. The rule is disabled for the file rather than twice inline because every
 * `<img>` here is the same case, and the sibling that already renders one this way is the Open
 * Graph card.
 */
/* eslint-disable @next/next/no-img-element */
import type { ReactElement } from "react";

import { BRAND_CYAN, BRAND_PURPLE, BRAND_PURPLE_SOFT, BRAND_SAND } from "@/shared/brand/og";
import { qrMatrix, qrRenderSize, qrSvgDataUri } from "@/shared/qr/qr";

import { POSTER_SIZES, type PosterContent, type PosterFormat } from "../domain/poster";

/**
 * The rental notice, drawn.
 *
 * **This is a satori tree, not a React DOM component**, and the difference decides how it is
 * written. It is laid out into a PNG on the server by `ImageResponse`: there is no stylesheet, no
 * cascade and no `var(--primary)` to resolve, so the colours are the literals in
 * `shared/brand/og.ts` — the one place in this product where a hex value in a component is
 * correct — and every dimension is a number rather than a token. It is also the one component
 * neither a unit test nor a browser driver can inspect, which is why everything that could be
 * *wrong* rather than merely ugly was pulled into `domain/poster.ts` first.
 *
 * One composition for both formats down to the last band, where they deliberately part company.
 * Headline, photo, price, where, facts: the same five things in the same order, because two layouts
 * would be two places for that order to drift and the printed one is the copy nobody looks at
 * again. What differs is proportion — `LAYOUT` below, as numbers — and the closing band.
 *
 * **The closing band differs because the two formats hand over the link in different ways, which is
 * a difference in kind and not in proportion.** The printed sheet has exactly one route into the
 * listing, a camera, so it carries the code. The square is looked at *on* the phone that would have
 * to scan it, and a phone cannot scan its own screen — so it carries the address, set large enough
 * to read and to retype, and the link that is actually tapped travels beside the image as
 * `content.shareText`. Drawing a code there was a quarter of the square doing nothing.
 */

/**
 * What each format gives to what.
 *
 * The two that matter are `photo` and `qr`, and they pull against each other: A4 has the room for
 * a picture *and* a code big enough to scan from across a lobby, and a square does not. So the
 * square keeps the code — which is the mechanism — and gives up picture height, because somebody
 * scrolling a feed has the listing's own photos one tap away and somebody standing in a doorway
 * does not.
 */
/** The white card the code sits on. Named because the text column's width is measured from it. */
const QR_CARD_PADDING = 14;

const LAYOUT: Readonly<Record<PosterFormat, {
  readonly padding: number;
  readonly photo: number;
  /** The code's target size. `social` draws none, so it is 0 there rather than a number ignored. */
  readonly qr: number;
  readonly headline: number;
  readonly price: number;
  readonly where: number;
  readonly facts: number;
  readonly prompt: number;
  /** The address, on the square. Big enough to read in a feed and to retype. */
  readonly url: number;
  readonly brand: number;
}>> = {
  wall: { padding: 72, photo: 560, qr: 380, headline: 96, price: 104, where: 48, facts: 34, prompt: 30, url: 24, brand: 40 },
  /*
   * The square's photo is 400 and not the 300 it was, because the code used to sit under it. Giving
   * that space to the picture rather than to bigger type is deliberate: in a feed the photograph is
   * what stops the scroll, and everything else is read only after it has.
   *
   * **It is 400 and not 470**, which is what the freed space would have allowed, and the missing 70
   * is the address's second line. A square is a fixed box — unlike A4, which has slack the middle
   * band absorbs — so a footer one line taller than budgeted does not push the sheet down, it falls
   * off the bottom edge, and what falls off first is the wordmark. It was drawn, looked at, and
   * corrected; nothing in the bar can see a band that overflowed a PNG.
   */
  social: { padding: 56, photo: 400, qr: 0, headline: 62, price: 76, where: 36, facts: 27, prompt: 26, url: 26, brand: 32 },
};

export function RentalPoster({
  content,
  format,
  photo,
}: {
  readonly content: PosterContent;
  readonly format: PosterFormat;
  /**
   * The cover already embedded as a data URI, or `null`.
   *
   * A data URI and not the photo's own URL: handed a remote `src`, satori fetches it during the
   * layout pass and a 404 throws from in there, taking the whole poster with it. The route does
   * the fetch so that a missing picture is a value this component can answer to.
   */
  readonly photo: string | null;
}): ReactElement {
  const size = POSTER_SIZES[format];
  const metrics = LAYOUT[format];

  /*
   * The code is drawn at a whole number of pixels per module — `qrRenderSize` snaps down to one —
   * because a QR whose modules are not all the same width is a QR whose modules the rasteriser
   * merged in places. A few pixels of the space allotted, for a code that reads.
   */
  /*
   * Built only for the sheet that draws one. `qrMatrix` is cheap, but computing a code for the
   * square would leave a value sitting there that a later edit could easily start rendering again,
   * and this module's whole point is that the square deliberately has none.
   */
  const matrix = format === "wall" ? qrMatrix(content.target) : null;
  const qrPixels = matrix ? qrRenderSize(matrix, metrics.qr) : 0;

  /*
   * **The text column is measured, not left to `flexGrow`, and that is not a preference.** Satori
   * sizes a flex item from its content, and `flexGrow` only hands out *spare* space — so a sentence
   * wider than the row simply ran off the right edge, silently, and the first two words of "Escanea
   * el código…" were all that survived. A width computed from the numbers that produced the row is
   * what gives yoga something to wrap against.
   */
  const qrCard = matrix ? qrPixels + QR_CARD_PADDING * 2 : 0;
  const textWidth = size.width - metrics.padding * 2.5 - qrCard;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: size.width,
        height: size.height,
        backgroundColor: BRAND_SAND,
      }}
    >
      {/*
        The headline band. "SE ARRIENDA" is the only thing on this poster meant to be read from
        the other side of a street, so it gets the brand panel and the largest type on the sheet —
        and the cyan rule above it is the same mark the Open Graph card opens with, which is what
        makes the two read as one product when a person sees both.
      */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: BRAND_PURPLE,
          padding: `${metrics.padding * 0.6}px ${metrics.padding}px`,
        }}
      >
        <div style={{ display: "flex", height: 8, width: 96, backgroundColor: BRAND_CYAN }} />
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: metrics.headline,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#FFFFFF",
            lineHeight: 1,
          }}
        >
          {content.headline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 10,
            fontSize: metrics.where,
            color: BRAND_PURPLE_SOFT,
          }}
        >
          {content.kind}
        </div>
      </div>

      {/*
        The photograph, cropped to a band rather than shown whole. A landlord's cover is portrait
        as often as it is landscape, and letterboxing one on a poster leaves two grey bars where
        the eye expects the flat — `objectFit: cover` over a fixed height is the same call the
        catalogue card makes. With no photo the band is simply absent: the price and the code move
        up and fill the sheet, which is a poster, where a blank band is a printing fault.
      */}
      {photo ? (
        <img
          src={photo}
          alt=""
          width={size.width}
          height={metrics.photo}
          style={{ width: size.width, height: metrics.photo, objectFit: "cover", flexShrink: 0 }}
        />
      ) : null}

      {/* Price, where, and how big — the three things somebody decides on, in that order. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexShrink: 1,
          justifyContent: "center",
          padding: `${metrics.padding * 0.55}px ${metrics.padding}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              fontSize: metrics.price,
              fontWeight: 700,
              color: BRAND_PURPLE,
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            {content.price}
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 14,
              paddingBottom: 6,
              fontSize: metrics.facts,
              color: "#5B5468",
            }}
          >
            {content.priceNote}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: metrics.where,
            color: BRAND_PURPLE,
            lineHeight: 1.15,
          }}
        >
          {content.where}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: metrics.facts,
            color: "#5B5468",
          }}
        >
          {content.facts.join("   ·   ")}
        </div>
      </div>

      {/*
        The closing band: the one thing that turns "I want this flat" into the listing.

        **Two shapes, because the link travels two different ways**, and this is the only place the
        formats diverge. On paper the route is a camera, so the code is the band; on a square the
        reader is holding the phone that would have to scan it, so the route is the address — read,
        or retyped, or tapped in the caption that goes with the image.
      */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          /*
           * `flexShrink: 0` so that if anything ever overflows, it is not this band. The address and
           * the wordmark are the two things on the square that lead anywhere; the middle band above
           * carries padding it can give back, and this carries none it can lose.
           */
          flexShrink: 0,
          backgroundColor: BRAND_PURPLE,
          padding: `${metrics.padding * 0.5}px ${metrics.padding}px`,
        }}
      >
        {/*
          The code sits on its own white card rather than straight on the purple: a QR needs its
          quiet zone to be white — `qrSvg` draws one into the image itself — and the card is what
          keeps a printed sheet from putting anything against its edge.
        */}
        {matrix ? (
          <div
            style={{
              display: "flex",
              padding: QR_CARD_PADDING,
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
            }}
          >
            <img
              src={qrSvgDataUri(matrix, qrPixels)}
              alt=""
              width={qrPixels}
              height={qrPixels}
              style={{ width: qrPixels, height: qrPixels }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: textWidth,
            marginLeft: matrix ? metrics.padding * 0.5 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: metrics.prompt,
              color: matrix ? "#FFFFFF" : BRAND_PURPLE_SOFT,
              lineHeight: 1.3,
            }}
          >
            {matrix ? content.scanPrompt : content.linkPrompt}
          </div>

          {/*
            `break-all` on the address, and it is the honest trade. A URL is one unbreakable token
            — `miarriendodirecto.com/inmuebles/apartamento-luminoso-con-balcon-manizales` has no
            space in it — so without this it does not wrap, it overflows and the tail is simply
            gone. Broken across two lines it is ugly and still typeable, which is the entire reason
            it is printed: on the sheet for the camera that will not focus, and on the square for
            the reader who saw it in a status with no caption attached.

            It is **the largest thing in this band on the square** and a caption under the code on
            the sheet, which is the same fact stated twice: there, it is the fallback; here, it is
            the way in.
          */}
          <div
            style={{
              display: "flex",
              marginTop: matrix ? 14 : 10,
              fontSize: metrics.url,
              fontWeight: matrix ? 400 : 600,
              color: matrix ? BRAND_PURPLE_SOFT : "#FFFFFF",
              wordBreak: "break-all",
              lineHeight: 1.25,
            }}
          >
            {content.readableUrl}
          </div>

          <div style={{ display: "flex", marginTop: 18, fontSize: metrics.brand }}>
            <span style={{ color: BRAND_CYAN }}>{content.brandPrefix}</span>
            <span style={{ color: "#FFFFFF" }}>{content.brandSuffix}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
