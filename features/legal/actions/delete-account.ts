"use server";

import { cookies } from "next/headers";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { z } from "zod";

import { requireUser, SESSION_COOKIE } from "@/shared/auth/session";
import { adminAuth, adminDb, adminStorage } from "@/shared/firebase/admin";

import { erasureBlockerMessage } from "../domain/erasure";
import { erasureStatus } from "../data/erasure";
import { deleteAccountSchema } from "../validations/erasure";

export type DeleteAccountResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message?: string;
      readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };

/**
 * Deletes the caller's own account — the derecho de supresión of Ley 1581 de 2012, art. 8, lit. e.
 *
 * **`requireUser` and not `requireCompleteProfile`.** Somebody who signed up and never finished
 * onboarding has an account, an email and an authentication record, and they are entitled to have
 * them deleted. Guarding this behind a complete profile would have made the one group with the
 * least invested in the product the only one that could not leave it.
 *
 * **It deletes only the caller's own data**, taken from the session. There is no shape of this
 * call that deletes somebody else: no id arrives in the `FormData` at all.
 *
 * **What survives, and why, is `ERASURE_PLAN`** — read it beside this function, because the two are
 * meant to agree. In short: supresión is not absolute (art. 9, and Decreto 1074 art.
 * 2.2.2.25.2.11), and a signed lease belongs to two people. Erasing the tenant from it would
 * destroy the landlord's evidence of an agreement they never consented to lose.
 *
 * The order matters and is the opposite of the intuitive one: **the data goes first and the
 * authentication record last**. Deleting the Auth user first would leave a caller who can no
 * longer be authorised half-way through, with orphaned documents nobody has a session to clean up.
 */
export async function deleteAccount(formData: FormData): Promise<DeleteAccountResult> {
  const user = await requireUser();

  const parsed = deleteAccountSchema.safeParse({ confirmation: formData.get("confirmation") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * Checked again here, against the real data, and not only in the screen that offered the button.
   * A Server Action is a public endpoint.
   */
  const blocker = await erasureStatus(user.uid);
  if (blocker) {
    return {
      ok: false,
      message:
        blocker.reason === "unknown"
          ? "No pudimos revisar si tienes procesos o arriendos abiertos. Vuelve a intentarlo en un momento."
          : erasureBlockerMessage(blocker),
    };
  }

  const db = adminDb();
  const profileRef = db.collection("users").doc(user.uid);

  // --- the reusable dossier, and the documents in it -------------------------------------------
  // Deleted outright: what a landlord reviewed is the snapshot inside their own application, so
  // nothing that has to survive is stored here.
  await deleteCollection(db.collection("tenantProfiles").doc(user.uid).collection("documents"));
  await db.collection("tenantProfiles").doc(user.uid).delete();
  await deleteCollection(profileRef.collection("documents"));

  /*
   * Y las preferencias de avisos, que son un ajuste de esta cuenta y de nadie más.
   *
   * No hay una segunda persona cuya prueba se destruya al borrarlas, así que no hay excepción que
   * defender: se van con la cuenta. Sin esta línea quedarían huérfanas bajo un `users/{uid}` que ya
   * es una lápida — datos personales de alguien que pidió que no quedara nada.
   */
  await deleteCollection(profileRef.collection("settings"));

  /*
   * The uploaded files: identity document, payslips, certificates.
   *
   * These go even though the closed applications that referenced them stay. The verdicts live on
   * the application, never on the document, so the record of what was approved survives without
   * them — and holding somebody's identity document after they have asked to be deleted is
   * precisely what this right exists to stop.
   */
  await deleteFolder(`applicants/${user.uid}/`);

  // --- their listings --------------------------------------------------------------------------
  const properties = await db
    .collection("properties")
    .where("landlordUid", "==", user.uid)
    .get();

  for (const property of properties.docs) {
    // The street and the exact map point live in a subcollection of their own.
    await deleteCollection(property.ref.collection("private"));

    // The slug reservation has to be released, or the URL stays claimed by a document that is gone.
    const reservations = await db
      .collection("propertySlugs")
      .where("propertyId", "==", property.id)
      .get();
    for (const reservation of reservations.docs) await reservation.ref.delete();

    await property.ref.delete();
  }
  await deleteFolder(`properties/${user.uid}/`);

  // --- their notifications --------------------------------------------------------------------
  await deleteCollection(
    db.collection("notifications").where("recipientUid", "==", user.uid),
  );

  /*
   * --- the permissions, in both directions -----------------------------------------------------
   *
   * The grants this person handed out over their own properties, and the ones they accepted over
   * somebody else's. Both go, and unlike a contract or a tenancy there is no second party whose
   * evidence is destroyed by removing them: a collaboration is a **permission**, not a record of an
   * agreement, and a permission that outlives the account that granted it is precisely the thing
   * that must not be left behind.
   *
   * Two queries because Firestore cannot OR across two fields — the same reason
   * `listApplicationsFor` is two — and each is a single equality filter, so neither needs an index.
   * What survives is the name already written into a visit's `shownBy`: see `ERASURE_PLAN`.
   */
  await deleteCollection(db.collection("collaborations").where("landlordUid", "==", user.uid));
  await deleteCollection(
    db.collection("collaborations").where("collaboratorUid", "==", user.uid),
  );

  /*
   * --- the profile itself, as a tombstone ----------------------------------------------------
   *
   * The document stays and every identifying field goes. It is not sentiment: `leases` and the
   * closed `applications` key their parties by uid, and a uid pointing at nothing is a record
   * whose own reader cannot tell "deleted" from "never existed" — which is the difference between
   * a landlord seeing "esta persona eliminó su cuenta" and seeing a screen that looks broken.
   *
   * `FieldValue.delete()` per field rather than writing `null`: what was asked for is that we stop
   * holding the data, and a `null` beside the key is still the key.
   */
  await profileRef.set(
    {
      fullName: FieldValue.delete(),
      email: FieldValue.delete(),
      phone: FieldValue.delete(),
      phoneCountry: FieldValue.delete(),
      gender: FieldValue.delete(),
      address: FieldValue.delete(),
      birthDate: FieldValue.delete(),
      deletedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  /*
   * The consent records stay, and this is the one retention that looks wrong and is not.
   *
   * They are the proof that the processing which produced the surviving contracts was authorised —
   * Decreto 1074 art. 2.2.2.25.2.4 puts the burden of that proof on us. Deleting them alongside
   * the data they justified would leave the retained half with nothing behind it. They hold a
   * version, a date, an ip and a user agent; they never held a name.
   */

  // --- the way in ------------------------------------------------------------------------------
  // Last, so nothing above is left half-done by a caller who can no longer be authorised.
  await adminAuth().deleteUser(user.uid);

  /*
   * And the cookie, explicitly. Deleting the Auth user invalidates it, but a browser still holding
   * one gets "tu sesión expiró" on the next navigation — which reads as a failure rather than as
   * the thing they just asked for.
   */
  (await cookies()).delete(SESSION_COOKIE);

  return { ok: true };
}

/** How many documents one batch clears. Firestore's own batch limit is 500. */
const DELETE_PAGE = 300;

/**
 * Every document a query matches.
 *
 * Firestore has no recursive delete outside the CLI, so this is a page at a time. It takes a
 * `Query`, which both a `CollectionReference` and a filtered query satisfy — so the same function
 * clears a subcollection and clears "the notifications addressed to this uid".
 */
async function deleteCollection(query: Query): Promise<void> {
  const snapshot = await query.limit(DELETE_PAGE).get();
  if (snapshot.empty) return;

  const batch = adminDb().batch();
  for (const document of snapshot.docs) batch.delete(document.ref);
  await batch.commit();

  // A full page means there may be more: the next call clears the rest.
  if (snapshot.size === DELETE_PAGE) await deleteCollection(query);
}

/**
 * Everything under one Storage prefix. **Never throws**: a file that is already gone, or a bucket
 * that cannot be reached, must not leave the account half-deleted with no way to finish.
 */
async function deleteFolder(prefix: string): Promise<void> {
  try {
    await adminStorage().bucket().deleteFiles({ prefix });
  } catch (error) {
    console.error(`could not clear ${prefix}:`, error instanceof Error ? error.message : error);
  }
}
