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
/**
 * Public detail of one property.
 *
 * The slug is decoration for humans and the id is what resolves the document, so a link
 * without a slug still works — and the page redirects it to the canonical one.
 */
export function propertyDetailRoute(id: string, slug?: string): string {
  return slug ? `${PROPERTIES_ROUTE}/${slug}-${id}` : `${PROPERTIES_ROUTE}/${id}`;
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
