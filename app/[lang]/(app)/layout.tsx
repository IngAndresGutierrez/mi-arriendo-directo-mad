import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductChrome } from "@/app/[lang]/product-chrome";

/**
 * **None of this group is for search engines**, and one line here says so for all of it.
 *
 * Metadata is merged down the tree, so every page under `(app)` inherits this unless it sets its
 * own `robots` — which is why `/perfil-inquilino` and `/postularme/<slug>` could each carry their
 * own copy and still be the only two that did. The rest of the portal had nothing.
 *
 * It is not the *only* control: `robots.txt` disallows these paths too, and every page here calls
 * `requireCompleteProfile()`, so a crawler with no session gets a redirect to the login instead of
 * a page. Three layers that fail in different directions — a `Disallow` can still leave a bare URL
 * in the results when somebody links to one, and a `noindex` is only read by a crawler that
 * actually fetched the page.
 *
 * `follow: false` goes with it: these pages link to each other and to `/contratos/<id>`, and there
 * is no reason to send a crawler walking a private workspace.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Every screen behind a session wears the product's chrome, composed once.
 *
 * Each page still guards itself with `requireCompleteProfile()`: a layout does not re-run on
 * every navigation within the group, so authorization cannot live here.
 */
export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return <ProductChrome>{children}</ProductChrome>;
}
