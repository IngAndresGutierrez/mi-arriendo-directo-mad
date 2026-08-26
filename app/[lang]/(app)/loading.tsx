import { LoadingScreen, Skeleton } from "@/shared/ui/skeleton";

/**
 * The instant answer to a click, for every screen behind a session.
 *
 * Without it Next waits for the server before swapping the page, and since these screens read
 * Firestore, a click on a slow connection looked like a click that did nothing. The menu and the
 * bell stay interactive — they live in the layout — so what this replaces is the content, which
 * is the part that is actually still coming.
 *
 * A skeleton in the shape of the page, not a spinner: it tells you what is about to appear, and
 * it does not move the layout when the real thing lands.
 */
export default function Loading() {
  return (
    <LoadingScreen>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />

      <div className="mt-8 space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </LoadingScreen>
  );
}
