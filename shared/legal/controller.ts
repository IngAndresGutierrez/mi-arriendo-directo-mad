/**
 * Who answers for the personal data this product holds.
 *
 * **Why this is a module and not a paragraph inside each document.** Ley 1581 de 2012 (art. 13
 * and 15) and the Decreto 1074 de 2015 require the *same* identification in three places that
 * never see each other: the política de tratamiento, the aviso de privacidad shown wherever data
 * is collected, and the footer every page carries. Three copies is three chances for them to
 * disagree, and the one people would quote back at us is whichever is wrong.
 *
 * It lives in `shared/` and not in `features/legal/` for a boundary reason: the footer is
 * `shared/shell/legal-footer.tsx`, and `shared → features` is forbidden by dependency-cruiser.
 * The precedent is `shared/lib/support-contact.ts`, which is the same shape — public contact
 * details, client-safe, one place to change them.
 *
 * Public by design: every value here is meant to be read by anyone. There is no secret in this
 * file and there must never be one.
 */

/** Razón social of the Responsable del Tratamiento. */
export const CONTROLLER_NAME = "Mi Arriendo Directo S.A.S.";

/**
 * The NIT, once there is one.
 *
 * **It is deliberately `null`, and that is a gap rather than a decision.** The NIT is mandatory
 * content of both the política de tratamiento (Ley 1581 art. 13 and 15, which require the
 * Responsable's *identity*) and of any e-commerce provider's public identification (Ley 1480 de
 * 2011, art. 50). Every renderer below reads it through `controllerIdentityLines()`, which simply
 * omits the line while it is `null`, so nothing shows a hole in the meantime — but the documents
 * are not complete until this holds a real value, and **this is the only line to change**.
 */
export const CONTROLLER_NIT: string | null = null;

/** Domicilio. Colombia, because that is the jurisdiction the whole product is written against. */
export const CONTROLLER_DOMICILE = "Manizales, Caldas, Colombia";

/**
 * The channel where a titular exercises their rights — consultas and reclamos under art. 14 and
 * 15 of Ley 1581.
 *
 * It is defined here rather than reused from `SUPPORT_EMAIL` even though it is the same address
 * today: they are two different roles. Support answers "no me carga la foto"; this one receives
 * a legally timed request that starts a clock. The day one of them moves, only one should.
 */
export const PRIVACY_CONTACT_EMAIL = "miarriendodirecto@gmail.com";

/**
 * The Responsable, as a person reads it: one line per fact that exists.
 *
 * Returns an array rather than a joined string so a caller can render it as a list, a paragraph
 * or a definition list without re-deciding what is in it — and so the absent NIT disappears
 * instead of leaving a dangling separator.
 */
export function controllerIdentityLines(): readonly string[] {
  return [
    CONTROLLER_NAME,
    ...(CONTROLLER_NIT ? [`NIT ${CONTROLLER_NIT}`] : []),
    CONTROLLER_DOMICILE,
    PRIVACY_CONTACT_EMAIL,
  ];
}
