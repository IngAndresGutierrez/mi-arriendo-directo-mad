import type { PropertyPhoto, PropertyVideo } from "../domain/property";

type PropertyVideoPlayerProps = {
  readonly video: PropertyVideo;
  /** The listing's cover photo, used as the poster frame. Absent on a listing with no photos. */
  readonly cover?: PropertyPhoto;
  /** Accessible name for the player, resolved by the page: "Video de {título}". */
  readonly label: string;
  /** The escape hatch beside the player, for a browser that cannot decode this file. */
  readonly fallbackNote: string;
  readonly fallbackAction: string;
};

/**
 * The listing's walkthrough, on the public detail page.
 *
 * **It is a Server Component, and that is the whole implementation.** `<video controls>` is a
 * complete media player with keyboard support, a scrubber, volume and full-screen already built
 * into every browser — so there is no `"use client"`, no hydration and not one byte of JavaScript
 * added to the most-fetched page on the site. Leaflet is behind `next/dynamic` because it has no
 * such equivalent; reaching for a player library here would have bought nothing and cost the same.
 *
 * Three decisions worth keeping:
 *
 * - **`preload="none"`, and the poster is the cover photo.** This is a public page whose LCP
 *   matters and whose readers are mostly on a Colombian mobile plan, so a 50 MB file must not be
 *   fetched by anybody who did not ask to watch it. What makes that acceptable rather than a blank
 *   grey box is the poster: a still that is already on the page, already public, already cached —
 *   so the player looks like the listing before a single video byte moves. `metadata` would still
 *   open a connection per visitor for a duration nothing displays.
 * - **Never `autoPlay`.** A listing that starts making noise on open is the reason people close
 *   tabs, and on a metered connection it spends somebody's data without being asked.
 * - **The fallback link is beside the player, not inside it.** Content inside `<video>` renders
 *   only for a browser with no `<video>` element at all, which in 2026 is none of them — what
 *   actually happens is a browser that *has* the element and cannot decode the **file**, and it
 *   answers with an empty player and no explanation. That is the real failure mode here, because
 *   an iPhone records `.mov` (HEVC) by default and Chrome frequently cannot play it. So the way
 *   out is always on the page: one line, and a link that opens the file itself.
 */
export function PropertyVideoPlayer({
  video,
  cover,
  label,
  fallbackNote,
  fallbackAction,
}: PropertyVideoPlayerProps) {
  return (
    <div className="space-y-2">
      <video
        controls
        preload="none"
        playsInline
        poster={cover?.url}
        aria-label={label}
        className="aspect-video w-full rounded-2xl border border-border bg-muted"
      >
        {/*
          `type` comes off the stored contentType, which the schema constrains to the three
          containers the Storage rules also accept: it is what lets a browser decide not to fetch
          50 MB it cannot decode.
        */}
        <source src={video.url} type={video.contentType} />
      </video>

      <p className="text-xs text-muted-foreground">
        {fallbackNote}{" "}
        {/*
          A plain anchor and not the product's `LocaleLink`: this is a Cloud Storage URL, which
          `localeHref` correctly leaves alone, and `target="_blank"` here is not the `NewTabLink`
          rule about legal documents — it is a media file that must not replace the listing
          somebody is reading. `rel` because the destination is outside this origin.
        */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline dark:text-foreground"
        >
          {fallbackAction}
        </a>
      </p>
    </div>
  );
}
