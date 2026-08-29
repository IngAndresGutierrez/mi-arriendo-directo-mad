"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { MY_PROPERTIES_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { getOwnedProperty, getPropertyLocation } from "../data/property";
import { approximateLocation, propertySlug, publishBlocker } from "../domain/property";
import { sameRegistry } from "../domain/verification";
import { propertyFormSchema, validateAvailableFrom } from "../validations/property";
import { filesBelongTo, parsePropertyForm, propertyFormIntent, reserveSlug } from "./form-input";

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
 *
 * **The status only ever moves forwards here, from `draft` to `available`.** Editing a draft and
 * pressing "Publicar inmueble" is how most drafts go live — the landlord is on that screen
 * because they have just added the photographs — so the promotion belongs on the same submit
 * rather than behind a second trip to the list. The other three directions are not this
 * action's: an `available` listing posted with a `draft` intent keeps its status, because
 * *unpublishing* is a decision about a listing strangers may already have applied to, and
 * silently taking it off the catalogue as a side effect of a spelling fix is not the shape that
 * decision should have.
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

  const intent = propertyFormIntent(formData);
  const input = parsePropertyForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  const parsed = propertyFormSchema(intent).safeParse(input.value);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const availability = validateAvailableFrom(parsed.data.availableFrom, new Date());
  if (!availability.ok) {
    return { ok: false, fieldErrors: { availableFrom: [availability.error] } };
  }

  // Photos and the walkthrough video in one call: see the note in `publishProperty`.
  const uploads = parsed.data.video ? [...parsed.data.photos, parsed.data.video] : parsed.data.photos;
  if (!filesBelongTo(user.uid, uploads)) {
    return { ok: false, message: "Los archivos no corresponden a tu cuenta. Vuelve a subirlos." };
  }

  const { address, video, ...listing } = parsed.data;
  const approx = address.point ? approximateLocation(address.point) : null;
  const base = propertySlug(listing.title, address.city);
  // Only pay for a new reservation when the slug would actually change.
  const slug = base === current.slug || current.slug.startsWith(`${base}-`)
    ? current.slug
    : await reserveSlug(base, propertyId);

  /*
   * Draft + "Publicar inmueble" is the promotion; everything else keeps what the document has.
   * Read from `current` rather than from the form: `status` is not a field of this form and a
   * client that posted one would be choosing its own — `rented` and `inactive` included.
   */
  const status = current.status === "draft" && intent === "publish" ? "available" : current.status;

  const propertyRef = adminDb().collection("properties").doc(propertyId);

  /*
   * **Cambiar la matrícula tumba la insignia de propietario verificado, sola.**
   *
   * Una aprobación dice que esta cuenta figura como propietaria del inmueble detrás de *ese* número
   * de matrícula; cambiado el número, la frase habla de otro inmueble. Es la misma atadura que el
   * `documentHash` de la firma y la huella del acta, y tiene la misma propiedad: no hay nada que
   * limpiar a mano, porque la comparación *es* el estado — `verificationState` devuelve `stale` en
   * cuanto los dos números dejan de coincidir, y esto solo retira el campo público que el catálogo
   * lee sin poder comparar nada.
   *
   * Suelta a propósito (`sameRegistry`): `050-123456` y `50 123456` son el mismo inmueble, y perder
   * la insignia por un guion al reescribir la dirección sería absurdo.
   */
  const previous = await getPropertyLocation(propertyId, user.uid);
  const registryChanged = !sameRegistry(previous?.registryNumber ?? "", address.registryNumber);

  const batch = adminDb().batch();
  batch.update(propertyRef, {
    ...listing,
    slug,
    status,
    ...(registryChanged ? { ownershipVerifiedAt: FieldValue.delete() } : {}),
    /*
     * `FieldValue.delete()` and not an omission, which is the whole difference between an
     * `update` and a `set`: leaving the key out of an `update` **keeps** what is stored, so a
     * landlord who removed the walkthrough would save the form and find the video still playing
     * on the public page. The same trap `area` avoids by being replaced whole one line down, and
     * the same call `updateProfile` makes for a `gender` the person cleared.
     */
    ...(video ? { video } : { video: FieldValue.delete() }),
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

  /*
   * Files the landlord removed are dropped from Storage: an orphan is invisible and billed for
   * ever. The video goes through the same sweep, and it is the one that makes the sweep matter —
   * an abandoned photo is 3 MB and an abandoned walkthrough is up to 50, on a bucket that also
   * serves every visitor. Replacing a video is a removal too: the old path is not in the new
   * list, so it is collected without a special case.
   */
  await removeUnusedFiles(
    [...current.photos.map((photo) => photo.path), ...(current.video ? [current.video.path] : [])],
    [...parsed.data.photos.map((photo) => photo.path), ...(video ? [video.path] : [])],
  );

  revalidatePath(MY_PROPERTIES_ROUTE);
  revalidatePath(propertyDetailRoute(slug));
  return { ok: true, slug };
}

/**
 * Puts a draft on the catalogue, without going back through the form.
 *
 * The form's own "Publicar inmueble" already does this on the way past, and this is the other
 * door: a landlord who opens the list and sees the photographs have arrived has nothing left to
 * edit, so making them enter a nine-section form and press submit to change one word from
 * `draft` to `available` would be ceremony.
 *
 * **`publishBlocker` is the gate, and it is the same function the card asks before offering the
 * button.** One copy of "when may this be published?", read by the screen and by the endpoint —
 * the rule `availableActions` already sets for the errands, because a control the server would
 * refuse is a lie and two copies of a rule are two things that drift.
 *
 * The date is the one thing the blocker cannot answer for, and it is exactly the case this
 * feature creates: a draft is a listing that *waits*, so `availableFrom` goes stale by sitting
 * still. It is re-checked against the server's clock here and the refusal names the field,
 * because the edit form is the only place it can be fixed.
 */
export async function publishDraft(propertyId: string): Promise<ManagePropertyResult> {
  const user = await requireCompleteProfile();

  const property = await getOwnedProperty(propertyId, user.uid);
  if (!property) {
    return { ok: false, message: "Este inmueble no existe o no es tuyo." };
  }

  const blocker = publishBlocker(property);
  if (blocker === "not_draft") {
    return { ok: false, message: "Este inmueble ya está publicado." };
  }
  if (blocker === "no_photos") {
    return { ok: false, message: "Súbele al menos una foto antes de publicarlo." };
  }

  const availability = validateAvailableFrom(property.availableFrom, new Date());
  if (!availability.ok) {
    return {
      ok: false,
      message: "La fecha de disponibilidad ya pasó. Edítala y vuelve a publicar.",
    };
  }

  await adminDb().collection("properties").doc(propertyId).update({
    status: "available",
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath(MY_PROPERTIES_ROUTE);
  revalidatePath(propertyDetailRoute(property.slug));
  return { ok: true, slug: property.slug };
}

/**
 * Deletes a listing and everything that hangs off it.
 *
 * Four things, and forgetting any of them leaves rubbish behind: the private address, the slug
 * reservation (an abandoned one keeps that URL taken forever), the photos **and the walkthrough
 * video** in Storage, and the document itself — deleted last, so a failure halfway still leaves
 * something to retry with.
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

  await removeUnusedFiles(
    [...property.photos.map((photo) => photo.path), ...(property.video ? [property.video.path] : [])],
    [],
  );
  await propertyRef.delete();

  revalidatePath(MY_PROPERTIES_ROUTE);
  return { ok: true, slug: property.slug };
}

/** Deletes the stored files that are no longer referenced. Never throws: cleanup is best effort. */
async function removeUnusedFiles(before: readonly string[], after: readonly string[]) {
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
