import { redirect } from "next/navigation";

import { CONTRACTS_ROUTE } from "@/shared/auth/routes";

/**
 * The bridge from what this section used to be to what it is now.
 *
 * `/arriendos` used to hold the nine-stage process, which is really the negotiation that *ends*
 * in a signed contract — so it is `/contratos` now, and the tenancy that starts afterwards is
 * what will live here.
 *
 * **A 307, never a 301.** These URLs are coming back with a different meaning: this file is the
 * one that will render the tenancy. A permanent redirect is cached by the browser more or less
 * forever, so everyone who passed through it today would never reach the page that replaces it.
 * For the same reason the redirect is here and not in `next.config.ts`: redirects are resolved
 * before routing, so a rule there would shadow the route this file becomes.
 */
export default function RentalsBridge() {
  redirect(CONTRACTS_ROUTE);
}
