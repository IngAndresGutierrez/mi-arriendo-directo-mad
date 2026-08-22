import { canonicalMunicipality } from "@/shared/geo/municipalities";

/**
 * Reads the `city` query parameter.
 *
 * A search parameter is user input, and this one goes straight into a Firestore `where`: it is
 * validated against the municipality catalog, so an unknown value becomes "no filter" instead
 * of a query for a place that does not exist. It also comes back in the catalog's own spelling,
 * which is what the stored `area.city` holds.
 *
 * Next hands a repeated parameter (`?city=A&city=B`) as an array; the first one wins rather
 * than the whole thing failing.
 */
export function parseCityFilter(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.trim() === "") return null;

  return canonicalMunicipality(value);
}
