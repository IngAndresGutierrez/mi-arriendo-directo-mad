"use server";

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { adminAuth, adminDb } from "@/shared/firebase/admin";

import { propertySlug } from "../domain/property";
import { publishPropertySchema, validateAvailableFrom } from "../validations/property";

export type PublishPropertyResult =
  | { readonly ok: true; readonly id: string; readonly slug: string; readonly rolePromoted: boolean }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/** Photos are uploaded from the browser into the landlord's own folder, and nowhere else. */
function photosBelongTo(uid: string, photos: readonly { path: string }[]): boolean {
  const prefix = `properties/${uid}/`;
  return photos.every((photo) => photo.path.startsWith(prefix) && !photo.path.includes(".."));
}

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

  const photosRaw = formData.get("photos");
  let photos: unknown = [];
  try {
    photos = typeof photosRaw === "string" ? JSON.parse(photosRaw) : [];
  } catch {
    return { ok: false, message: "No pudimos leer las fotos. Vuelve a subirlas." };
  }

  const parsed = publishPropertySchema.safeParse({
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
      line: formData.get("address.line"),
      neighborhood: formData.get("address.neighborhood"),
      city: formData.get("address.city"),
      department: formData.get("address.department"),
    },
    photos,
  });

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

  const slug = propertySlug(listing.title, address.city);

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

  return { ok: true, id: propertyRef.id, slug, rolePromoted };
}
