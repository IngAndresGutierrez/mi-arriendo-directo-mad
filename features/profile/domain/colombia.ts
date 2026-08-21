/**
 * Datos geográficos y de contacto de Colombia.
 *
 * La división territorial es departamento + ciudad: no hay "estado/provincia" ni código
 * postal, que en Colombia apenas se usa.
 *
 * Los indicativos telefónicos y las reglas por país viven en `shared/phone/countries.ts`.
 */

/** 32 departamentos más el Distrito Capital, en orden alfabético. */
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
 * Opciones de género.
 *
 * Es un dato sensible bajo la Ley 1581 de 2012, así que "Prefiero no decirlo" es una opción
 * de primera clase, no una omisión.
 */
export const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;

export type Gender = (typeof GENDERS)[number];

// Las etiquetas son copy: el producto le habla al usuario en es-CO.
const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  female: "Femenino",
  male: "Masculino",
  non_binary: "No binario",
  prefer_not_to_say: "Prefiero no decirlo",
};

/** Derivado de `GENDERS`: la lista y las etiquetas no pueden desincronizarse. */
export const GENDER_OPTIONS = GENDERS.map((value) => ({
  value,
  label: GENDER_LABELS[value],
}));

/**
 * Rol con el que nace toda cuenta.
 *
 * El onboarding ya no pregunta el rol, así que se aplica el menos privilegiado: un
 * inquilino no puede publicar inmuebles. Pasar a `propietario` requiere un flujo aparte
 * (el rol vive en custom claims y solo lo cambia el Admin SDK).
 */
export const DEFAULT_USER_ROLE = "tenant";

/** Edad mínima para firmar un contrato de arrendamiento en Colombia. */
export const MIN_AGE = 18;
/** Tope defensivo: descarta fechas absurdas o tecleadas mal. */
export const MAX_AGE = 110;
