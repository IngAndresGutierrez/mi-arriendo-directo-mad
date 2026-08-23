"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notify } from "@/features/notification";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { getVisiblePropertyBySlug, propertyMonthlyCost } from "@/features/property";
import {
  dossierFromForm,
  saveTenantProfile,
  tenantDossierSchema,
  toStoredDossier,
} from "@/features/tenant-profile";
import { CONTRACTS_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

import { getTenantApplicationTo } from "../data/application";
import { applicationBlocker, type Stage } from "../domain/application";
import { applicationDetailsSchema, validateDesiredMoveIn } from "../validations/application";

export type ApplyResult =
  | { readonly ok: true; readonly applicationId: string }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/** Why an application cannot be made, in words the tenant can act on. */
const BLOCKER_MESSAGES: Readonly<Record<string, string>> = {
  own_property: "Este inmueble es tuyo: no puedes postularte a él.",
  not_available: "Este inmueble ya no está disponible.",
  already_applied: "Ya tienes una postulación abierta a este inmueble.",
  rejected_before: "El propietario ya no continuó con tu postulación a este inmueble.",
};

/**
 * A tenant applies to a listing.
 *
 * Authenticate → validate → authorize against the real listing → business invariants → write.
 * Nothing that arrives in the form decides who is applying or to what: the uid comes from the
 * session and the property from its slug, read fresh.
 *
 * The dossier is written twice on purpose. Once into the tenant's profile, so the next
 * application starts filled in; once **into the application**, as a snapshot, so the landlord
 * always sees what was declared to them and a later edit to the profile cannot rewrite it.
 */
export async function applyToProperty(slug: string, formData: FormData): Promise<ApplyResult> {
  const user = await requireCompleteProfile();

  const property = await getVisiblePropertyBySlug(slug, user.uid);
  if (!property) {
    return { ok: false, message: "Este inmueble ya no está publicado." };
  }

  const existing = await getTenantApplicationTo(property.id, user.uid);
  const blocker = applicationBlocker(property, user.uid, existing);
  if (blocker) {
    return { ok: false, message: BLOCKER_MESSAGES[blocker] };
  }

  const dossier = tenantDossierSchema.safeParse(dossierFromForm(formData));
  if (!dossier.success) {
    return { ok: false, fieldErrors: z.flattenError(dossier.error).fieldErrors };
  }

  const details = applicationDetailsSchema.safeParse({
    desiredMoveIn: formData.get("desiredMoveIn"),
    leaseMonths: formData.get("leaseMonths"),
    message: formData.get("message") ?? "",
  });
  if (!details.success) {
    return { ok: false, fieldErrors: z.flattenError(details.error).fieldErrors };
  }

  const moveIn = validateDesiredMoveIn(details.data.desiredMoveIn, new Date());
  if (!moveIn.ok) {
    return { ok: false, fieldErrors: { desiredMoveIn: [moveIn.error] } };
  }

  // The landlord cannot rent for less than they published.
  if (details.data.leaseMonths < property.minLeaseMonths) {
    return {
      ok: false,
      fieldErrors: { leaseMonths: ["Este inmueble se arrienda por mínimo un año."] },
    };
  }

  const profile = await getProfile(user.uid);
  const stored = toStoredDossier(dossier.data);
  const now = new Date();

  const reference = adminDb().collection("applications").doc();
  await reference.set({
    propertyId: property.id,
    propertySlug: property.slug,
    propertyTitle: property.title,
    propertyCity: property.area.city,
    monthlyCost: propertyMonthlyCost(property),
    landlordUid: property.landlordUid,
    tenantUid: user.uid,
    tenantName: profile?.fullName ?? "",
    stage: "submitted" satisfies Stage,
    status: "open",
    dossier: stored,
    desiredMoveIn: details.data.desiredMoveIn,
    leaseMonths: details.data.leaseMonths,
    message: details.data.message,
    closingNote: "",
    checksAuthorizedAt: null,
    documentReviews: {},
    checkResults: {},
    history: [{ stage: "submitted", at: now, by: "system" }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Best effort: the application is already in, and failing to remember the dossier must not
  // undo it. The tenant would only have to type it again next time.
  await saveTenantProfile(formData).catch(() => undefined);

  // The landlord is the one who has something to do now.
  const landlord = await getProfile(property.landlordUid);
  await notify({
    recipientUid: property.landlordUid,
    recipientEmail: landlord?.email ?? null,
    type: "application_received",
    applicationId: reference.id,
    stage: "submitted",
    propertyTitle: property.title,
    actorName: profile?.fullName ?? "",
  });

  revalidatePath(CONTRACTS_ROUTE);
  revalidatePath(propertyDetailRoute(property.slug));

  return { ok: true, applicationId: reference.id };
}
