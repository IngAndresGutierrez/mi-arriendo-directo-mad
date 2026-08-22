import { z } from "zod";

import { COUNTRY_ISO_CODES, phoneRuleFor } from "@/shared/phone/countries";

import {
  DOCUMENT_TYPES,
  HOUSEHOLD_MAX,
  HOUSEHOLD_MIN,
  INCOME_MAX,
  INCOME_MIN,
  OCCUPATIONS,
} from "../domain/tenant-profile";

const NON_DIGITS = /\D/g;

/**
 * Identity document number.
 *
 * Digits only for the Colombian documents, alphanumeric for a passport — and never a checksum
 * or a length rule beyond the obvious: a `CC` can be six digits for someone born in the fifties
 * and ten for a child, and rejecting the edges of that range rejects real people.
 */
const documentNumber = z
  .string()
  .trim()
  .min(5, "Escribe el número completo.")
  .max(20, "Ese número es demasiado largo.")
  .regex(/^[A-Za-z0-9-]+$/, "Solo números y letras, sin puntos ni espacios.");

const reference = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Escribe el nombre de tu referencia.")
    .max(80, "Ese nombre es demasiado largo.")
    .regex(/\S+\s+\S+/, "Escribe nombre y apellido."),
  phoneCountry: z.enum(COUNTRY_ISO_CODES),
  phone: z.string().trim().min(1, "Escribe el teléfono de tu referencia."),
  relationship: z
    .string()
    .trim()
    .min(3, "Di qué relación tienes con esa persona.")
    .max(40, "Resúmelo en menos palabras."),
});

/**
 * The dossier a tenant fills once.
 *
 * Everything here is declared by the tenant and none of it is verified by the platform — the
 * documents that back it up are a later stage of the process. The schema's job is to keep it
 * *coherent*: a phone that could exist, an income that is a number, a pet description when
 * there are pets.
 */
export const tenantDossierSchema = z
  .object({
    documentType: z.enum(DOCUMENT_TYPES),
    documentNumber,
    occupation: z.enum(OCCUPATIONS),
    employer: z
      .string()
      .trim()
      .min(2, "Completa este campo.")
      .max(120, "Resúmelo en menos palabras."),
    monthlyIncome: z.coerce
      .number({ error: "Escribe tus ingresos mensuales." })
      .int("Sin centavos.")
      .gt(INCOME_MIN, "Escribe tus ingresos mensuales.")
      .lte(INCOME_MAX, "Revisa esa cifra."),
    householdSize: z.coerce
      .number({ error: "¿Cuántas personas vivirían ahí?" })
      .int("Un número entero.")
      .gte(HOUSEHOLD_MIN, "Al menos una persona: tú.")
      .lte(HOUSEHOLD_MAX, "Revisa ese número."),
    hasPets: z.coerce.boolean(),
    petsDescription: z.string().trim().max(160, "Resúmelo en menos palabras.").default(""),
    reference,
  })
  .superRefine((value, ctx) => {
    // Validated per country: the rule for a Colombian mobile is not the rule for a US one.
    const rule = phoneRuleFor(value.reference.phoneCountry);
    const digits = value.reference.phone.replace(NON_DIGITS, "");
    if (!rule.pattern.test(digits)) {
      ctx.addIssue({ code: "custom", path: ["reference", "phone"], message: rule.message });
    }

    // "I have pets" with nothing said about them tells the landlord nothing, and pets are the
    // single most common reason an application is turned down: it deserves a sentence.
    if (value.hasPets && value.petsDescription.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["petsDescription"],
        message: "Cuéntale al propietario qué mascota es.",
      });
    }
  });

export type TenantDossierInput = z.input<typeof tenantDossierSchema>;
export type TenantDossierValues = z.output<typeof tenantDossierSchema>;
