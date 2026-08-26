import type { ReactNode } from "react";

import { LandingChrome } from "./landing-chrome";

/**
 * The public front door wears its own chrome.
 *
 * A route group of its own rather than folding the landing into `(public)`: that group is the
 * catalogue, and its layout is a `lg:fixed lg:inset-0` frame built so the facets never scroll out
 * of view. A landing is one long scroll. The group also leaves room for the second marketing page
 * this will want — a landlord's landing — without either of them having to re-derive the header.
 *
 * There is deliberately **no `loading.tsx`** here, and it is the same reason the catalogue has
 * none: a boundary over a segment sits over everything under it, and a route that answers with a
 * streamed fallback has already flushed a `200`. This is the one page search engines are most
 * likely to fetch, so a soft anything is a real cost. The listings stream from a `<Suspense>`
 * inside the page instead, which reaches only the part that waits on Firestore.
 */
export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return <LandingChrome>{children}</LandingChrome>;
}
