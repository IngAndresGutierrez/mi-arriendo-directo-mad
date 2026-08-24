import type { ReactNode } from "react";

import { PublicChrome } from "@/app/public-chrome";

/**
 * Every page in this group wears the public header. `/soporte` uses the same one when there is no
 * session.
 *
 * **It no longer overrides where the logo goes.** This group used to point the mark at `/inmuebles`,
 * because `/` was the login and sending a visitor there was a dead end. `/` is the landing now, and
 * the shared `PublicHeader` carries an explicit "Inmuebles" link — so "back to the results" has its
 * own control and the mark can mean what it means everywhere else.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicChrome>{children}</PublicChrome>;
}
