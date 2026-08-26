import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Signing in, signing up and completing a profile are not search results.
 *
 * There is no chrome to compose here — `AuthShell` is the two-column layout each of those pages
 * brings itself — so this file exists for one line: the `robots` every page in the group inherits.
 *
 * **Nothing in this group overrides it any more.** It used to: `(auth)/page.tsx` was `/`, because a
 * route group does not change the URL, so the login was also the site root and the one page
 * somebody searching the brand had to land on — and it had to buy its way back to `index: true`
 * against this very file. The landing owns the root now and the login sits at `/ingresar`, so the
 * group's rule finally applies to the whole group.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
