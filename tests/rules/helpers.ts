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
export const NOTIFICATION_ID = "notification-1";

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

/**
 * A property with the shape the rules require. Tests override one field at a time to check
 * each validation, so every key here has to be valid on its own.
 */
export function publishedProperty(overrides: Record<string, unknown> = {}) {
  return {
    landlordUid: UID_LANDLORD,
    title: "Apartamento luminoso en Palermo",
    description: "Dos habitaciones, cocina integral y zona de ropas independiente.",
    type: "apartment",
    status: "available",
    rent: 1_800_000,
    adminFee: 250_000,
    minLeaseMonths: 12,
    stratum: 4,
    areaM2: 65,
    bedrooms: 2,
    bathrooms: 2,
    parking: "private",
    furnished: false,
    petsAllowed: true,
    availableFrom: "2026-12-07",
    area: { neighborhood: "Palermo", city: "Manizales", department: "Caldas" },
    slug: "apartamento-luminoso-en-palermo-manizales",
    photos: [{ path: `properties/${UID_LANDLORD}/a.jpg`, url: "https://example.com/a.jpg" }],
    createdAt: new Date(),
    ...overrides,
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

    await db.doc(`properties/${PROPERTY_ID}`).set(
      publishedProperty({
        title: "Apartamento en Chapinero",
        area: { neighborhood: "Chapinero", city: "Bogotá", department: "Bogotá D.C." },
      }),
    );
    // The street lives apart from the public document: the catalog is world-readable.
    await db.doc(`properties/${PROPERTY_ID}/private/location`).set({ line: "Calle 60 #10-20" });

    await db.doc(`properties/property-draft`).set(
      publishedProperty({
        title: "Casa sin publicar todavía",
        status: "draft",
        type: "house",
        area: { neighborhood: "Laureles", city: "Medellín", department: "Antioquia" },
      }),
    );

    await db.doc(`applications/${APPLICATION_ID}`).set({
      propertyId: PROPERTY_ID,
      tenantUid: UID_TENANT,
      landlordUid: UID_LANDLORD,
      stage: "submitted",
      status: "open",
      createdAt: new Date(),
    });

    // The dossier the tenant reuses across applications: income, identity document, reference.
    await db.doc(`tenantProfiles/${UID_TENANT}`).set({
      documentType: "cc",
      documentNumber: "1053812345",
      occupation: "employee",
      employer: "Crehana",
      monthlyIncome: 6_000_000,
      householdSize: 2,
      hasPets: false,
      petsDescription: "",
      reference: {
        name: "Carolina Restrepo",
        phone: "+573001234567",
        phoneCountry: "CO",
        relationship: "Jefe directo",
      },
      updatedAt: new Date(),
    });

    // One notification for the tenant, and one email sitting in the extension's outbox.
    await db.doc(`notifications/${NOTIFICATION_ID}`).set({
      recipientUid: UID_TENANT,
      type: "application_received",
      applicationId: APPLICATION_ID,
      stage: "submitted",
      propertyTitle: "Apartamento en Chapinero",
      actorName: "Ana Uno Pérez",
      readAt: null,
      createdAt: new Date(),
    });

    // One document already uploaded by the tenant.
    await db.doc(`tenantProfiles/${UID_TENANT}/documents/doc-1`).set({
      kind: "id_front",
      path: `applicants/${UID_TENANT}/id-front.jpg`,
      name: "cedula.jpg",
      contentType: "image/jpeg",
      size: 120_000,
      uploadedAt: new Date(),
    });

    // A second one, for someone else: without it an unfiltered `list` would find only
    // documents the reader owns and the rule would look stricter than it is.
    await db.doc("notifications/notification-2").set({
      recipientUid: UID_LANDLORD,
      type: "application_withdrawn",
      applicationId: APPLICATION_ID,
      stage: "submitted",
      propertyTitle: "Apartamento en Chapinero",
      actorName: "Ana Uno Pérez",
      readAt: null,
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
