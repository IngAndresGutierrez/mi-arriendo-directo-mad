"use server";

import { FieldValue } from "firebase-admin/firestore";

import { requireCompleteProfile } from "@/features/profile";
import { adminDb } from "@/shared/firebase/admin";

import { getApplicationFor } from "../data/application";

/**
 * Marks the process as having changed, so the other side finds out.
 *
 * The documents live under `tenantProfiles/{uid}/documents`, which only their owner may read —
 * so a landlord cannot subscribe to them, and a file arriving would otherwise be invisible until
 * they reloaded. The application document is the one thing both parties can watch, so touching it
 * is what turns "the tenant uploaded something" into a live update on the landlord's screen.
 *
 * It writes one timestamp and only for the process's own tenant. Nothing else can be reached
 * through it.
 */
export async function touchApplicationDocuments(applicationId: string): Promise<void> {
  const user = await requireCompleteProfile();

  const application = await getApplicationFor(applicationId, user.uid);
  if (!application || application.tenantUid !== user.uid) return;

  await adminDb()
    .collection("applications")
    .doc(applicationId)
    .update({ updatedAt: FieldValue.serverTimestamp() });
}
