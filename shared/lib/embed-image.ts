/**
 * A remote image as a `data:` URI, or `null`.
 *
 * This exists because of how satori fails. Handed a remote `<img src>`, it fetches the URL itself
 * during the layout pass — and a 404, a timeout or a Cloud Storage hiccup throws from inside that
 * pass and takes the **whole image** with it. A missing photograph becomes a missing card, or a
 * missing poster, and the caller never gets to decide otherwise.
 *
 * Fetching here turns that into a value: `null` is something a composition can answer to, and both
 * callers answer differently — the Open Graph card and the rental notice each fall back to a
 * different layout rather than to the same one with a hole in it.
 *
 * It never throws, for the same reason `notify()` and `listNotifications()` do not: the callers are
 * image routes fetched by a crawler that will not come back and ask again, and by a print dialog
 * with a person waiting in front of it.
 */

/** Long enough for Cloud Storage on a bad day, short enough that a crawler does not give up. */
const DEFAULT_TIMEOUT_MS = 4_000;

/** Beyond this, embedding costs more memory than the image is worth. Landlords upload from a phone. */
const DEFAULT_MAX_BYTES = 5_000_000;

export async function embedRemoteImage(
  url: string,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    label = url,
  }: {
    readonly timeoutMs?: number;
    readonly maxBytes?: number;
    /** What to name in the log when it fails. A property id says more than a signed URL. */
    readonly label?: string;
  } = {},
): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;

    /*
     * The content type is checked rather than assumed: the bucket serves what was uploaded, and
     * an HTML error page with a 200 on it would otherwise be embedded as if it were a photograph.
     */
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;

    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.error(`embedRemoteImage: could not read ${label}:`, error);

    return null;
  }
}
