import { ImageResponse } from "next/og";

import {
  propertyImageAlt,
  propertyMonthlyCost,
  publicLocationLabel,
  resolvePublicProperty,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "@/features/property";
import {
  BRAND_CYAN,
  BRAND_PURPLE,
  BRAND_PURPLE_SOFT,
  OG_CONTENT_TYPE,
  OG_COP,
  OG_SIZE,
} from "@/shared/brand/og";

/**
 * The card one listing shares with — the photo, the price, and where it is.
 *
 * This is the whole point of the exercise. A listing pasted into a WhatsApp group used to preview
 * the landlord's own headline over whatever the first photo happened to be, cropped by the client
 * to 1.91:1 — so a portrait shot of a kitchen previewed as a cupboard, and the two things anybody
 * decides on, the price and the neighbourhood, were nowhere on the card. Every listing now shares
 * as the same fixed 1200×630: photo on the left, facts on a brand panel on the right.
 *
 * **The address is not on it**, for the same reason it is not in the JSON-LD and not in the map: a
 * card is forwarded further than a page is ever visited. Neighbourhood and city, which the listing
 * already publishes in words, and nothing finer.
 *
 * Two failure modes, both handled rather than left to chance, because this route is fetched by a
 * crawler that will not come back and ask again:
 *
 * - **The slug does not resolve.** A deleted or rented listing still gets a card — the branded one,
 *   with no facts — instead of a 500 that leaves the link previewing as broken.
 * - **The photo cannot be fetched**, or the listing has none. Cloud Storage being slow, a file
 *   removed, a URL that has rotated: the card becomes a different composition — the fact sheet
 *   across the full width, set larger — rather than the same one with half of it blank, which
 *   reads as an image that failed to load. What is lost is the picture; the price and the city,
 *   which are what actually sell it, still arrive.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Inmueble en arriendo en miarriendoDIRECTO.com";

/**
 * An hour, and the number is a trade with a wrong answer on both sides.
 *
 * This route is generated on the first request for a slug and then cached, which is right — the
 * card costs a Firestore read, an image fetch and a PNG encode, and it is fetched again by every
 * client that sees the link shared. What it is not is immutable: a landlord can lower the rent,
 * and the price is the largest thing on the card.
 *
 * Revalidating on the write instead would be exact, and it is not available: the path Next serves
 * this at carries a build hash (`opengraph-image-<hash>/card`) that `updateProperty` cannot
 * construct. So it is time-based, stale-while-revalidate — nobody ever waits for the regeneration,
 * and the worst case is an hour of an old price on a card whose page is already correct.
 */
export const revalidate = 3600;

/** Long enough for Cloud Storage on a bad day, short enough that a crawler does not give up. */
const PHOTO_TIMEOUT_MS = 4_000;

/** Beyond this, embedding costs more memory than the card is worth. Landlords upload from a phone. */
const PHOTO_MAX_BYTES = 5_000_000;

/**
 * The cover photo as a data URI, or `null`.
 *
 * Fetched here rather than handed to satori as a remote `<img src>` so that a failure is a value
 * this code can see. Left to the renderer, a photo that 404s throws from inside the layout pass and
 * takes the whole card with it — turning a missing picture into a missing preview.
 */
async function coverImage(property: Property): Promise<string | null> {
  const photo = property.photos[0];
  if (!photo) return null;

  try {
    const response = await fetch(photo.url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > PHOTO_MAX_BYTES) return null;

    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.error(`opengraph-image: could not read the cover of ${property.id}:`, error);

    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Un rastreador no trae sesión, así que solo ve lo que ve todo el mundo.
  const found = await resolvePublicProperty(slug, null);

  if (!found) return brandOnly();

  const { property } = found;
  const cover = await coverImage(property);
  const facts = [
    property.bedrooms === 0
      ? "Apartaestudio"
      : `${property.bedrooms} ${property.bedrooms === 1 ? "habitación" : "habitaciones"}`,
    `${property.bathrooms} ${property.bathrooms === 1 ? "baño" : "baños"}`,
    `${property.areaM2} m²`,
  ];

  /*
   * **Sin foto la tarjeta no es la misma con un hueco: es otra composición.**
   *
   * Reservar la columna de la izquierda y dejarla vacía daba media tarjeta de morado liso con toda
   * la información apretada contra el borde derecho, que se lee como una imagen que no cargó. Sin
   * foto, la ficha ocupa el ancho entero y respira — y un anuncio sin fotos es raro pero existe:
   * `PHOTOS_MIN` es 1 al publicar, no en lo ya publicado.
   */
  const panelWidth = cover ? 520 : 1200;

  return new ImageResponse(
    (
      <div style={{ display: "flex", height: "100%", width: "100%", backgroundColor: BRAND_PURPLE }}>
        {/* La foto ocupa la mayor parte: es lo que hace que alguien mire la tarjeta. */}
        {cover ? (
          <img
            src={cover}
            alt=""
            width={680}
            height={630}
            style={{ width: 680, height: 630, objectFit: "cover" }}
          />
        ) : null}

        {/* Y la ficha, en el panel de marca: precio, dónde y cuánto mide. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: panelWidth,
            height: "100%",
            padding: cover ? 48 : 72,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", height: 6, width: 72, backgroundColor: BRAND_CYAN }} />
            <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: BRAND_PURPLE_SOFT }}>
              {PROPERTY_TYPE_LABELS[property.type]} en arriendo
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: cover ? 60 : 92,
                color: BRAND_CYAN,
                letterSpacing: -1,
              }}
            >
              {OG_COP.format(propertyMonthlyCost(property))}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: BRAND_PURPLE_SOFT }}>al mes</div>

            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: cover ? 30 : 44,
                color: "#FFFFFF",
                lineHeight: 1.2,
              }}
            >
              {publicLocationLabel(property.area)}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 20,
                flexWrap: "wrap",
                fontSize: 24,
                color: BRAND_PURPLE_SOFT,
              }}
            >
              {facts.join("  ·  ")}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 26, color: "#FFFFFF" }}>
            <span style={{ color: BRAND_CYAN }}>miarriendo</span>
            <span>DIRECTO.com</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

/** What a link previews as when the listing behind it is gone: the brand, never an error. */
function brandOnly() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          backgroundColor: BRAND_PURPLE,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", height: 8, width: 96, backgroundColor: BRAND_CYAN }} />
        <div style={{ display: "flex", marginTop: 40, fontSize: 56, color: "#FFFFFF" }}>
          Este anuncio ya no está disponible
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: BRAND_PURPLE_SOFT }}>
          Mira los inmuebles que sí lo están en miarriendoDIRECTO.com
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/**
 * The alt text, which is a different question from the card.
 *
 * Next lets this be a function so it can name the listing rather than the site. It reads the
 * property again, and that read is cached per request — the same `resolvePublicProperty` the image
 * above just called.
 */
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await resolvePublicProperty(slug, null);

  return [
    {
      id: "card",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
      alt: found ? propertyImageAlt(found.property) : alt,
    },
  ];
}
