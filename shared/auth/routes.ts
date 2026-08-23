/**
 * Access routes. The URLs are in Spanish because users see them; the identifiers are in
 * English, like the rest of the code.
 *
 * No `server-only` here: both server pages and client components consume this module.
 */

/** Sign-in screen. It is the site root. */
export const LOGIN_ROUTE = "/";
export const SIGNUP_ROUTE = "/registro";
export const PASSWORD_RESET_ROUTE = "/recuperar";
/** Onboarding: there is a session but the profile is not complete yet. */
export const COMPLETE_PROFILE_ROUTE = "/registro/completar-perfil";

/** Where a freshly authenticated user lands. */
export const HOME_ROUTE = "/inicio";

/** Public catalog of properties. Not built yet — see PROPERTY_DETAIL below. */
export const PROPERTIES_ROUTE = "/inmuebles";
/** Where a landlord publishes. Static segment, so it never collides with a property id. */
export const PUBLISH_PROPERTY_ROUTE = "/inmuebles/publicar";
/** A landlord's own listings, with their management actions. */
export const MY_PROPERTIES_ROUTE = "/mis-inmuebles";

/**
 * The nine-stage process, for whichever side of it you are on.
 *
 * It is called "Contratos" because that is what it produces: everything from the application to
 * the first canon is the negotiation that *ends* in a signed contract. What happens afterwards —
 * the months, the payments, the incidents — is the rental itself, and that is `RENTALS_ROUTE`.
 */
export const CONTRACTS_ROUTE = "/contratos";

/**
 * The tenancy once it is running: month by month, and the whole of it.
 *
 * `/arriendos` lists them and `/arriendos/<id>` is one of them, month by month. A tenancy's id
 * **is** its application's: one process produces one tenancy, so `/contratos/<id>` and
 * `/arriendos/<id>` are the two halves of the same story under the same key.
 */
export const RENTALS_ROUTE = "/arriendos";

/** One tenancy: its months, and the whole of it. Keyed by id, like the process it came from. */
export function rentalRoute(id: string): string {
  return `${RENTALS_ROUTE}/${id}`;
}

/** The tenant's reusable dossier. */
export const TENANT_PROFILE_ROUTE = "/perfil-inquilino";

/**
 * Where to reach a person. It is a page rather than a link straight to WhatsApp because the
 * menu entry has to lead somewhere the browser's back button can return from, and because the
 * two channels need room to say what each one is good for.
 */
export const SUPPORT_ROUTE = "/soporte";
/** Editing one of them. Keyed by id, not by slug: the slug is what the edit may change. */
export function editPropertyRoute(id: string): string {
  return `${MY_PROPERTIES_ROUTE}/${id}/editar`;
}
/** One process and its nine stages. Keyed by id: it is private to its two parties. */
export function applicationRoute(id: string): string {
  return `${CONTRACTS_ROUTE}/${id}`;
}

/** Where a tenant applies to a listing. The slug, never an id: it is a link people paste. */
export function applyToPropertyRoute(slug: string): string {
  return `/postularme/${slug}`;
}

/**
 * Public detail of one property: the slug alone, with no id appended.
 *
 * A random-looking code at the end of a link reads as untrustworthy where these get shared —
 * a Facebook group, a WhatsApp chat — so the slug is reserved to be unique and resolves on its
 * own. Links that still carry an id keep working: the page redirects them here.
 */
export function propertyDetailRoute(slug: string): string {
  return `${PROPERTIES_ROUTE}/${slug}`;
}

/**
 * Public access screens. Redirecting here after signing in would loop: the screen would
 * see the active session and redirect straight back.
 */
const AUTH_ROUTES = new Set<string>([LOGIN_ROUTE, SIGNUP_ROUTE, PASSWORD_RESET_ROUTE]);

/** Hoisted: the literal would be rebuilt on every call. */
const QUERY_SEPARATOR = /[?#]/;

/**
 * Validates the `?next=` parameter. Internal paths only: a value like
 * "https://other-site.com" or "//evil.com" would turn the login into an open redirect.
 */
export function safeRedirect(value: string | string[] | undefined): string {
  if (typeof value !== "string") return HOME_ROUTE;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME_ROUTE;

  // `?next=/registro?x=1` must not sneak through the querystring
  const pathname = value.split(QUERY_SEPARATOR)[0] ?? "";
  if (AUTH_ROUTES.has(pathname)) return HOME_ROUTE;

  return value;
}

/**
 * The contract of one process, streamed from our own origin.
 *
 * Same-origin on purpose: the signature placer hands this to `pdf.js`, which fetches it, and a
 * Storage bucket sends no CORS headers. See the route's own note.
 */
export function contractFileRoute(applicationId: string): string {
  return `/api/arriendos/${applicationId}/contrato`;
}
