"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { adminAuth, adminDb } from "@/shared/firebase/admin";

import { propertySlug } from "../domain/property";
import { publishPropertySchema, validateAvailableFrom } from "../validations/property";
import { parsePropertyForm, photosBelongTo, reserveSlug } from "./form-input";

export type PublishPropertyResult =
  | { readonly ok: true; readonly id: string; readonly slug: string; readonly rolePromoted: boolean }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Publishes a property.
 *
 * A Server Action is a public endpoint, so the order is invariable: authenticate → validate
 * with Zod → authorize against the real data → business invariants → write.
 *
 * Two things this action decides, and they are product decisions rather than plumbing:
 *
 * 1. **The street address is written apart**, into `properties/{id}/private/location`. The
 *    catalog document is world-readable and Security Rules cannot hide a field.
 * 2. **Publishing makes you a landlord.** Every account starts as `tenant`; in a peer-to-peer
 *    marketplace nobody applies to become a landlord, they become one by publishing. The claim
 *    is promoted here, and the caller must re-mint its session cookie afterwards — the cookie
 *    was signed before the claim existed.
 */
export async function publishProperty(formData: FormData): Promise<PublishPropertyResult> {
  const user = await requireCompleteProfile();

  const input = parsePropertyForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  const parsed = publishPropertySchema.safeParse(input.value);

  if (!parsed.success) {
    // Never return Zod's raw error: it carries the submitted values back to the client.
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // The availability date is checked against the server clock, not the browser's.
  const availability = validateAvailableFrom(parsed.data.availableFrom, new Date());
  if (!availability.ok) {
    return { ok: false, fieldErrors: { availableFrom: [availability.error] } };
  }

  if (!photosBelongTo(user.uid, parsed.data.photos)) {
    return { ok: false, message: "Las fotos no corresponden a tu cuenta. Vuelve a subirlas." };
  }

  const { address, ...listing } = parsed.data;
  const propertyRef = adminDb().collection("properties").doc();

  const slug = await reserveSlug(propertySlug(listing.title, address.city), propertyRef.id);

  const batch = adminDb().batch();
  batch.set(propertyRef, {
    ...listing,
    landlordUid: user.uid,
    status: "available",
    slug,
    area: {
      neighborhood: address.neighborhood,
      city: address.city,
      department: address.department,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  // The street never enters the public document.
  batch.set(propertyRef.collection("private").doc("location"), { line: address.line });
  await batch.commit();

  const rolePromoted = user.role === "tenant";
  if (rolePromoted) {
    await adminAuth().setCustomUserClaims(user.uid, { role: "landlord" });
  }

  // The landlord lands on the detail, but their list has to include it the moment they go back.
  revalidatePath(MY_PROPERTIES_ROUTE);

  return { ok: true, id: propertyRef.id, slug, rolePromoted };
}
