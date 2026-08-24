"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompleteProfile } from "@/features/profile";
import { TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";
import { tenantDossierSchema } from "../validations/tenant-profile";
import { dossierFromForm, toStoredDossier } from "./form-input";

export type SaveTenantProfileResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Saves the tenant's dossier.
 *
 * It is written under the caller's own uid, taken from the session — there is no path in which
 * a uid arriving in the form could decide whose income gets overwritten.
 */
export async function saveTenantProfile(formData: FormData): Promise<SaveTenantProfileResult> {
  const user = await requireCompleteProfile();

  const parsed = tenantDossierSchema.safeParse(dossierFromForm(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await adminDb()
    .collection("tenantProfiles")
    .doc(user.uid)
    .set(
      {
        ...toStoredDossier(parsed.data),
        /*
         * When the tenant declared they have their reference's permission to give us that phone
         * number. A date and not a flag: it is part of the record, and the schema already refuses
         * to parse a dossier without the declaration, so reaching here means it was given.
         */
        referenceAuthorizedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      // `merge` so re-saving keeps the original `createdAt`: it is a profile, not a new document.
      { merge: true },
    );

  revalidatePath(TENANT_PROFILE_ROUTE);
  return { ok: true };
}
