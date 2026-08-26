import { z } from "zod";

import { GENDERS, MAX_AGE, MIN_AGE } from "../domain/profile";
import { currentVersion } from "@/shared/legal/documents";
import { DEPARTMENTS } from "@/shared/geo/colombia";
import { isMunicipalityOf } from "@/shared/geo/municipalities";
import { LOCALES } from "@/shared/i18n/locale";
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
const colombianAddress = z
  .object({
    line: z
      .string({ error: "Ingresa tu dirección" })
      .trim()
      .min(5, { error: "La dirección es demasiado corta" })
      .max(160, { error: "La dirección es demasiado larga" }),
    city: z
      .string({ error: "Selecciona tu ciudad" })
      .trim()
      .min(2, { error: "Selecciona tu ciudad" })
      .max(80, { error: "La ciudad es demasiado larga" }),
    department: z.enum(DEPARTMENTS, { error: "Selecciona un departamento" }),
  })
  .superRefine((value, ctx) => {
    // Cross-field, so it runs at object level: a city means nothing without its department, and
    // the form now offers only the municipalities of the one chosen — the same rule the property
    // form applies, against the same DANE list, so the two cannot disagree about what exists.
    if (!isMunicipalityOf(value.city, value.department)) {
      ctx.addIssue({
        code: "custom",
        message: `${value.city || "Esa ciudad"} no es un municipio de ${value.department}`,
        path: ["city"],
      });
    }
  });

/**
 * Who the person is: the block both the onboarding form and the profile page collect.
 *
 * The email is not here: it comes from the session, not from the form. A `uid` or an email
 * coming from the client cannot be trusted.
 */
export const accountDetailsSchema = z.object({
  fullName: z
    .string({ error: "Ingresa tu nombre completo" })
    .trim()
    .min(5, { error: "Ingresa tu nombre y tu apellido" })
    .max(120, { error: "El nombre es demasiado largo" })
    .refine((value) => AT_LEAST_TWO_WORDS.test(value), {
      error: "Ingresa tu nombre y tu apellido",
    }),

  phone,

  /**
   * **Optional, and that is a legal requirement rather than a kindness.**
   *
   * Gender is sensitive data under Ley 1581 de 2012, art. 5 — the list there is introduced by
   * *"tales como"* and its actual criterion is data whose misuse can produce discrimination,
   * which this plainly is. Art. 6 then says nobody may be *obliged* to authorise the processing
   * of sensitive data. A required select is exactly that obligation, so the field asks and takes
   * no answer for an answer. `domain/profile.ts` already called it sensitive; this is the rest of
   * that sentence.
   *
   * "Prefiero no decirlo" stays as an option and means something different from leaving it empty:
   * one is an answer, the other is declining to give the data at all. Neither is stored as a
   * value the other could be confused with — an absent gender is an **absent field**.
   */
  gender: z
    .enum(GENDERS, { error: "Selecciona una opción" })
    .nullish()
    .transform((value) => value ?? null),

  address: colombianAddress,

  /**
   * Which language this person is written to in.
   *
   * **It is a stored preference and not a guess, because the guess is not available where it is
   * needed.** `notify()` runs inside `after()`, with no route, no request and therefore no
   * `Accept-Language` and no locale prefix to read — so the language of an email is either on the
   * user's document or it is nothing. That is also why the language of the *screen* cannot be it:
   * somebody reading the catalogue in English on a borrowed laptop has not asked for their rent
   * reminders in English.
   *
   * Optional in the schema, and absent means "not decided" rather than Spanish: onboarding seeds it
   * from the language the form was filled in, and `allowsLocale`'s fallback is what covers the
   * accounts created before this field existed. There is no migration to run.
   */
  locale: z
    .enum(LOCALES, { error: "Selecciona un idioma" })
    .nullish()
    .transform((value) => value ?? null),

  /** `YYYY-MM-DD`, exactly as `<input type="date">` delivers it. */
  birthDate: z
    .string({ error: "Elige tu fecha de nacimiento" })
    .min(1, { error: "Elige tu fecha de nacimiento" }),
});

/**
 * Onboarding: the same details, plus the two authorisations it is the moment to ask for.
 *
 * **The details are the base and the authorisations are the extension**, which is the way round
 * this used to be: `accountDetailsSchema` was `completeProfileSchema.omit({ acceptsTerms: true })`.
 * Subtraction was the wrong direction — editing your own name is not a moment to re-accept
 * anything, so what the two screens share is the details, and what onboarding adds is the consent.
 */
export const completeProfileSchema = accountDetailsSchema.extend({
  /**
   * Accepting the contract.
   *
   * `z.boolean().refine(...)` and not `z.literal(true)`: the runtime rejection is identical,
   * but the **input** type stays `boolean`, and the form needs to start at `false`. With
   * `z.literal(true)` the default value would not compile.
   */
  acceptsTerms: z.boolean().refine((value) => value === true, {
    error: "Debes aceptar los Términos y condiciones",
  }),

  /**
   * Authorising the processing of personal data — **a separate answer, and this is the whole
   * point of there being two.**
   *
   * These were one checkbox reading "Autorizo el tratamiento de mis datos personales y acepto los
   * Términos". They are not one thing: accepting a contract is agreeing to what the parties owe
   * each other, and authorising data processing is the act Ley 1581 requires, which has to be
   * **free, prior, express and informed**. Bundling them means neither is expressly given — the
   * person clicked once and the record cannot say which of the two they were answering.
   *
   * Both are still required, and that is not the same defect: what vitiates an authorisation is
   * the bundling, not the requirement. The product genuinely cannot run without processing the
   * data it is given, and it says so.
   */
  authorizesDataTreatment: z.boolean().refine((value) => value === true, {
    error: "Debes autorizar el tratamiento de tus datos personales",
  }),

  /**
   * Which version of each document is being authorised.
   *
   * Submitted by the form and pinned to the constant, exactly as `clauseVersion` is pinned to
   * `SIGNATURE_CLAUSE_VERSION`: a tab left open across a policy change must not be able to record
   * consent to a wording that no longer exists. It is also what makes the stored record
   * reconstructible — Decreto 1074 art. 2.2.2.25.2.4 puts the burden of proving the authorisation
   * on us, and a proof that does not name what was authorised proves nothing.
   */
  termsVersion: z.coerce
    .number()
    .int()
    .refine((value) => value === currentVersion("terms"), {
      error: "Los Términos cambiaron. Recarga la página para ver la versión vigente.",
    }),
  privacyVersion: z.coerce
    .number()
    .int()
    .refine((value) => value === currentVersion("privacy"), {
      error: "La Política cambió. Recarga la página para ver la versión vigente.",
    }),
});

export type AccountDetailsValues = z.output<typeof accountDetailsSchema>;
export type AccountDetailsFormValues = z.input<typeof accountDetailsSchema>;

/** What the Server Action validates (after transformation). */
export type CompleteProfileInput = z.output<typeof completeProfileSchema>;

/**
 * What the form handles (before transformation). It differs from the output: the number is
 * normalized, the two consents start at `false` and an unanswered gender is `undefined` rather
 * than `null`.
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
