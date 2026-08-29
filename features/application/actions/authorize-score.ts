"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireCompleteProfile } from "@/features/profile";
import { applicationRoute } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";
import { currentVersion } from "@/shared/legal/documents";

import { getApplicationFor } from "../data/application";

export type AuthorizeScoreResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * The tenant lets **this** landlord see their payment-compliance score.
 *
 * ## Why it is asked at all
 *
 * The score is derived from tenancies with **other** landlords. Showing it to this one is a
 * disclosure of the tenant's personal data to a third party, and it is a **finalidad distinta**
 * from the one authorised at signup — that consent is about managing this rental, not about
 * telling a stranger how somebody paid a different one. Decreto 1074 art. 2.2.2.25.2.5 requires a
 * fresh authorisation when the purpose changes, so this is it: express, per application, dated,
 * and carrying the version of the policy it was given against.
 *
 * It is the same shape `authorizeBackgroundChecks` already uses, deliberately: two authorisations
 * that look different would be two things to reason about separately, and there is no reason for
 * them to differ.
 *
 * ## Why it is per application and not a setting
 *
 * A switch in Ajustes would be one decision covering every landlord a person ever applies to,
 * including the ones they have not met — and habeas data authorisations are for a purpose and a
 * recipient, not for a category. Per application also makes withdrawing it real: not applying, or
 * withdrawing the application, is what stops it.
 *
 * ## What still needs a lawyer, stated rather than hidden
 *
 * Payment behaviour on an obligation plausibly falls under **Ley 1266 de 2012** (hábeas data
 * financiero), which is stricter than 1581 — prior notice before reporting negative information,
 * caducidad of a negative record. This product does not report to anybody, holds no stored table of
 * behaviour (`paymentScoreFor` derives the score on read) and discloses only to a landlord the
 * tenant chose. That is the argument for it being outside 1266; **it is an argument and not a
 * ruling**, and it is the one thing in this feature that a lawyer has to sign off before it is
 * turned on for real users.
 */
export async function authorizePaymentScore(id: string): Promise<AuthorizeScoreResult> {
  const user = await requireCompleteProfile();

  const application = await getApplicationFor(id, user.uid);
  if (!application) {
    return { ok: false, message: "Este proceso no existe o no es tuyo." };
  }
  if (application.tenantUid !== user.uid) {
    return { ok: false, message: "Solo el inquilino puede autorizar que se comparta." };
  }
  if (application.status !== "open") {
    return { ok: false, message: "Este proceso ya está cerrado." };
  }
  if (application.scoreAuthorizedAt) {
    return { ok: true };
  }

  await adminDb()
    .collection("applications")
    .doc(id)
    .update({
      scoreAuthorizedAt: FieldValue.serverTimestamp(),
      /* Contra qué redacción de la política se autorizó: una fecha sola no dice qué se autorizó. */
      scoreAuthorizedVersion: currentVersion("privacy"),
      updatedAt: FieldValue.serverTimestamp(),
    });

  revalidatePath(applicationRoute(id));

  return { ok: true };
}
