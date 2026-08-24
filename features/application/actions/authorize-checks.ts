"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";
import { currentVersion } from "@/shared/legal/documents";

import { getApplicationFor } from "../data/application";

export type AuthorizeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The tenant authorises this landlord to check their records.
 *
 * Consulting someone's judicial, traffic or disciplinary record requires their express
 * authorisation — Ley 1581 de 2012 — and the consent given at signup does not cover it: that one
 * is about processing what they handed over, not about going to look for more. So it is given
 * here, per application, and the date is kept: an authorisation without a date is a claim, not a
 * record.
 *
 * Only the tenant can give it, and it cannot be taken back through this action — a check already
 * run cannot be un-run, and a button that implied otherwise would be a lie. Withdrawing the
 * application is what stops the process.
 */
export async function authorizeBackgroundChecks(id: string): Promise<AuthorizeResult> {
  const user = await requireCompleteProfile();

  const application = await getApplicationFor(id, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }
  if (application.tenantUid !== user.uid) {
    return { ok: false, message: "Solo el inquilino puede autorizar la consulta." };
  }
  if (application.status !== "open") {
    return { ok: false, message: "Este proceso ya está cerrado." };
  }
  if (application.checksAuthorizedAt) {
    return { ok: true };
  }

  await adminDb()
    .collection("applications")
    .doc(id)
    .update({
      checksAuthorizedAt: FieldValue.serverTimestamp(),
      /*
       * Which wording of the política de tratamiento this authorisation was given against.
       *
       * The same reason `clauseVersion` sits beside `acceptedClauseAt` on a signature: a date on
       * its own answers *when* somebody authorised and says nothing about *what* they authorised,
       * which is the half that matters once the policy has changed. Decreto 1074 art.
       * 2.2.2.25.2.4 puts the burden of proving the authorisation on us, and a proof that cannot
       * name what was authorised proves nothing.
       */
      checksAuthorizedVersion: currentVersion("privacy"),
      updatedAt: FieldValue.serverTimestamp(),
    });

  revalidatePath(applicationRoute(id));

  return { ok: true };
}
