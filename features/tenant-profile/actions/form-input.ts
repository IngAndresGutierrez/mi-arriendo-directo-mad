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
  };
}

/**
 * Normalizes a parsed dossier into what gets stored: the reference's phone in E.164, and the
 * pet description dropped when there are no pets so a stale sentence cannot outlive the pet.
 */
export function toStoredDossier(values: z.output<typeof tenantDossierSchema>): TenantDossier {
  const digits = values.reference.phone.replace(/\D/g, "");

  return {
    ...values,
    petsDescription: values.hasPets ? values.petsDescription : "",
    reference: {
      ...values.reference,
      phone: toE164(values.reference.phoneCountry, digits) ?? "",
    },
  };
}

