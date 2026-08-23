"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireCompleteProfile } from "@/features/profile";
import { CONTRACTS_ROUTE } from "@/shared/auth/routes";
import { adminDb } from "@/shared/firebase/admin";

/**
 * Marks the caller's unread notifications as read.
 *
 * Scoped to the session's own uid, never to an id arriving from the client: there is no shape
 * of this call that can mark someone else's notifications, or read them on the way past.
 */
export async function markNotificationsRead(): Promise<{ readonly ok: true }> {
  const user = await requireCompleteProfile();

  const unread = await adminDb()
    .collection("notifications")
    .where("recipientUid", "==", user.uid)
    .where("readAt", "==", null)
    .limit(100)
    .get();

  if (!unread.empty) {
    const batch = adminDb().batch();
    for (const doc of unread.docs) {
      batch.update(doc.ref, { readAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }

  revalidatePath(CONTRACTS_ROUTE);
  return { ok: true };
}
