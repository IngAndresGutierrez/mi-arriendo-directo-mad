/**
 * Rutas de acceso. Las URL van en español porque son visibles para el usuario; los
 * identificadores en inglés, como el resto del código.
 *
 * Módulo sin `server-only`: lo consumen páginas de servidor y componentes de cliente.
 */

/** Pantalla de inicio de sesión. Es la raíz del sitio. */
export const LOGIN_ROUTE = "/";
export const SIGNUP_ROUTE = "/registro";
export const PASSWORD_RESET_ROUTE = "/recuperar";
/** Onboarding: hay sesión pero el perfil todavía no está completo. */
export const COMPLETE_PROFILE_ROUTE = "/registro/completar-perfil";

/** A dónde llega alguien recién autenticado. */
export const HOME_ROUTE = "/panel";

/**
 * Pantallas públicas de acceso. Redirigir aquí después de entrar produciría un bucle: la
 * pantalla vería la sesión activa y volvería a redirigir.
 */
const AUTH_ROUTES = new Set<string>([LOGIN_ROUTE, SIGNUP_ROUTE, PASSWORD_RESET_ROUTE]);

/** Hoisted: el literal se recrearía en cada llamada. */
const QUERY_SEPARATOR = /[?#]/;

/**
 * Valida el parámetro `?next=`. Solo acepta rutas internas: un valor como
 * "https://otro-sitio.com" o "//evil.com" convertiría el login en un redirector abierto.
 */
export function safeRedirect(value: string | string[] | undefined): string {
  if (typeof value !== "string") return HOME_ROUTE;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME_ROUTE;

  // `?next=/registro?x=1` no debe colarse por el querystring
  const pathname = value.split(QUERY_SEPARATOR)[0] ?? "";
  if (AUTH_ROUTES.has(pathname)) return HOME_ROUTE;

  return value;
}
