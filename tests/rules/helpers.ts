/**
 * Helpers for testing firestore.rules against the emulator.
 *
 * `withSecurityRulesDisabled` seeds data bypassing the rules (the equivalent of the
 * Admin SDK); everything else runs with the rules enforced.
 */
import { readFileSync } from "node:fs";

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";

export const PROJECT_ID = "demo-mad-rules";

export const UID_TENANT = "uid-tenant";
export const UID_LANDLORD = "uid-landlord";
export const UID_THIRD_PARTY = "uid-third-party";
export const UID_ADMIN = "uid-admin";

export const PROPERTY_ID = "property-1";
export const APPLICATION_ID = "application-1";
export const CONTRACT_ID = "contract-1";

export async function createTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
}

/** Client authenticated with the role in custom claims, just like the Admin SDK sets it. */
export function actingAs(
  env: RulesTestEnvironment,
  uid: string,
  role?: "tenant" | "landlord" | "admin",
  email?: string,
): Firestore {
  return env
    .authenticatedContext(uid, { ...(role ? { role } : {}), ...(email ? { email } : {}) })
    .firestore() as unknown as Firestore;
}

export function anonymous(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/**
 * A profile with the shape the rules require after `/registro/completar-perfil`.
 * Tests mutate it field by field to exercise each validation.
 */
export function completeProfileDoc(role: "tenant" | "landlord" = "tenant") {
  return {
    fullName: "Ana Uno Pérez",
    email: "tenant@example.com",
    phone: "+573001234567",
    phoneCountry: "CO",
    gender: "prefer_not_to_say",
    address: {
      line: "Calle 60 #10-20",
      city: "Bogotá",
      department: "Bogotá D.C.",
    },
    birthDate: "1995-04-12",
    termsAcceptedAt: new Date(),
    role,
    createdAt: new Date(),
  };
}

/** Baseline data: one published property and one pending application on it. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.doc(`users/${UID_TENANT}`).set(completeProfileDoc("tenant"));

    await db.doc(`users/${UID_TENANT}/documents/id-front`).set({
      type: "id_front",
      storagePath: `applicants/${UID_TENANT}/id-front.jpg`,
      uploadedAt: new Date(),
    });

    await db.doc(`properties/${PROPERTY_ID}`).set({
      landlordUid: UID_LANDLORD,
      title: "Apartamento en Chapinero",
      type: "apartment",
      status: "available",
      rent: 1_800_000,
      address: { city: "Bogotá", neighborhood: "Chapinero", line: "Calle 60 #10-20" },
      areaM2: 65,
      bedrooms: 2,
      bathrooms: 2,
      createdAt: new Date(),
    });

    await db.doc(`properties/property-draft`).set({
      landlordUid: UID_LANDLORD,
      title: "Casa sin publicar",
      type: "house",
      status: "draft",
      rent: 3_000_000,
      address: { city: "Medellín", neighborhood: "Laureles", line: "Cra 70 #1-2" },
      areaM2: 120,
      bedrooms: 3,
      bathrooms: 2,
      createdAt: new Date(),
    });

    await db.doc(`applications/${APPLICATION_ID}`).set({
      propertyId: PROPERTY_ID,
      tenantUid: UID_TENANT,
      landlordUid: UID_LANDLORD,
      status: "pending",
      createdAt: new Date(),
    });

    await db.doc(`contracts/${CONTRACT_ID}`).set({
      propertyId: PROPERTY_ID,
      tenantUid: UID_TENANT,
      landlordUid: UID_LANDLORD,
      rent: 1_800_000,
      status: "active",
    });

    await db.doc(`contracts/${CONTRACT_ID}/payments/payment-1`).set({
      amount: 1_800_000,
      status: "current",
      period: "2026-08",
    });
  });
}
