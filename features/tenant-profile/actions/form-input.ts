import "server-only";

// Not `"use server"`: such a module may only export async functions, and these are the plain
// helpers the action is built from. Kept beside it because they are its input handling.
import type { z } from "zod";

import { toE164 } from "@/shared/phone/countries";

import type { TenantDossier } from "../domain/tenant-profile";
import type { tenantDossierSchema } from "../validations/tenant-profile";

/** Reads the dossier out of a `FormData`, in the shape the schema expects. */
export function dossierFromForm(data: FormData): Record<string, unknown> {
  return {
    documentType: data.get("documentType"),
    documentNumber: data.get("documentNumber"),
    occupation: data.get("occupation"),
    employer: data.get("employer"),
    monthlyIncome: data.get("monthlyIncome"),
    householdSize: data.get("householdSize"),
    hasPets: data.get("hasPets") === "true",
    petsDescription: data.get("petsDescription") ?? "",
    reference: {
      name: data.get("reference.name"),
      phone: data.get("reference.phone"),
      phoneCountry: data.get("reference.phoneCountry"),
      relationship: data.get("reference.relationship"),
    },
    referenceAuthorized: data.get("referenceAuthorized") === "true",
  };
}

/**
 * Normalizes a parsed dossier into what gets stored: the reference's phone in E.164, and the
 * pet description dropped when there are no pets so a stale sentence cannot outlive the pet.
 *
 * **`referenceAuthorized` is deliberately dropped here.** It is a declaration the tenant makes to
 * *us* — that they have their reference's permission to hand over that phone number — not a field
 * of the dossier a landlord reads. Leaving it in would carry it into the snapshot inside every
 * application, where it means nothing to the person reading it. What the record needs is *when* it
 * was declared, and the action writes that as `referenceAuthorizedAt`: the same choice as
 * `waivedAt`, `checksAuthorizedAt` and `acceptedClauseAt`, and for the same reason — a bare boolean
 * answers "no" identically whether it was declared today or never asked at all.
 */
export function toStoredDossier(values: z.output<typeof tenantDossierSchema>): TenantDossier {
  const digits = values.reference.phone.replace(/\D/g, "");
  const dossier: Record<string, unknown> = { ...values };
  delete dossier.referenceAuthorized;

  return {
    ...(dossier as TenantDossier),
    petsDescription: values.hasPets ? values.petsDescription : "",
    reference: {
      ...values.reference,
      phone: toE164(values.reference.phoneCountry, digits) ?? "",
    },
  };
}

