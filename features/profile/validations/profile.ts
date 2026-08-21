import { z } from "zod";

import { DEPARTMENTS, GENDERS, MAX_AGE, MIN_AGE } from "../domain/colombia";
import { COUNTRY_ISO_CODES, phoneRuleFor } from "@/shared/phone/countries";

/** Hoisted: crear el RegExp en cada llamada es trabajo repetido. */
const NON_DIGITS = /\D/g;
/** Al menos dos palabras: nombre y apellido. */
const AT_LEAST_TWO_WORDS = /\S+\s+\S+/;

/**
 * Edad en años cumplidos a una fecha de referencia.
 *
 * La referencia se inyecta para que la validación sea determinista y testeable; no leas el
 * reloj dentro del schema.
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
 * Teléfono: país + número nacional.
 *
 * Se guarda en E.164 (`+573001234567`), que es el formato inequívoco; el ISO del país se
 * conserva aparte porque `+1` lo comparten varios países y no se puede deducir del número.
 *
 * El número se normaliza antes de validar: la gente escribe "300 123 4567", "(300) 1234567"
 * o pega el número con el indicativo. Quitamos todo lo que no sea dígito.
 */
const phone = z
  .object({
    country: z.enum(COUNTRY_ISO_CODES, { error: "Selecciona un país" }),
    national: z
      .string({ error: "Ingresa tu teléfono" })
      .transform((value) => value.replace(NON_DIGITS, "")),
  })
  .superRefine((value, ctx) => {
    // La regla depende del país, así que se valida a nivel de objeto, no de campo.
    const rule = phoneRuleFor(value.country);
    if (!rule.pattern.test(value.national)) {
      ctx.addIssue({ code: "custom", message: rule.message, path: ["national"] });
    }
  });

/** Dirección colombiana: sin código postal ni "estado/provincia". */
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
 * Perfil que se completa después del primer acceso.
 *
 * El correo no está aquí: sale de la sesión, no del formulario. Un `uid` o un correo que
 * venga del cliente no se puede confiar.
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

  /** `YYYY-MM-DD`, tal como lo entrega `<input type="date">`. */
  birthDate: z
    .string({ error: "Elige tu fecha de nacimiento" })
    .min(1, { error: "Elige tu fecha de nacimiento" }),

  /**
   * Consentimiento obligatorio.
   *
   * `z.boolean().refine(...)` y no `z.literal(true)`: el rechazo en runtime es idéntico,
   * pero el tipo de **entrada** sigue siendo `boolean`, y el formulario necesita arrancar
   * con `false`. Con `z.literal(true)` el valor por defecto no compilaría.
   */
  acceptsTerms: z.boolean().refine((value) => value === true, {
    error: "Debes aceptar los Términos y la Política de privacidad",
  }),
});

/** Lo que valida la Server Action (después de transformar). */
export type CompleteProfileInput = z.output<typeof completeProfileSchema>;

/**
 * Lo que maneja el formulario (antes de transformar). Difiere de la salida: `mobile` se
 * normaliza y el consentimiento arranca en `false`.
 */
export type CompleteProfileFormValues = z.input<typeof completeProfileSchema>;

/**
 * Valida la fecha de nacimiento contra una referencia explícita.
 *
 * Va aparte del schema porque depende del reloj: así el schema sigue siendo puro y el test
 * puede fijar la fecha de referencia.
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
