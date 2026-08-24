"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

import { cn } from "@/shared/lib/utils";

import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL, loadLeaflet } from "./tiles";

/**
 * What `onReady` receives: the map, and the Leaflet module that made it.
 *
 * The module comes with it so a caller can draw a circle or read a coordinate without importing
 * Leaflet itself — which would put those 150 KB back into the caller's chunk and defeat the whole
 * dynamic boundary.
 */
export type MapHandle = {
  readonly map: LeafletMap;
  readonly L: typeof import("leaflet");
};

type MapCanvasProps = {
  /**
   * Called once, when the map exists. **This is where the view is set and everything is drawn**:
   * the canvas itself takes no centre and no zoom, because a prop that changed would mean
   * rebuilding the map, and rebuilding a map somebody is dragging is a map that fights back.
   *
   * Return a cleanup function to undo whatever was drawn.
   */
  readonly onReady: (handle: MapHandle) => void | (() => void);
  /** What a screen reader is told this map is. There is no generic answer, so it is required. */
  readonly label: string;
  readonly className?: string;
  /**
   * Whether the wheel zooms. **Default `false`, and that default is the point**: a map that eats
   * the scroll wheel is a map that traps the page, and every one here sits inside something
   * longer than the screen. Dragging, the `+`/`−` buttons and the arrow keys still work.
   */
  readonly scrollWheelZoom?: boolean;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  /**
   * How far one press of an arrow key pans, in pixels. Leaflet's default of 80 is a scroll; a
   * map used to place a point wants a nudge.
   */
  readonly keyboardPanDelta?: number;
};

/**
 * A Leaflet map in a box, and nothing else.
 *
 * It owns exactly three things nobody should have to write twice: loading Leaflet, pointing it at
 * the tiles with their attribution, and taking the map down again on unmount — Leaflet keeps
 * global listeners, so a map that is not `remove()`d survives its own component and throws on the
 * next render.
 *
 * **A map that cannot load is a missing picture, not a broken page.** Tiles come from a third
 * party over the network; if the module or the tiles never arrive, the box says so and the page
 * around it — which carries the same information in words — is untouched. Same contract as the
 * live-update hooks: degrading quietly beats failing loudly for something decorative.
 */
export function MapCanvas({
  onReady,
  label,
  className,
  scrollWheelZoom = false,
  minZoom,
  maxZoom = TILE_MAX_ZOOM,
  keyboardPanDelta,
}: MapCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  /*
   * `onReady` in a ref, and the effect below deliberately does not depend on it. A caller
   * defines it inline, so it is a new function on every render — as a dependency it would tear
   * the map down and build it again on each keystroke of the form it sits in.
   */
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let map: LeafletMap | null = null;
    let dispose: (() => void) | undefined;
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        // The user navigated away while Leaflet was in flight, or React ran the effect twice.
        if (cancelled || box.dataset.mounted === "true") return;
        box.dataset.mounted = "true";

        map = L.map(box, {
          scrollWheelZoom,
          minZoom,
          maxZoom,
          zoomControl: true,
          attributionControl: true,
          ...(keyboardPanDelta === undefined ? {} : { keyboardPanDelta }),
        });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: TILE_MAX_ZOOM }).addTo(map);

        dispose = readyRef.current({ map, L }) ?? undefined;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      dispose?.();
      map?.remove();
      delete box.dataset.mounted;
    };
  }, [scrollWheelZoom, minZoom, maxZoom, keyboardPanDelta]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border bg-muted px-4 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No pudimos cargar el mapa. La ubicación está descrita arriba.
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      role="application"
      aria-label={label}
      className={cn("z-0 rounded-xl border border-border bg-muted", className)}
    />
  );
}
