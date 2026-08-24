import { ImageResponse } from "next/og";

import { BRAND_CYAN, BRAND_PURPLE, BRAND_PURPLE_SOFT, OG_CONTENT_TYPE, OG_SIZE } from "@/shared/brand/og";

/**
 * The card every public page shares with, except a listing — which brings its own.
 *
 * A file at the root of `app/` is inherited by every route under it, so this one covers `/`, the
 * catalog and `/soporte` in one place. Before it, a link to the catalog pasted into WhatsApp
 * previewed as a bare grey rectangle with a URL under it, which reads like a link nobody should
 * click. The pages behind a session inherit it too and it costs nothing: they are `noindex` and
 * nobody shares them.
 *
 * It is drawn rather than stored as a PNG in `public/` for one reason: the purple wordmark on a
 * purple panel is the trap this project already paid for once, and a generated card can put the
 * cyan rule and the reversed lockup in the same file as the rule that says why.
 *
 * No `<img>` and no font file: satori has a default face, and every colour here is a constant in
 * `shared/brand/og.ts`. That keeps the route with no I/O at all, so it cannot fail slowly.
 */
export const alt = "miarriendoDIRECTO.com — arrienda sin intermediarios";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BRAND_PURPLE,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 8, width: 96, backgroundColor: BRAND_CYAN }} />
          <div
            style={{
              display: "flex",
              marginTop: 48,
              fontSize: 76,
              lineHeight: 1.1,
              color: "#FFFFFF",
              letterSpacing: -2,
            }}
          >
            Arrienda sin intermediarios
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 34,
              color: BRAND_PURPLE_SOFT,
              maxWidth: 900,
            }}
          >
            Apartamentos, casas y apartaestudios en Colombia, directamente con el propietario.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", fontSize: 32, color: "#FFFFFF" }}>
          <span style={{ color: BRAND_CYAN }}>miarriendo</span>
          <span>DIRECTO.com</span>
        </div>
      </div>
    ),
    size,
  );
}
