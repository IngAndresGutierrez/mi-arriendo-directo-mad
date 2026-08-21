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
 * Contratos donde el usuario es parte, como inquilino o como propietario.
 *
 * Son dos consultas porque Firestore no cruza campos distintos en un `where` simple; van en
 * paralelo con `Promise.all` para no encadenar dos viajes de red. Se deduplica por id: un
 * mismo contrato no puede tener a la misma persona en los dos roles, pero la unión debe ser
 * defensiva.
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
