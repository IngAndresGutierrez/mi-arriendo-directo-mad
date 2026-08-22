import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

import type { TenantProfile } from "../domain/tenant-profile";

/** Firestore hands back `DocumentData`: nothing is typed until this module says so. */
type Snapshot = { exists: boolean; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

/**
 * The dossier a tenant reuses across applications, or `null` if they have never filled one.
 *
 * Only ever read for its own owner — the uid comes from the session, never from a parameter a
 * caller chose. A landlord reviewing an application reads the snapshot inside it instead.
 *
 * Cached per request: the form and its metadata both need the same read.
 */
export const getTenantProfile = cache(async (uid: string): Promise<TenantProfile | null> => {
  const snapshot = (await adminDb()
    .collection("tenantProfiles")
    .doc(uid)
    .get()) as unknown as Snapshot;

  const data = snapshot.data();
  if (!snapshot.exists || !data) return null;

  /*
   * Built field by field, never spread. The stored document also carries `createdAt`, and a
   * Firestore `Timestamp` cannot cross to a Client Component — it arrives as a class instance
   * and React refuses it. Spreading made the profile page fail to render at all, which is the
   * good version of that mistake; the bad version leaks a field nobody meant to send.
   */
  const stored = data as unknown as TenantProfile;

  return {
    documentType: stored.documentType,
    documentNumber: stored.documentNumber,
    occupation: stored.occupation,
    employer: stored.employer,
    monthlyIncome: stored.monthlyIncome,
    householdSize: stored.householdSize,
    hasPets: stored.hasPets,
    petsDescription: stored.petsDescription,
    reference: {
      name: stored.reference.name,
      phone: stored.reference.phone,
      phoneCountry: stored.reference.phoneCountry,
      relationship: stored.reference.relationship,
    },
    updatedAt: iso(data.updatedAt),
  };
});
