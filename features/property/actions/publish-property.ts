"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { adminAuth, adminDb } from "@/shared/firebase/admin";

import { approximateLocation, propertySlug } from "../domain/property";
import { propertyFormSchema, validateAvailableFrom } from "../validations/property";
import { filesBelongTo, parsePropertyForm, propertyFormIntent, reserveSlug } from "./form-input";

export type PublishPropertyResult =
  | {
      readonly ok: true;
      readonly id: string;
      readonly slug: string;
      readonly rolePromoted: boolean;
      /** `true` when this saved a draft: the caller says so instead of guessing from the URL. */
      readonly isDraft: boolean;
    }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Publishes a property — or saves it as a draft, which is the same act minus the photos.
 *
 * A Server Action is a public endpoint, so the order is invariable: authenticate → validate
 * with Zod → authorize against the real data → business invariants → write.
 *
 * Three things this action decides, and they are product decisions rather than plumbing:
 *
 * 1. **The street address is written apart**, into `properties/{id}/private/location`. The
 *    catalog document is world-readable and Security Rules cannot hide a field. The map point
 *    goes with it, for the same reason and one more: a coordinate to five decimals *is* the
 *    address, so publishing it would undo the split. What the public document gets is
 *    `approximateLocation()` of it — a cell of about 550 m, which is the neighbourhood the
 *    listing already names in words.
 * 2. **Publishing makes you a landlord.** Every account starts as `tenant`; in a peer-to-peer
 *    marketplace nobody applies to become a landlord, they become one by publishing. The claim
 *    is promoted here, and the caller must re-mint its session cookie afterwards — the cookie
 *    was signed before the claim existed. **A draft promotes it too**: what makes somebody a
 *    landlord is owning a property on this platform, and a draft is one — it has an address, a
 *    canon and a matrícula, it can be given an errand, and treating its author as a tenant until
 *    the photographs arrive would be deciding they are not a landlord because they do not own a
 *    camera.
 * 3. **The same action saves a draft**, chosen by the form's `intent` and nothing else. One
 *    create path means one slug reservation, one private-location write and one role promotion;
 *    a second action beside it is where "publishing writes the address apart and drafting forgot
 *    to" comes from. What the intent changes is exactly two things: which schema validates
 *    (`propertyFormSchema` — the draft one is the publish one minus the photos) and the `status`
 *    that lands on the document.
 */
export async function publishProperty(formData: FormData): Promise<PublishPropertyResult> {
  const user = await requireCompleteProfile();

  const intent = propertyFormIntent(formData);
  const input = parsePropertyForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  const parsed = propertyFormSchema(intent).safeParse(input.value);

  if (!parsed.success) {
    // Never return Zod's raw error: it carries the submitted values back to the client.
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // The availability date is checked against the server clock, not the browser's.
  const availability = validateAvailableFrom(parsed.data.availableFrom, new Date());
  if (!availability.ok) {
    return { ok: false, fieldErrors: { availableFrom: [availability.error] } };
  }

  /*
   * The video is checked in the **same** call as the photos, not in one of its own: what is being
   * authorized is "every file this listing points at is inside your folder", and two calls is two
   * places for the next kind of file to be forgotten.
   */
  const uploads = parsed.data.video ? [...parsed.data.photos, parsed.data.video] : parsed.data.photos;
  if (!filesBelongTo(user.uid, uploads)) {
    return { ok: false, message: "Los archivos no corresponden a tu cuenta. Vuelve a subirlos." };
  }

  const { address, video, ...listing } = parsed.data;
  const propertyRef = adminDb().collection("properties").doc();
  const approx = address.point ? approximateLocation(address.point) : null;

  const slug = await reserveSlug(propertySlug(listing.title, address.city), propertyRef.id);

  const batch = adminDb().batch();
  batch.set(propertyRef, {
    ...listing,
    landlordUid: user.uid,
    status: "available",
    slug,
    // Absent rather than null when the landlord recorded none — the same choice `approx` makes
    // one line down, and for the same reason: `validProperty()` in `firestore.rules` checks the
    // key by presence, and a null would have to be spelled out there too.
    ...(video ? { video } : {}),
    area: {
      neighborhood: address.neighborhood,
      city: address.city,
      department: address.department,
      // Absent rather than null when there is no point: `area` is validated key by key in
      // `firestore.rules`, and a null there would have to be spelled out in the rule as well.
      ...(approx ? { approx } : {}),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  // Neither the street nor the exact point enters the public document.
  batch.set(propertyRef.collection("private").doc("location"), {
    line: address.line,
    registryNumber: address.registryNumber,
    ...(address.point ? { point: address.point } : {}),
  });
  await batch.commit();

  const rolePromoted = user.role === "tenant";
  if (rolePromoted) {
    await adminAuth().setCustomUserClaims(user.uid, { role: "landlord" });
  }

  // The landlord lands on the detail, but their list has to include it the moment they go back.
  revalidatePath(MY_PROPERTIES_ROUTE);

  return { ok: true, id: propertyRef.id, slug, rolePromoted, isDraft: intent === "draft" };
}
