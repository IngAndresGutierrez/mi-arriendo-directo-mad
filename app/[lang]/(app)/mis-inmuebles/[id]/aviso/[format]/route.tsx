import { ImageResponse } from "next/og";

import { requireCompleteProfile } from "@/features/profile";
import {
  getOwnedProperty,
  posterBlocker,
  posterContent,
  POSTER_SIZES,
  posterFormatFromSegment,
  propertyLabels,
  RentalPoster,
} from "@/features/property";
import { OG_COP, OG_CONTENT_TYPE } from "@/shared/brand/og";
import { localeFor } from "@/shared/i18n/locale";
import { embedRemoteImage } from "@/shared/lib/embed-image";
import { metadataOrigin } from "@/shared/lib/site-url";

/**
 * The rental notice as a PNG: `/mis-inmuebles/<id>/aviso/pared` and `.../redes`.
 *
 * ## Why it is gated, when everything on it is public
 *
 * Every fact drawn here already sits on a page anybody can read, so this is not a privacy boundary
 * — it is a statement about whose tool this is. A notice is something the person who published the
 * listing hands out, and the screen that offers it lives in the portal beside "Copiar enlace" and
 * "Editar". `getOwnedProperty` answers `null` to a stranger exactly as it does to somebody asking
 * about a listing that does not exist, so the endpoint inherits that indistinguishability for
 * free, and there is no second copy of the ownership question to drift from the page's.
 *
 * ## Why a draft gets a 404 rather than a poster
 *
 * `posterBlocker` is the rule and it is checked here as well as on the screen, because a page
 * guard protects a screen and not an endpoint. A listing that is not `available` has no public
 * page — `getVisibleProperty` answers `null` to everybody but its owner — so its code would open a
 * 404 for every person who scanned it, and its owner could never find that out, because for them
 * the link works.
 *
 * ## Why it is not cached
 *
 * The Open Graph card beside it revalidates hourly, which is right for a route a crawler fetches
 * on behalf of the whole internet. This one is fetched by one signed-in person, twice, while they
 * decide between two formats — and the response depends on who is asking, so a shared cache
 * holding it is a cache serving one landlord's answer to the next request through the same proxy.
 * `private, no-store` states both facts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; format: string; lang: string }> },
): Promise<Response> {
  const { id, format: segment, lang } = await params;

  const format = posterFormatFromSegment(segment);
  if (!format) return new Response("No encontrado", { status: 404 });

  const user = await requireCompleteProfile();
  const property = await getOwnedProperty(id, user.uid);

  if (!property || posterBlocker(property) !== null) {
    return new Response("No encontrado", { status: 404 });
  }

  const locale = localeFor(lang);
  const content = posterContent(property, {
    locale,
    labels: propertyLabels(locale),
    /*
     * **The canonical origin, never the request's**, and this is the sharpest instance of the
     * distinction `shared/lib/site-url.ts` draws. A link in an email has to reach the person
     * reading it now; a link printed on paper and taped to a wall has to work in eight months,
     * from a stranger's phone, long after the deployment that generated it is gone. "Wherever this
     * request came from" is the one answer guaranteed to be wrong there.
     */
    origin: metadataOrigin(),
    money: OG_COP,
  });

  const photo = content.photoUrl
    ? await embedRemoteImage(content.photoUrl, { label: `the cover of ${property.id}` })
    : null;

  return new ImageResponse(<RentalPoster content={content} format={format} photo={photo} />, {
    ...POSTER_SIZES[format],
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": "private, no-store",
    },
  });
}
