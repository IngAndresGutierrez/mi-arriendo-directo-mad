"use client";

import { useCallback, useEffect, useRef } from "react";
import { CrosshairIcon } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";

import { MapCanvas, type MapHandle } from "@/shared/map/map-canvas";
import {
  COLOMBIA_FALLBACK_CENTER,
  COLOMBIA_FALLBACK_ZOOM,
  roundPoint,
  type GeoPoint,
} from "@/shared/geo/point";

/**
 * How far in the map has to be before the crosshair means anything.
 *
 * At zoom 14 a screen pixel is about seven metres and the view is a neighbourhood; below that,
 * "the middle of the map" is a district, and recording it as the property's location would
 * publish a zone the listing's own barrio already describes better. So a pan at country zoom
 * places nothing — which is also what stops a landlord who idly drags the map from silently
 * attaching a point in the wrong department to their listing.
 */
export const MIN_PICK_ZOOM = 14;

/** Where the map lands when the barrio search worked, or when a point already exists. */
const PLACED_ZOOM = 17;

/**
 * The map the landlord places the property on.
 *
 * **The point is the centre of the map, marked by a fixed crosshair — there is no marker to
 * drag.** That is not a simplification, it is what makes the control usable by everyone. A
 * draggable pin cannot be operated with a keyboard at all, and it is a poor target for a thumb;
 * moving the map under a crosshair is the pattern every delivery app in Colombia uses, and
 * Leaflet already pans with the arrow keys and zooms with `+`/`−`. So the accessible path is not
 * a separate escape hatch bolted on beside the real control — it is the same control. (The
 * signature pad had to grow "Usar mi nombre como firma" for exactly the gap this design does not
 * open.)
 *
 * It reports on `moveend`, so the value always matches what is under the crosshair: what you see
 * is what is stored. Two guards keep that honest — nothing is reported below `MIN_PICK_ZOOM`, and
 * the listener is attached *after* the opening view is set, so a landlord who never touches the
 * map never acquires a point.
 */
export function LocationPickerCanvas({
  value,
  onChange,
  onZoomTooFar,
  focus,
}: {
  readonly value: GeoPoint | null;
  readonly onChange: (point: GeoPoint) => void;
  /** Told when the map moved but is still too far out for the centre to mean anything. */
  readonly onZoomTooFar: () => void;
  /**
   * A point to fly to — the result of the barrio search. It carries a nonce because the landlord
   * may search the same barrio twice, and an identical coordinate would not re-trigger anything.
   */
  readonly focus: { readonly point: GeoPoint; readonly nonce: number } | null;
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  /*
   * The callbacks and the opening point live in refs so that mounting the map depends on nothing.
   * As dependencies they would tear the map down and rebuild it every time the form re-renders —
   * which, since the map reports a coordinate, is every time the map moves.
   */
  const openAt = useRef(value);
  const changed = useRef(onChange);
  const tooFar = useRef(onZoomTooFar);
  useEffect(() => {
    changed.current = onChange;
    tooFar.current = onZoomTooFar;
  }, [onChange, onZoomTooFar]);

  const start = useCallback(({ map }: MapHandle) => {
    mapRef.current = map;

    // The opening view: the point if there is one, otherwise the country.
    const opening = openAt.current;
    map.setView(
      opening
        ? [opening.lat, opening.lng]
        : [COLOMBIA_FALLBACK_CENTER.lat, COLOMBIA_FALLBACK_CENTER.lng],
      opening ? PLACED_ZOOM : COLOMBIA_FALLBACK_ZOOM,
    );

    /*
     * Attached only now, on purpose. `setView` fires `moveend` like any other movement, so a
     * listener registered before it would have reported the country's centre as the property's
     * location for every landlord who opened the form and edited a title.
     */
    const report = () => {
      if (map.getZoom() < MIN_PICK_ZOOM) {
        tooFar.current();
        return;
      }
      const center = map.getCenter();
      changed.current(roundPoint({ lat: center.lat, lng: center.lng }));
    };
    map.on("moveend", report);

    return () => {
      map.off("moveend", report);
      mapRef.current = null;
    };
  }, []);

  /*
   * The barrio search, applied. `setView` here fires `moveend`, which reports the coordinate — so
   * the search does not need to set the value itself, and cannot disagree with the crosshair
   * about what it set. The effect keys on `focus`, whose identity the caller only changes when
   * there is a new search to honour.
   */
  useEffect(() => {
    if (!focus) return;
    mapRef.current?.setView([focus.point.lat, focus.point.lng], PLACED_ZOOM);
  }, [focus]);

  return (
    <div className="relative">
      <MapCanvas
        label="Mapa para ubicar el inmueble. Usa las flechas para mover y + o − para acercar."
        className="h-72 w-full sm:h-80"
        minZoom={5}
        // A nudge, not a scroll: this map is used to land on a building.
        keyboardPanDelta={30}
        onReady={start}
      />
      {/*
        The crosshair. `pointer-events-none` so it never swallows a drag meant for the map
        underneath, and `aria-hidden` because it is not the information — the coordinate below the
        map is, and that one is announced.

        **It sits on a translucent chip**, which is the same answer `CLAUDE.md` records for the
        purple logo on the purple panel: the mark is brand purple and the thing behind it is
        somebody else's imagery, so its contrast is not something this product controls. A drop
        shadow was the first attempt and it is not enough — over a dark tile the crosshair
        disappears, and this is the one control on the screen whose whole job is to be found.
      */}
      <div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="rounded-full bg-background/75 p-1.5 shadow-sm ring-1 ring-brand-panel/20">
          <CrosshairIcon className="size-8 text-brand-panel" />
        </span>
      </div>
    </div>
  );
}
