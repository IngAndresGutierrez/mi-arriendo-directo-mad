"use client";

import type { Dictionary } from "@/shared/i18n";
import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { MapPinIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { FieldHint } from "@/shared/form/field-hint";
import { formatPoint, type GeoPoint } from "@/shared/geo/point";

import { locateArea } from "../actions/locate-area";
import { APPROX_RADIUS_M } from "../domain/property";

/**
 * Leaflet is ~150 KB and its own chunk. Nobody who is not publishing or editing a listing ever
 * downloads it; no SSR, because Leaflet reads `window` the moment it is imported.
 */
const LocationPickerCanvas = dynamic(
  () => import("./location-picker-canvas").then((module) => module.LocationPickerCanvas),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" /> },
);

/**
 * Where the property is on the map, in the publish form.
 *
 * Two things about this control are product decisions rather than layout:
 *
 * **It is optional, and it says so.** A landlord whose street is not drawn in OpenStreetMap — in
 * rural Colombia, most of them — must still be able to publish, and every listing that existed
 * before this control has no point and has to survive its own edit form. So there is no error
 * state for "you did not place it": the listing simply describes its location in words, as it did.
 *
 * **It tells the truth about what gets published.** The landlord is placing a precise point, and
 * a precise point is the address — so the copy says, at the moment of placing it, that what
 * appears on the listing is a circle of {@link APPROX_RADIUS_M} metres and not this. Learning that
 * afterwards, from the public page, would be learning that the product had been vaguer with them
 * than it was with strangers.
 */
export function LocationPicker({
  value,
  onChange,
  area,
  copy,
}: {
  readonly value: GeoPoint | null;
  readonly onChange: (point: GeoPoint | null) => void;
  /** The public half of the address — the only part the barrio search is allowed to use. */
  readonly area: {
    readonly neighborhood: string;
    readonly city: string;
    readonly department: string;
  };
  /**
   * Its words, resolved by the page that mounts the form. A prop and not a dictionary import: this
   * is a Client Component, and importing the dictionary would put both languages in the bundle.
   */
  readonly copy: Dictionary["propertyForm"];
}) {
  const [focus, setFocus] = useState<{ point: GeoPoint; nonce: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const canSearch = area.city.trim().length > 0 && area.department.trim().length > 0;

  function search() {
    setNotice(null);
    startSearch(async () => {
      const result = await locateArea(area);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      // The canvas reports the coordinate itself once it has moved there, so this only aims it.
      setFocus((current) => ({ point: result.point, nonce: (current?.nonce ?? 0) + 1 }));
    });
  }

  const place = useCallback(
    (point: GeoPoint) => {
      setNotice(null);
      onChange(point);
    },
    [onChange],
  );

  /*
   * `copy.zoomIn` is in the deps now that the sentence comes from a prop: the callback is handed to
   * the map and held across renders, so an empty array would freeze the message in whichever
   * language was loaded when the picker first mounted.
   */
  const tooFar = useCallback(() => {
    setNotice(copy.zoomIn);
  }, [copy.zoomIn]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label htmlFor="address-map" className="block">
          {copy.mapLabel}
        </Label>
        <FieldHint id="address-map-hint" label={copy.mapHintField}>
          {copy.mapHintBefore} {APPROX_RADIUS_M} {copy.mapHintAfter}
        </FieldHint>
        <span className="text-sm text-muted-foreground">{copy.optional}</span>
      </div>

      <p className="text-sm text-muted-foreground">
        {copy.mapInstructions}{" "}<kbd className="rounded border border-border px-1 text-xs">+</kbd> y{" "}
        <kbd className="rounded border border-border px-1 text-xs">−</kbd> {copy.mapInstructionsZoom}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="brand"
          size="xl"
          onClick={search}
          disabled={!canSearch || searching}
        >
          <SearchIcon className="size-4" aria-hidden="true" />
          {searching ? copy.searchingNeighborhood : copy.centerOnNeighborhood}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="xl"
            onClick={() => {
              setNotice(null);
              onChange(null);
            }}
          >
            <XIcon className="size-4" aria-hidden="true" />
            Quitar del mapa
          </Button>
        )}
      </div>

      <div id="address-map">
        <LocationPickerCanvas
          value={value}
          onChange={place}
          onZoomTooFar={tooFar}
          focus={focus}
        />
      </div>

      {/*
        The readout is `aria-live` because the map is the control and its value is not visible to
        a screen reader: panning with the arrow keys has to say what it did, or the keyboard path
        is a control with no feedback.
      */}
      <p aria-live="polite" className="flex items-start gap-2 text-sm">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? (
            <>
              {copy.pointMarked} <strong className="font-medium">{formatPoint(value)}</strong>
            </>
          ) : (
            copy.noPoint
          )}
        </span>
      </p>

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  );
}
