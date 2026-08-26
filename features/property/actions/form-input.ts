import "server-only";

import { adminDb } from "@/shared/firebase/admin";

import type { PropertyFormIntent } from "../validations/property";

/**
 * Claims a slug for a property, and hands back the one that was actually free.
 *
 * `propertySlugs/{slug}` is the reservation: the document id *is* the slug, so uniqueness is
 * document existence and resolving a URL later is a single `get` instead of a query. `create()`
 * fails when the document is already there, which makes each attempt atomic — two landlords
 * publishing "Apartamento en Palermo, Manizales" at the same second cannot both win.
 *
 * Collisions get a counter, because "-2" still reads like a place and a random suffix does not.
 * After a few attempts it falls back to the property id, which cannot collide.
 *
 * Whoever builds "delete a listing" or "edit the title" owes this collection a write: an
 * abandoned reservation keeps a URL taken forever, and a renamed property that keeps its old
 * reservation would answer on a slug that no longer describes it.
 */
export async function reserveSlug(base: string, propertyId: string): Promise<string> {
  const slugs = adminDb().collection("propertySlugs");
  const candidates = [base, ...[2, 3, 4, 5, 6].map((n) => `${base}-${n}`)];

  for (const candidate of candidates) {
    try {
      await slugs.doc(candidate).create({ propertyId });
      return candidate;
    } catch {
      // taken: try the next one
    }
  }

  const unique = `${base}-${propertyId.slice(0, 6).toLowerCase()}`;
  await slugs.doc(unique).create({ propertyId });
  return unique;
}

/**
 * The map point, or `undefined` — never a half-filled pair.
 *
 * The two fields travel separately through a `FormData` and the schema treats the point as one
 * optional object, so "one of them is missing" has to become "there is no point" here. Coercing
 * a lone latitude would put the property on the Greenwich meridian, off the coast of Africa,
 * which the bounds check would then reject with a message about a map the landlord never used.
 */
function mapPointFrom(formData: FormData): { lat: string; lng: string } | undefined {
  const lat = formData.get("address.lat");
  const lng = formData.get("address.lng");

  return typeof lat === "string" && lat !== "" && typeof lng === "string" && lng !== ""
    ? { lat, lng }
    : undefined;
}

/**
 * Which of the two buttons the landlord pressed: "Publicar inmueble" or "Guardar como borrador".
 *
 * It arrives in the `FormData` and is **narrowed here rather than trusted**, and the fallback is
 * the strict side: anything that is not the literal `draft` is a publish, so a malformed or
 * missing intent produces a listing that had to pass the full schema rather than a draft that
 * skipped it. The lax path is the one that has to be asked for by name.
 */
export function propertyFormIntent(formData: FormData): PropertyFormIntent {
  return formData.get("intent") === "draft" ? "draft" : "publish";
}

/**
 * Every file on this listing was uploaded from the browser into **this** landlord's own folder,
 * and nowhere else.
 *
 * It was `photosBelongTo` while photos were the only thing a listing carried. The walkthrough
 * video takes the identical path — `properties/{uid}/…`, uploaded by the browser before the
 * property has an id — so it needs the identical check, and a second function beside this one is
 * how the two come to disagree about what `..` means. The caller hands it everything with a
 * `path`; what it answers is "are all of these yours?".
 */
export function filesBelongTo(uid: string, files: readonly { path: string }[]): boolean {
  const prefix = `properties/${uid}/`;
  return files.every((file) => file.path.startsWith(prefix) && !file.path.includes(".."));
}


/**
 * Pulls the property form out of a `FormData` and into the shape the schema expects.
 *
 * Shared by publishing and editing so the two cannot drift: a field added to the form has one
 * place to be read, and a mismatch between them would surface as a validation error the
 * landlord cannot act on.
 */
export function parsePropertyForm(
  formData: FormData,
): { readonly value: Record<string, unknown> } | { readonly error: string } {
  const photosRaw = formData.get("photos");
  let photos: unknown = [];
  try {
    photos = typeof photosRaw === "string" ? JSON.parse(photosRaw) : [];
  } catch {
    return { error: "No pudimos leer las fotos. Vuelve a subirlas." };
  }

  /*
   * The video travels as JSON in one field, like the photos, and an empty field means "there is
   * none" rather than an error: it is the ordinary case for every listing that has no walkthrough.
   *
   * It is `undefined` and never `null` when absent, because the schema declares it `.optional()`
   * — a `null` there would fail validation with "Ese formato de video no es válido" on a listing
   * whose author never touched the control, which is the shape of error nobody can act on.
   */
  const videoRaw = formData.get("video");
  let video: unknown = undefined;
  if (typeof videoRaw === "string" && videoRaw !== "") {
    try {
      video = JSON.parse(videoRaw);
    } catch {
      return { error: "No pudimos leer el video. Vuelve a subirlo." };
    }
  }

  return {
    value: {
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type"),
      rent: formData.get("rent"),
      adminFee: formData.get("adminFee") || "0",
      areaM2: formData.get("areaM2"),
      bedrooms: formData.get("bedrooms"),
      bathrooms: formData.get("bathrooms"),
      parking: formData.get("parking"),
      stratum: formData.get("stratum"),
      furnished: formData.get("furnished") === "true",
      petsAllowed: formData.get("petsAllowed") === "true",
      minLeaseMonths: formData.get("minLeaseMonths"),
      availableFrom: formData.get("availableFrom"),
      address: {
        registryNumber: formData.get("address.registryNumber"),
        point: mapPointFrom(formData),
        line: formData.get("address.line"),
        neighborhood: formData.get("address.neighborhood"),
        city: formData.get("address.city"),
        department: formData.get("address.department"),
      },
      photos,
      // Omitted rather than set to `undefined`, so `'video' in value` is false for a listing
      // without one. Zod treats the two the same; Firestore's `update` does not.
      ...(video === undefined ? {} : { video }),
    },
  };
}
