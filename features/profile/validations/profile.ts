import { z } from "zod";

import { GENDERS, MAX_AGE, MIN_AGE } from "../domain/profile";
import { DEPARTMENTS } from "@/shared/geo/colombia";
import { COUNTRY_ISO_CODES, phoneRuleFor } from "@/shared/phone/countries";

/** Hoisted: building the RegExp on every call is repeated work. */
const NON_DIGITS = /\D/g;
/** At least two words: given name and surname. */
const AT_LEAST_TWO_WORDS = /\S+\s+\S+/;

/**
 * Age in completed years at a reference date.
 *
 * The reference is injected so the validation stays deterministic and testable; never read
 * the clock inside the schema.
 */
export function ageInYears(birthDate: Date, reference: Date): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

/**
 * Phone: country + national number.
 *
 * Stored in E.164 (`+573001234567`), the unambiguous format; the country ISO is kept
 * separately because `+1` is shared by several countries and cannot be derived from the
 * number.
 *
 * The number is normalized before validating: people type "300 123 4567", "(300) 1234567",
 * or paste it with the dial code. Everything that is not a digit is stripped.
 */
const phone = z
  .object({
    country: z.enum(COUNTRY_ISO_CODES, { error: "Selecciona un país" }),
    national: z
      .string({ error: "Ingresa tu teléfono" })
      .transform((value) => value.replace(NON_DIGITS, "")),
  })
  .superRefine((value, ctx) => {
    // The rule depends on the country, so it is validated at object level, not per field.
    const rule = phoneRuleFor(value.country);
    if (!rule.pattern.test(value.national)) {
      ctx.addIssue({ code: "custom", message: rule.message, path: ["national"] });
    }
  });

/** Colombian address: no postal code and no "state/province". */
const colombianAddress = z.object({
  line: z
    .string({ error: "Ingresa tu dirección" })
    .trim()
    .min(5, { error: "La dirección es demasiado corta" })
    .max(160, { error: "La dirección es demasiado larga" }),
  city: z
    .string({ error: "Ingresa tu ciudad" })
    .trim()
    .min(2, { error: "Ingresa tu ciudad" })
    .max(80, { error: "La ciudad es demasiado larga" }),
  department: z.enum(DEPARTMENTS, { error: "Selecciona un departamento" }),
});

/**
 * The profile completed after the first sign-in.
 *
 * The email is not here: it comes from the session, not from the form. A `uid` or an email
 * coming from the client cannot be trusted.
 */
export const completeProfileSchema = z.object({
  fullName: z
    .string({ error: "Ingresa tu nombre completo" })
    .trim()
    .min(5, { error: "Ingresa tu nombre y tu apellido" })
    .max(120, { error: "El nombre es demasiado largo" })
    .refine((value) => AT_LEAST_TWO_WORDS.test(value), {
      error: "Ingresa tu nombre y tu apellido",
    }),

  phone,

  gender: z.enum(GENDERS, { error: "Selecciona una opción" }),

  address: colombianAddress,

  /** `YYYY-MM-DD`, exactly as `<input type="date">` delivers it. */
  birthDate: z
    .string({ error: "Elige tu fecha de nacimiento" })
    .min(1, { error: "Elige tu fecha de nacimiento" }),

  /**
   * Mandatory consent.
   *
   * `z.boolean().refine(...)` and not `z.literal(true)`: the runtime rejection is identical,
   * but the **input** type stays `boolean`, and the form needs to start at `false`. With
   * `z.literal(true)` the default value would not compile.
   */
  acceptsTerms: z.boolean().refine((value) => value === true, {
    error: "Debes aceptar los Términos y la Política de privacidad",
  }),
});

/**
 * The same fields, minus the consent.
 *
 * Editing your own name is not a moment to re-accept the terms: they were accepted once, at
 * signup, and `termsAcceptedAt` records when. Asking again on every correction would make the
 * checkbox mean nothing.
 */
export const accountDetailsSchema = completeProfileSchema.omit({ acceptsTerms: true });

export type AccountDetailsValues = z.output<typeof accountDetailsSchema>;
export type AccountDetailsFormValues = z.input<typeof accountDetailsSchema>;

/** What the Server Action validates (after transformation). */
export type CompleteProfileInput = z.output<typeof completeProfileSchema>;

/**
 * What the form handles (before transformation). It differs from the output: the number is
 * normalized and consent starts at `false`.
 */
export type CompleteProfileFormValues = z.input<typeof completeProfileSchema>;

/**
 * Validates the birth date against an explicit reference.
 *
 * It sits outside the schema because it depends on the clock: that keeps the schema pure and
 * lets the test pin the reference date.
 */
export function validateBirthDate(
  value: string,
  reference: Date,
): { ok: true; date: Date } | { ok: false; error: string } {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Elige una fecha válida" };
  }
  if (date > reference) {
    return { ok: false, error: "La fecha no puede estar en el futuro" };
  }

  const age = ageInYears(date, reference);
  if (age < MIN_AGE) {
    return { ok: false, error: `Debes ser mayor de ${MIN_AGE} años` };
  }
  if (age > MAX_AGE) {
    return { ok: false, error: "Revisa la fecha de nacimiento" };
  }

  return { ok: true, date };
}
