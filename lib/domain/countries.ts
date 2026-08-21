/**
 * Países para el selector de teléfono.
 *
 * El producto opera en Colombia, así que **Colombia es el valor por defecto** y encabeza la
 * lista. Los demás existen porque hay propietarios que viven fuera e inquilinos extranjeros:
 * su celular no es colombiano.
 *
 * Lista curada, no exhaustiva: cada indicativo de aquí está verificado. Preferimos una lista
 * corta y correcta a 200 países con códigos inventados. Para agregar uno, añade la entrada
 * y —si su formato es estricto— su regla en `PHONE_RULES`.
 *
 * El `iso` es la clave, no el indicativo: `+1` lo comparten Estados Unidos, Canadá, Puerto
 * Rico y República Dominicana.
 */
export type Country = {
  readonly iso: string;
  readonly name: string;
  readonly dialCode: string;
  readonly flag: string;
};

export const COUNTRIES: readonly Country[] = [
  { iso: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { iso: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { iso: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { iso: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
  { iso: "CA", name: "Canadá", dialCode: "+1", flag: "🇨🇦" },
  { iso: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { iso: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { iso: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { iso: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { iso: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { iso: "ES", name: "España", dialCode: "+34", flag: "🇪🇸" },
  { iso: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" },
  { iso: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { iso: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { iso: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
  { iso: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { iso: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦" },
  { iso: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { iso: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪" },
  { iso: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { iso: "DO", name: "República Dominicana", dialCode: "+1", flag: "🇩🇴" },
  { iso: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { iso: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { iso: "DE", name: "Alemania", dialCode: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "Francia", dialCode: "+33", flag: "🇫🇷" },
  { iso: "IT", name: "Italia", dialCode: "+39", flag: "🇮🇹" },
  { iso: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { iso: "GB", name: "Reino Unido", dialCode: "+44", flag: "🇬🇧" },
];

/** País preseleccionado. */
export const DEFAULT_COUNTRY_ISO = "CO";

/** Tupla de códigos ISO para `z.enum`, sin casts. */
export const COUNTRY_ISO_CODES = COUNTRIES.map((country) => country.iso) as [string, ...string[]];

const BY_ISO = new Map(COUNTRIES.map((country) => [country.iso, country]));

export function findCountry(iso: string): Country | undefined {
  return BY_ISO.get(iso);
}

type PhoneRule = { readonly pattern: RegExp; readonly message: string; readonly example: string };

/**
 * Reglas por país. Solo definimos la de Colombia con precisión: es el caso que nos importa y
 * el que podemos validar sin equivocarnos. Para el resto usamos una regla genérica en vez de
 * inventar formatos nacionales que no podemos verificar.
 */
const PHONE_RULES: Readonly<Record<string, PhoneRule>> = {
  CO: {
    pattern: /^3\d{9}$/,
    message: "El celular colombiano tiene 10 dígitos y empieza por 3",
    example: "300 123 4567",
  },
};

const GENERIC_PHONE_RULE: PhoneRule = {
  pattern: /^\d{6,14}$/,
  message: "Ingresa un número válido, sin el indicativo del país",
  example: "612 345 678",
};

export function phoneRuleFor(iso: string): PhoneRule {
  return PHONE_RULES[iso] ?? GENERIC_PHONE_RULE;
}

/** Número en formato E.164, que es como se almacena: `+573001234567`. */
export function toE164(iso: string, nationalDigits: string): string | null {
  const country = findCountry(iso);
  if (!country) return null;
  return `${country.dialCode}${nationalDigits}`;
}
