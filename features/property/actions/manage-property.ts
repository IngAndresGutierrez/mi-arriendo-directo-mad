"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { MY_PROPERTIES_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getOwnedProperty } from "../data/property";
import { approximateLocation, propertySlug } from "../domain/property";
import { publishPropertySchema, validateAvailableFrom } from "../validations/property";
import { parsePropertyForm, photosBelongTo, reserveSlug } from "./form-input";

export type ManagePropertyResult =
  | { readonly ok: true; readonly slug: string }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Updates a listing the caller owns.
 *
 * Same order as publishing — authenticate → validate → authorize against the real document →
 * write — with one addition: the URL. A landlord who fixes the title expects the link to follow,
 * but a link already shared must not die, so the old slug reservation is kept pointing at the
 * property and the new one is added. Both resolve; the page redirects the old to the new.
 */
export async function updateProperty(
  propertyId: string,
  formData: FormData,
): Promise<ManagePropertyResult> {
  const user = await requireCompleteProfile();

  const current = await getOwnedProperty(propertyId, user.uid);
  if (!current) {
    return { ok: false, message: "Este inmueble no existe o no es tuyo." };
  }

  const input = parsePropertyForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  const parsed = publishPropertySchema.safeParse(input.value);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const availability = validateAvailableFrom(parsed.data.availableFrom, new Date());
  if (!availability.ok) {
    return { ok: false, fieldErrors: { availableFrom: [availability.error] } };
  }

  if (!photosBelongTo(user.uid, parsed.data.photos)) {
    return { ok: false, message: "Las fotos no corresponden a tu cuenta. Vuelve a subirlas." };
  }

  const { address, ...listing } = parsed.data;
  const approx = address.point ? approximateLocation(address.point) : null;
  const base = propertySlug(listing.title, address.city);
  // Only pay for a new reservation when the slug would actually change.
  const slug = base === current.slug || current.slug.startsWith(`${base}-`)
    ? current.slug
    : await reserveSlug(base, propertyId);

  const propertyRef = adminDb().collection("properties").doc(propertyId);
  const batch = adminDb().batch();
  batch.update(propertyRef, {
    ...listing,
    slug,
    /*
     * `area` is replaced whole, which is what makes taking the point off the map work: an
     * `update` with a nested map overwrites the map, so dropping `approx` from the object drops
     * it from the document. Merging would leave the old coordinate published under an address
     * that has moved.
     */
    area: {
      neighborhood: address.neighborhood,
      city: address.city,
      department: address.department,
      ...(approx ? { approx } : {}),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
  // `set`, not `update`: same reason, one level up. A removed point leaves nothing behind.
  batch.set(propertyRef.collection("private").doc("location"), {
    line: address.line,
    registryNumber: address.registryNumber,
    ...(address.point ? { point: address.point } : {}),
  });
  await batch.commit();

  // Photos the landlord removed are dropped from Storage: an orphan file is invisible and
  // billed forever.
  await removeUnusedPhotos(
    current.photos.map((photo) => photo.path),
    parsed.data.photos.map((photo) => photo.path),
  );

  revalidatePath(MY_PROPERTIES_ROUTE);
  revalidatePath(propertyDetailRoute(slug));
  return { ok: true, slug };
}

/**
 * Deletes a listing and everything that hangs off it.
 *
 * Four things, and forgetting any of them leaves rubbish behind: the private address, the slug
 * reservation (an abandoned one keeps that URL taken forever), the photos in Storage, and the
 * document itself — deleted last, so a failure halfway still leaves something to retry with.
 */
export async function deleteProperty(propertyId: string): Promise<ManagePropertyResult> {
  const user = await requireCompleteProfile();

  const property = await getOwnedProperty(propertyId, user.uid);
  if (!property) {
    return { ok: false, message: "Este inmueble no existe o no es tuyo." };
  }

  const propertyRef = adminDb().collection("properties").doc(propertyId);

  for (const document of (await propertyRef.collection("private").get()).docs) {
    await document.ref.delete();
  }

  const reservations = await adminDb()
    .collection("propertySlugs")
    .where("propertyId", "==", propertyId)
    .get();
  for (const reservation of reservations.docs) {
    await reservation.ref.delete();
  }

  await removeUnusedPhotos(property.photos.map((photo) => photo.path), []);
  await propertyRef.delete();

  revalidatePath(MY_PROPERTIES_ROUTE);
  return { ok: true, slug: property.slug };
}

/** Deletes the stored files that are no longer referenced. Never throws: cleanup is best effort. */
async function removeUnusedPhotos(before: readonly string[], after: readonly string[]) {
  const kept = new Set(after);
  await Promise.all(
    before
      .filter((path) => !kept.has(path))
      .map(async (path) => {
        try {
          await adminStorage().bucket().file(path).delete();
        } catch {
          // already gone, or never uploaded: nothing to recover from
        }
      }),
  );
}
