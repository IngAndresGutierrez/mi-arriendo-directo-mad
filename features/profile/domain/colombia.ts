/**
 * Colombian geography and contact data.
 *
 * The territorial division is department + city: there is no "state/province" and no postal
 * code, which is barely used in Colombia.
 *
 * Dial codes and per-country rules live in `shared/phone/countries.ts`.
 */

/** The 32 departments plus the Capital District, alphabetically. */
export const DEPARTMENTS = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/**
 * Gender options.
 *
 * Sensitive data under Colombian Law 1581 of 2012, so "prefer not to say" is a first-class
 * option, not an omission.
 */
export const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;

export type Gender = (typeof GENDERS)[number];

// The labels are copy: the product speaks to the user in es-CO.
const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  female: "Femenino",
  male: "Masculino",
  non_binary: "No binario",
  prefer_not_to_say: "Prefiero no decirlo",
};

/** Derived from `GENDERS`: the list and the labels cannot drift apart. */
export const GENDER_OPTIONS = GENDERS.map((value) => ({
  value,
  label: GENDER_LABELS[value],
}));

/**
 * The role every account is born with.
 *
 * Onboarding no longer asks for the role, so the least privileged one applies: a tenant
 * cannot publish properties. Becoming a `landlord` needs a separate flow (the role lives
 * in custom claims and only the Admin SDK changes it).
 */
export const DEFAULT_USER_ROLE = "tenant";

/** Minimum age to sign a rental contract in Colombia. */
export const MIN_AGE = 18;
/** Defensive cap: discards absurd or mistyped dates. */
export const MAX_AGE = 110;
