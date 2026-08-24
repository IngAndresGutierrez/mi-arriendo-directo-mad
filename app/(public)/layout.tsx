import type { ReactNode } from "react";

import { PublicChrome } from "@/app/public-chrome";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";

/**
 * Every page in this group wears the public header. `/soporte` uses the same one when there is no
 * session.
 *
 * **And in this group the logo goes to the catalog**, not to the login. Everything here *is* the
 * catalog — the list of properties and one property's detail — so somebody who opened a listing and
 * presses the mark at the top is asking to go back to the results. Sending them to `/` instead
 * dropped them on a login screen, which for a visitor is a dead end and for somebody already signed
 * in is a redirect out of the thing they were browsing.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicChrome homeHref={PROPERTIES_ROUTE}>{children}</PublicChrome>;
}
