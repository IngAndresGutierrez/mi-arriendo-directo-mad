import "server-only";

import { cache } from "react";

import { adminDb } from "@/shared/firebase/admin";

import type { Application, ApplicationDoc } from "../domain/application";

type Snapshot = { id: string; exists: boolean; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

function toApplication(snapshot: Snapshot): Application | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as ApplicationDoc;

  return {
    ...doc,
    id: snapshot.id,
    history: (doc.history ?? []).map((event) => ({ ...event, at: iso(event.at) })),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * One process, for someone who is part of it.
 *
 * A stranger gets `null` — the same answer as "there is no such process", on purpose: the
 * caller cannot tell the two apart, so a mistake at the call site leaks nothing, not even the
 * fact that a given id exists.
 */
export const getApplicationFor = cache(
  async (id: string, viewerUid: string): Promise<Application | null> => {
    const snapshot = (await adminDb()
      .collection("applications")
      .doc(id)
      .get()) as unknown as Snapshot;

    const application = toApplication(snapshot);
    if (!application) return null;

    const isParty =
      application.tenantUid === viewerUid || application.landlordUid === viewerUid;

    return isParty ? application : null;
  },
);

/** The processes someone is part of, newest first, on whichever side they are on. */
export async function listApplicationsFor(uid: string): Promise<readonly Application[]> {
  const applications = adminDb().collection("applications");

  // Firestore cannot OR across two fields, so it is two queries. In parallel: they do not
  // depend on each other and chaining them would double the latency of the page.
  const [asTenant, asLandlord] = await Promise.all([
    applications.where("tenantUid", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
    applications.where("landlordUid", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
  ]);

  const byId = new Map<string, Application>();
  for (const doc of [...asTenant.docs, ...asLandlord.docs]) {
    const application = toApplication(doc as unknown as Snapshot);
    if (application) byId.set(application.id, application);
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * This tenant's application to this property, whatever its state.
 *
 * It is what decides whether the "Postularme" button is offered, so it has to see a closed one
 * too: applying again after being turned down is a different conversation, not a retry.
 */
export const getTenantApplicationTo = cache(
  async (propertyId: string, tenantUid: string): Promise<Application | null> => {
    const snapshot = await adminDb()
      .collection("applications")
      .where("tenantUid", "==", tenantUid)
      .where("propertyId", "==", propertyId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const [first] = snapshot.docs;

    return first ? toApplication(first as unknown as Snapshot) : null;
  },
);
