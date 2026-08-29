/**
 * Access routes. The URLs are in Spanish because users see them; the identifiers are in
 * English, like the rest of the code.
 *
 * No `server-only` here: both server pages and client components consume this module.
 */

import { splitLocale } from "@/shared/i18n/locale";

/**
 * The public front door: what someone typing `miarriendodirecto.com` gets.
 *
 * **It used to be the login**, and that was the single most expensive thing about the old root:
 * the one URL a person reaches by typing the brand answered with a password field, which tells a
 * visitor who has never heard of this product nothing about what it is and offers them nothing to
 * do. The landing explains the model and leads to the catalogue; the form moved to `LOGIN_ROUTE`.
 */
export const LANDING_ROUTE = "/";

/**
 * Sign-in screen.
 *
 * **No longer `/`.** A route group does not change the URL, so `(auth)/page.tsx` was both the
 * login and the site root, and it had to carry a `robots: { index: true }` override against its
 * own group to stop the homepage of the domain asking not to be indexed. With the landing at the
 * root that override is gone and the login is plain `noindex` like the rest of `(auth)`, which is
 * what it always should have been: a form is not a search result.
 */
export const LOGIN_ROUTE = "/ingresar";
export const SIGNUP_ROUTE = "/registro";
/**
 * Asking for a password reset email. **Built now** — it was linked from the login form and
 * answered 404 for as long as that link existed, which is the same failure the legal pages had.
 */
export const PASSWORD_RESET_ROUTE = "/recuperar";

/**
 * Where the link in that email lands: the screen that takes the `oobCode` and sets the password.
 *
 * **Firebase decides which URL its email points at, not this code.** By default it is Google's own
 * hosted handler on the project's `authDomain`; pointing it here is one setting in the Firebase
 * console (Authentication → Templates → Action URL). The page is built and works either way, so
 * this is additive: with the console untouched the flow still completes on Firebase's page.
 */
export const PASSWORD_RESET_CONFIRM_ROUTE = "/recuperar/confirmar";

/**
 * Firebase's email **action handler**, pointed at this site.
 *
 * One URL receives every kind of emailed action — reset a password, verify an address, undo an email
 * change — because `notification.sendEmail.callbackUri` is a single global setting. This route owns
 * `resetPassword` and forwards the rest to Google's hosted handler untouched, which is what makes
 * pointing the console at it safe: `sendEmailVerification` runs at signup, so a URL that only knew
 * how to reset passwords would have broken every new account confirming its address.
 */
export const EMAIL_ACTION_ROUTE = "/cuenta/accion";

/**
 * The collaborator's own area, and it is deliberately **outside the product**.
 *
 * A collaborator is a sporadic figure: somebody asked to show a flat on Thursday who is not seen
 * again for a month. They are not a party to any process, so `/inicio` would greet them with an
 * empty "tus contratos en curso" and `/contratos` with nothing at all — correctly, in both cases,
 * which is the tell that they never belonged inside `(app)`.
 *
 * So this area has its own front door: they sign in with a one-time code sent to the same phone the
 * errand arrives on, and what they see is their errands and nothing else. No profile to complete, no
 * menu of sections they cannot open, and `requireCompleteProfile()` — which they would fail for ever,
 * having no profile — nowhere near it.
 */
export const COLLABORATOR_ROUTE = "/colaborador";

/**
 * Los encargos **desde el lado del propietario**: los que ha repartido y cómo van.
 *
 * Recupera la URL que tenía la pantalla del colaborador antes de que se retirara aquel modelo, y el
 * cambio de dueño es deliberado: `/encargos` dentro del portal es de quien los reparte, y
 * `/colaborador` fuera de él es de quien los hace. Cada uno vive donde tiene sesión.
 */
export const ERRANDS_ROUTE = "/encargos";

/** Crear uno sin partir de un inmueble: el formulario abre con un selector. */
export const NEW_ERRAND_ROUTE = "/encargos/nuevo";

/** One errand, from the collaborator's side. Keyed by id: it is private to its two parties. */
export function collaboratorErrandRoute(errandId: string): string {
  return `${COLLABORATOR_ROUTE}/${errandId}`;
}
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
 * Los ajustes de la cuenta: quién eres en la plataforma, qué avisos quieres y cómo entras.
 *
 * **No es `/perfil-inquilino` con otro nombre, y la diferencia es de quién es cada pantalla.** El
 * dossier de inquilino lo llena quien se postula; un propietario puede pasar por todo el producto
 * sin tener uno. Los datos de cuenta —el nombre, el teléfono, dónde vive— los tienen los dos, porque
 * son lo que la plataforma muestra de una persona a la otra, y por eso se editan aquí.
 *
 * Los dos sitios escriben el **mismo** `users/{uid}` a través de `updateProfile`, así que corregir el
 * teléfono en cualquiera de los dos se ve en el otro. Es una sola verdad con dos puertas, no dos
 * copias que puedan contradecirse.
 */
export const SETTINGS_ROUTE = "/ajustes";



/**
 * Where to reach a person. It is a page rather than a link straight to WhatsApp because the
 * menu entry has to lead somewhere the browser's back button can return from, and because the
 * two channels need room to say what each one is good for.
 *
 * **It is already public and always has been**, which is worth stating because it does not look it
 * from the outside: it is titled "Soporte", it greets by name and it sits beside the portal in the
 * menu. It answers 200 with no session, renders the public header, and `tests/e2e/header.mjs`
 * asserts that "Contacto" reaches it without passing through the login. A separate public
 * `/contacto` was built on the assumption that it did not, and reverted once that was measured.
 */
export const SUPPORT_ROUTE = "/soporte";

/**
 * The three legal documents.
 *
 * They live outside both route groups — like `/soporte` — and pick their chrome from the session,
 * because a policy has to be readable with an account and without one. Two of them were already
 * linked from the signup and the onboarding screens and answered 404 for as long as those links
 * existed.
 */
export const TERMS_ROUTE = "/terminos";
export const PRIVACY_ROUTE = "/privacidad";
export const COOKIES_ROUTE = "/cookies";

/**
 * Where the procedure for consultas and reclamos is written, inside the privacy policy.
 *
 * An anchor and not a page of its own: the deadlines of art. 14 and 15 only mean anything beside
 * the rights they apply to, and a separate page would be a second place for them to drift.
 */
export const PRIVACY_RIGHTS_ANCHOR = `${PRIVACY_ROUTE}#derechos`;
/** Handing a job on this property to somebody else. Keyed by id, like editing it. */
export function assignErrandRoute(propertyId: string): string {
  return `${MY_PROPERTIES_ROUTE}/${propertyId}/encargar`;
}

/**
 * The rental notice of one listing: the sheet to print and the square to post.
 *
 * Keyed by id like editing, and for the same reason — the slug is derived from the title and a
 * landlord may change it, while what this screen is *about* does not move.
 */
export function propertyPosterRoute(propertyId: string): string {
  return `${MY_PROPERTIES_ROUTE}/${propertyId}/aviso`;
}

/**
 * The notice itself, as a PNG.
 *
 * `format` is a **segment**, in Spanish like every path here — `pared` or `redes`. It is typed as a
 * string rather than as the union that produces it because `shared/` may not import a feature:
 * `POSTER_FORMAT_SEGMENTS` in `features/property` is where the two values are decided, and this is
 * only where they are glued onto a path.
 */
export function propertyPosterImageRoute(propertyId: string, format: string): string {
  return `${propertyPosterRoute(propertyId)}/${format}`;
}

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
 *
 * **`LANDING_ROUTE` is in the set even though it does not loop.** The landing renders happily for
 * somebody with a session — it shows them their account menu instead of "Iniciar sesión" — so it
 * is not a redirect loop, it is a worse destination: the whole point of signing in is to reach the
 * portal, and landing back on the marketing page is being handed a brochure for a product you are
 * already inside. It was rejected here when it *was* the login, and dropping it from this set at
 * the moment it stopped being one would have quietly turned `?next=/` into a valid request.
 */
const AUTH_ROUTES = new Set<string>([
  LANDING_ROUTE,
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  PASSWORD_RESET_ROUTE,
]);

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

  /*
   * **Compared without its locale prefix, which is the whole reason this line exists.** The set
   * above holds canonical Spanish paths, so a literal comparison rejected `/ingresar` and waved
   * `/en/ingresar` straight through — and every one of these four is rejected for a reason that does
   * not care what language the screen is in. Three of them loop: the English login sees the live
   * session and sends you back to the English login. `/` is the worse-destination case, and it is
   * worse in both languages.
   *
   * The value itself is returned unchanged, prefix and all: the guard decides *whether* to honour
   * the request, not where it points. Somebody signing in on the English side asking for
   * `/en/inicio` is asking for the English portal, and rewriting that to `/inicio` would answer a
   * different question than the one that was asked.
   */
  if (AUTH_ROUTES.has(splitLocale(pathname).path)) return HOME_ROUTE;

  return value;
}

/**
 * El recibo de un mes de arriendo, en PDF.
 *
 * Bajo `/api` como el contrato, y por lo mismo: no es una pantalla, es un archivo. Y sin idioma —
 * un Route Handler no puede leer un root param, así que vive fuera de `[lang]` igual que los otros
 * cuatro. Los documentos de esta mitad del producto están en español de todas formas.
 */
export function rentReceiptRoute(leaseId: string, period: string): string {
  return `/api/arriendos/${leaseId}/recibo/${period}`;
}

/**
 * El paz y salvo del arriendo entero, en PDF.
 *
 * Sin periodo en la ruta: es cierto **a la fecha en que se pide**, así que la URL no puede fijar una
 * — y dos emitidos con un mes de diferencia son documentos distintos con referencias distintas.
 */
export function clearanceRoute(leaseId: string): string {
  return `/api/arriendos/${leaseId}/paz-y-salvo`;
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
