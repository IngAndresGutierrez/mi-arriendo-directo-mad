"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/shared/ui/skeleton";
import type { GeoPoint } from "@/shared/geo/point";

/**
 * Leaflet and its stylesheet are ~150 KB, and they are of no use to a page nobody scrolls to the
 * location of. Behind `next/dynamic` with no SSR — no SSR because Leaflet reads `window` the
 * moment it is imported, so there is nothing to render on the server anyway.
 *
 * This wrapper exists **because the page that needs it is a Server Component**, and `ssr: false`
 * is not allowed in one. The boundary has to be a client file; this is the smallest possible one.
 */
const PropertyZoneCanvas = dynamic(
  () => import("./property-zone-canvas").then((module) => module.PropertyZoneCanvas),
  {
    ssr: false,
    // The same height the map will have, so the section does not jump when it arrives.
    loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" />,
  },
);

export function PropertyZoneMap({
  approx,
  exact = null,
}: {
  readonly approx: GeoPoint;
  readonly exact?: GeoPoint | null;
}) {
  return <PropertyZoneCanvas approx={approx} exact={exact} />;
}
