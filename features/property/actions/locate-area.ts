"use server";

import { requireCompleteProfile } from "@/features/profile";
import { isMunicipalityOf } from "@/shared/geo/municipalities";
import { DEPARTMENTS, type Department } from "@/shared/geo/colombia";
import { isGeoPoint, isInColombia, roundPoint, type GeoPoint } from "@/shared/geo/point";
import { SUPPORT_EMAIL } from "@/shared/lib/support-contact";

export type LocateAreaResult =
  | { readonly ok: true; readonly point: GeoPoint }
  | { readonly ok: false; readonly message: string };

/** Nominatim's terms require an identifiable client with a way to be contacted. */
const USER_AGENT = `miarriendodirecto.com (${SUPPORT_EMAIL})`;

/** Long enough for a cold geocoder, short enough that a button does not hang. */
const TIMEOUT_MS = 6_000;

/**
 * Centres the picker on a neighbourhood, so the landlord does not start from a map of Colombia.
 *
 * **It is asked only what the listing already publishes**: the barrio, the city and the
 * department. Not the street, and this is the whole shape of the thing rather than an oversight —
 * the street is what `properties/{id}/private/location` exists to keep, and sending it to a
 * third party's servers to be logged would give it away through the back door, to nobody's
 * benefit. The neighbourhood is enough to land within a few hundred metres, and the landlord
 * moves the map the rest of the way. That last part is theirs to do anyway: only they know which
 * building it is.
 *
 * OpenStreetMap's Nominatim: free, no key, and therefore no new secret in Vercel. Its terms are
 * one request per second from an identified client, which a form somebody fills in once is
 * comfortably inside — and it may still answer nothing, because OSM's coverage of small
 * Colombian towns is thin. **Nothing is the expected answer, not an error**: the picker opens on
 * the country and says so, and the point is placed by hand as it always could be.
 *
 * It requires a session for the same reason every action does, plus one of its own: an
 * unauthenticated route that forwards to somebody else's geocoder is an open proxy, and the abuse
 * would arrive under this product's name.
 */
export async function locateArea(input: {
  readonly neighborhood: string;
  readonly city: string;
  readonly department: string;
}): Promise<LocateAreaResult> {
  await requireCompleteProfile();

  const department = (DEPARTMENTS as readonly string[]).includes(input.department)
    ? (input.department as Department)
    : null;
  const city = input.city.trim();

  // The pair is validated here too, not just in the form: "Manizales, Antioquia" is a place that
  // does not exist, and asking a geocoder for it returns something confidently wrong.
  if (!department || !isMunicipalityOf(city, department)) {
    return { ok: false, message: "Elige primero el departamento y la ciudad." };
  }

  const query = [input.neighborhood.trim(), city, department, "Colombia"]
    .filter((part) => part.length > 0)
    .join(", ");

  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?format=jsonv2&limit=1&countrycodes=co&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // The answer for one barrio does not change; and it keeps a landlord who presses the
      // button twice from spending two requests against a rate limit.
      cache: "force-cache",
    });
    if (!response.ok) return offline();

    const body: unknown = await response.json();
    const first = Array.isArray(body) ? body[0] : null;
    if (typeof first !== "object" || first === null) return notFound(city);

    const { lat, lon } = first as { lat?: unknown; lon?: unknown };
    // Nominatim returns them as strings, every time, and its own docs do not promise otherwise.
    const point = { lat: Number(lat), lng: Number(lon) };

    if (!isGeoPoint(point) || !isInColombia(point)) return notFound(city);

    return { ok: true, point: roundPoint(point) };
  } catch {
    // A timeout, a refused connection, a rate limit: all the same thing to the landlord, who
    // still has a map they can move.
    return offline();
  }
}

function offline(): LocateAreaResult {
  return {
    ok: false,
    message: "No pudimos buscar el barrio en este momento. Mueve el mapa para ubicar el inmueble.",
  };
}

function notFound(city: string): LocateAreaResult {
  return {
    ok: false,
    message: `No encontramos ese barrio en ${city}. Mueve el mapa para ubicar el inmueble.`,
  };
}
