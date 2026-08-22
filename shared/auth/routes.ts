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
/** Editing one of them. Keyed by id, not by slug: the slug is what the edit may change. */
export function editPropertyRoute(id: string): string {
  return `${MY_PROPERTIES_ROUTE}/${id}/editar`;
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
