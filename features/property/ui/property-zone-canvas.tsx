"use client";

import { useCallback } from "react";

import { MapCanvas, type MapHandle } from "@/shared/map/map-canvas";
import type { GeoPoint } from "@/shared/geo/point";

import { APPROX_RADIUS_M } from "../domain/property";

/**
 * The zone a listing publishes, drawn.
 *
 * Reached only through `property-zone-map.tsx`, which is what keeps Leaflet out of every other
 * chunk in the product: this file is the one that imports it.
 *
 * **A circle, and never a pin.** The point on the public document is already blunted to a cell of
 * about 550 m (`approximateLocation`), so a marker would be a lie twice over: it would claim a
 * precision the coordinate does not have, and it would invite exactly the reading the split
 * between the public document and `private/location` exists to prevent — "the house is *there*".
 * What the circle says is what is true: it is somewhere in here, and the radius is proven in
 * `property.test.ts` rather than chosen to look reassuring.
 *
 * The owner is the one exception. They see their own point inside the circle, because they are the
 * one person who already knows the address and the only one who needs to check they placed it
 * right — the same reason the street itself is on this page for them and nobody else.
 */
export function PropertyZoneCanvas({
  approx,
  exact = null,
}: {
  /** The blunted coordinate from the public document. */
  readonly approx: GeoPoint;
  /** The real one — **only ever passed when the reader is the owner**. */
  readonly exact?: GeoPoint | null;
}) {
  const draw = useCallback(
    ({ map, L }: MapHandle) => {
      map.setView([approx.lat, approx.lng], 15);

      const zone = L.circle([approx.lat, approx.lng], {
        radius: APPROX_RADIUS_M,
        // Tokens through a class, not a hex through an option: Leaflet writes `stroke` and `fill`
        // as presentation attributes and CSS beats those, so the circle follows the theme.
        className: "stroke-brand-panel fill-brand-panel",
        weight: 2,
        opacity: 0.85,
        fillOpacity: 0.12,
      }).addTo(map);

      const pin = exact
        ? L.circleMarker([exact.lat, exact.lng], {
            radius: 6,
            className: "stroke-brand-panel fill-accent",
            weight: 2,
            fillOpacity: 1,
          }).addTo(map)
        : null;

      return () => {
        pin?.remove();
        zone.remove();
      };
    },
    [approx, exact],
  );

  return (
    <div
      className="space-y-2"
      // How a driver asks the product where it thinks the zone is, instead of recomputing the
      // snap and asserting its own copy of the rule.
      data-zone={`${approx.lat},${approx.lng}`}
      data-zone-radius={APPROX_RADIUS_M}
    >
      <MapCanvas
        label="Zona aproximada del inmueble"
        className="h-72 w-full sm:h-80"
        // Below 11 the circle is a dot and the map is a country; past 17 it is a wash of colour
        // over a street it is not claiming. Neither zoom answers a question anybody has here.
        minZoom={11}
        maxZoom={17}
        onReady={draw}
      />
      <p className="text-sm text-muted-foreground">
        El círculo cubre unos {APPROX_RADIUS_M} metros a la redonda: el inmueble está dentro, pero
        el punto exacto no se publica.
        {exact ? " El punto que marcaste solo lo ves tú." : null}
      </p>
    </div>
  );
}
