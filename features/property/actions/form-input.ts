import "server-only";

import { adminDb } from "@/shared/firebase/admin";

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

/** Photos are uploaded from the browser into the landlord's own folder, and nowhere else. */
export function photosBelongTo(uid: string, photos: readonly { path: string }[]): boolean {
  const prefix = `properties/${uid}/`;
  return photos.every((photo) => photo.path.startsWith(prefix) && !photo.path.includes(".."));
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
    },
  };
}
