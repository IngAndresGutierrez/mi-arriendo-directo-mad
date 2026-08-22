/**
 * Colombian pesos. Money is always handled as **whole pesos, never a float**: cents do not
 * exist in a rental contract here, and a float would drift.
 *
 * The formatter is hoisted: `Intl.NumberFormat` is expensive to build and this runs inside
 * lists.
 */
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
