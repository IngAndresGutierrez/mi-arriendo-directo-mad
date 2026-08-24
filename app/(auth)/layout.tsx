import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Signing up and completing a profile are not search results.
 *
 * There is no chrome to compose here — `AuthShell` is the two-column layout each of those pages
 * brings itself — so this file exists for one line: the `robots` every page in the group inherits.
 *
 * **`/` is in this group and must override it.** A route group does not change the URL, so
 * `(auth)/page.tsx` *is* the site root: the login and the front door at the same time, and the one
 * page somebody searching the brand has to be able to land on. It sets its own `robots`, and the
 * reason is written there rather than only here, because that is the file somebody would delete
 * the line from.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
