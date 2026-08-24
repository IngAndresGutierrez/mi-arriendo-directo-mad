/**
 * Which cities this product actually has listings in, and how many.
 *
 * The landing leads with them — "Manizales · 12 inmuebles" — for the same reason the catalogue's
 * facets carry counts: a city with a number beside it is a promise the next page can keep, and a
 * city without one is an invitation to an empty result. Everything here is derived from the same
 * `listAvailableProperties()` read the catalogue already does, so the landing costs one query and
 * not one per city.
 *
 * Pure, like the rest of `domain/`: it takes the listings and returns the tally.
 */
import type { Property } from "./property";

/** A city with published listings, ready to render as a link into the catalogue. */
export type CityCount = {
  readonly city: string;
  readonly department: string;
  /** How many `available` listings that city has. Never zero: a zero is simply not in the list. */
  readonly count: number;
  /** The most recent listing's cover, so the card has a photo without a second read. */
  readonly cover: string | null;
};

/**
 * The cities with listings, busiest first.
 *
 * **Ties break alphabetically rather than by whatever order Firestore returned.** Two cities with
 * four listings each would otherwise swap places between two renders of the same data, which on a
 * landing page reads as the grid shuffling itself while you look at it.
 *
 * The cover is the first photo of the **most recently published** listing in that city, not of
 * whichever one happened to come first: a landing that keeps showing the same photo for a month
 * after ten new listings arrived is a landing nobody believes is live. `createdAt` is an ISO
 * string, so a string comparison is the date comparison.
 *
 * A city whose every listing has no photo yields `cover: null` — the caller renders the card
 * without one rather than leaving a hole, because "no photos" is a normal state for a listing
 * published five minutes ago.
 */
export function countCities(properties: readonly Property[], limit = Number.POSITIVE_INFINITY): readonly CityCount[] {
  const byCity = new Map<string, { department: string; count: number; cover: string | null; newest: string }>();

  for (const property of properties) {
    const city = property.area.city;
    const cover = property.photos[0]?.url ?? null;
    const existing = byCity.get(city);

    if (!existing) {
      byCity.set(city, {
        department: property.area.department,
        count: 1,
        cover,
        newest: property.createdAt,
      });
      continue;
    }

    existing.count += 1;

    // A newer listing replaces the cover; one with no photo never blanks a cover already found.
    if (property.createdAt > existing.newest && cover !== null) {
      existing.cover = cover;
      existing.newest = property.createdAt;
    } else if (existing.cover === null && cover !== null) {
      existing.cover = cover;
    }
  }

  return [...byCity.entries()]
    .map(([city, tally]) => ({
      city,
      department: tally.department,
      count: tally.count,
      cover: tally.cover,
    }))
    .sort((a, b) => (b.count - a.count) || a.city.localeCompare(b.city, "es-CO"))
    .slice(0, limit);
}

/**
 * The listings the landing puts on screen, newest first.
 *
 * **A listing with no photo is skipped**, and that is the one rule here worth stating: this is a
 * shop window, and a card reading "Sin fotos" beside three photographed ones does that landlord no
 * favours and this product none either. The catalogue still lists it — there the tenant asked to
 * see everything — so nothing is hidden, it is only not the thing we lead with.
 *
 * `listAvailableProperties()` already orders by `createdAt` desc, so this preserves that order
 * rather than re-sorting it: the tie-break for two listings published in the same second is
 * whatever Firestore said, and it does not matter.
 */
export function showcaseListings(properties: readonly Property[], limit: number): readonly Property[] {
  return properties.filter((property) => property.photos.length > 0).slice(0, limit);
}
