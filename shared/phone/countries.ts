/**
 * Countries for the phone selector.
 *
 * The product operates in Colombia, so **Colombia is the default** and heads the list. The
 * rest exist because some landlords live abroad and some tenants are foreigners: their
 * mobile number is not Colombian.
 *
 * A curated list, not an exhaustive one: every dial code here is verified. A short correct
 * list beats 200 countries with made-up codes. To add one, add the entry and — if its
 * format is strict — its rule in `PHONE_RULES`.
 *
 * The `iso` is the key, not the dial code: `+1` is shared by the United States, Canada,
 * Puerto Rico and the Dominican Republic.
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

/** Pre-selected country. */
export const DEFAULT_COUNTRY_ISO = "CO";

/** Tuple of ISO codes for `z.enum`, no casts. */
export const COUNTRY_ISO_CODES = COUNTRIES.map((country) => country.iso) as [string, ...string[]];

const BY_ISO = new Map(COUNTRIES.map((country) => [country.iso, country]));

export function findCountry(iso: string): Country | undefined {
  return BY_ISO.get(iso);
}

type PhoneRule = { readonly pattern: RegExp; readonly message: string; readonly example: string };

/**
 * Per-country rules. Only Colombia is defined precisely: it is the case that matters and the
 * one we can validate without getting it wrong. Everything else falls back to a generic rule
 * instead of inventing national formats we cannot verify.
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

/** Number in E.164, which is how it is stored: `+573001234567`. */
export function toE164(iso: string, nationalDigits: string): string | null {
  const country = findCountry(iso);
  if (!country) return null;
  return `${country.dialCode}${nationalDigits}`;
}
