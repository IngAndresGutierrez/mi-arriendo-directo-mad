/**
 * Colombian pesos. Money is always handled as **whole pesos, never a float**: cents do not
 * exist in a rental contract here, and a float would drift.
 *
 * The formatter is hoisted: `Intl.NumberFormat` is expensive to build and this runs inside
 * lists.
 */
/** Grouping only, no currency symbol: what a money input shows while it is being typed. */
const GROUPING = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** `1800000` → `"$ 1.800.000"`. */
export function formatCOP(amount: number): string {
  return COP.format(amount);
}

/**
 * What a tenant actually pays every month: rent plus the building's admin fee.
 *
 * They are stored apart because a landlord quotes them apart, and because the admin fee is
 * the number tenants forget until they sign.
 */
export function monthlyTotal(rent: number, adminFee: number): number {
  return rent + adminFee;
}

/** Twelve digits is a hundred billion pesos: past any real rent, and short of overflow. */
export const MAX_AMOUNT_DIGITS = 12;

/**
 * Everything that is not a digit, dropped — and capped.
 *
 * This is what a money input keeps in state: separators are presentation, and
 * `Number("1.800.000")` is `NaN`, so a formatted string must never reach the schema.
 */
export function toDigits(value: string, maxDigits: number = MAX_AMOUNT_DIGITS): string {
  return value.replace(/\D/g, "").slice(0, maxDigits);
}

/** `"1800000"` → `"1.800.000"`. Empty in, empty out: a zero would fight the placeholder. */
export function groupThousands(digits: string): string {
  return digits === "" ? "" : GROUPING.format(Number(digits));
}
