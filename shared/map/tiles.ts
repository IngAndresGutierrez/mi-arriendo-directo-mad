/**
 * Where the map's pictures come from.
 *
 * **OpenStreetMap's own tile servers, and that is a decision with an expiry date.** They are free
 * and need no key, which is why the map exists at all without a new secret in Vercel — but the
 * OSMF tile usage policy is written for *light* use by *small* sites, and a public property
 * catalogue that takes off is neither. It also has no uptime guarantee and no right to be there:
 * it is a volunteer service.
 *
 * So this file is one constant and one attribution string on purpose. When traffic arrives, the
 * change is a keyed provider (MapTiler, Stadia, Protomaps) in `TILE_URL` plus its key as a
 * `NEXT_PUBLIC_*` variable, and nothing else in the product moves. What must **not** happen is
 * that decision being made silently by growth.
 *
 * Attribution is not optional: ODbL requires it, and `MapCanvas` renders it into Leaflet's own
 * control rather than leaving it to each caller to remember.
 */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** As deep as the tiles go. Every map here stops well short of it; see each component. */
export const TILE_MAX_ZOOM = 19;

/**
 * Loads Leaflet, on the client, when somebody actually needs a map.
 *
 * ~150 KB of JavaScript and its stylesheet. It is behind a `next/dynamic` boundary in both
 * components that use it, so the only two screens in the product that pay for it are the publish
 * form and a property's detail page. `CLAUDE.md` records what a careless import costs here: 630 KB
 * of Firebase SDK on the login screen.
 *
 * The CJS/ESM dance is Leaflet's: it ships UMD, so a bundler may hand back the namespace or the
 * default export depending on how it interoperates.
 */
export async function loadLeaflet(): Promise<typeof import("leaflet")> {
  // Not named `module`: Next forbids assigning that identifier, because it shadows the CommonJS
  // one and breaks the bundler's own interop.
  const loaded = await import("leaflet");
  return (loaded as unknown as { default?: typeof import("leaflet") }).default ?? loaded;
}
