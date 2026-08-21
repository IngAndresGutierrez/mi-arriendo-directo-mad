import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

export type ContractSummary = {
  readonly id: string;
  readonly estado: string;
  /** Canon en pesos, entero. */
  readonly canon: number;
  readonly inmuebleId: string;
};

function toSummary(doc: { id: string; data: () => Record<string, unknown> }): ContractSummary {
  const data = doc.data();
  return {
    id: doc.id,
    estado: typeof data.estado === "string" ? data.estado : "desconocido",
    canon: typeof data.canon === "number" ? data.canon : 0,
    inmuebleId: typeof data.inmuebleId === "string" ? data.inmuebleId : "",
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
  const contracts = adminDb.collection("contratos");

  const [asTenant, asOwner] = await Promise.all([
    contracts.where("inquilinoUid", "==", uid).limit(20).get(),
    contracts.where("propietarioUid", "==", uid).limit(20).get(),
  ]);

  const byId = new Map<string, ContractSummary>();
  for (const doc of [...asTenant.docs, ...asOwner.docs]) {
    byId.set(doc.id, toSummary(doc));
  }

  return [...byId.values()];
});
