import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

export type ContractSummary = {
  readonly id: string;
  readonly status: string;
  /** Monthly rent in whole pesos. */
  readonly rent: number;
  readonly propertyId: string;
};

function toSummary(doc: { id: string; data: () => Record<string, unknown> }): ContractSummary {
  const data = doc.data();
  return {
    id: doc.id,
    status: typeof data.status === "string" ? data.status : "unknown",
    rent: typeof data.rent === "number" ? data.rent : 0,
    propertyId: typeof data.propertyId === "string" ? data.propertyId : "",
  };
}

/**
 * Contracts the user is a party to, either as tenant or as landlord.
 *
 * Two queries, because Firestore cannot OR across different fields in a simple `where`;
 * they run in parallel with `Promise.all` so the round trips do not chain. Deduplicated by
 * id: one contract cannot have the same person in both roles, but the union should be
 * defensive anyway.
 */
export const getUserContracts = cache(async (uid: string): Promise<readonly ContractSummary[]> => {
  const contracts = adminDb.collection("contracts");

  const [asTenant, asLandlord] = await Promise.all([
    contracts.where("tenantUid", "==", uid).limit(20).get(),
    contracts.where("landlordUid", "==", uid).limit(20).get(),
  ]);

  const byId = new Map<string, ContractSummary>();
  for (const doc of [...asTenant.docs, ...asLandlord.docs]) {
    byId.set(doc.id, toSummary(doc));
  }

  return [...byId.values()];
});
