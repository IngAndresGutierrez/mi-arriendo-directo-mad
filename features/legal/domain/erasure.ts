/**
 * Deleting an account: what goes, what stays, and when it cannot happen at all.
 *
 * **Supresión is not absolute, and pretending otherwise would be the worse lie.** Ley 1581 de
 * 2012 (art. 8, lit. e) gives the titular the right to have their data deleted, and art. 9 of the
 * same law together with Decreto 1074 de 2015 (art. 2.2.2.25.2.11) withhold it where a legal or
 * contractual duty to keep the data exists. A rental process has two parties: erasing the tenant
 * from a signed lease destroys the landlord's evidence of it, and that landlord never consented
 * to anything of the sort.
 *
 * So this module says exactly what happens, in a shape the screen renders and the action follows.
 * A person who presses the button is told what will survive and why, before pressing it.
 *
 * Pure. The structural input types are declared here rather than imported from
 * `@/features/application` or `@/features/lease`: `domain/` stays free of other modules, and a
 * function that only needs two counts should be testable with two counts.
 */

/** Why the account cannot be deleted right now. */
export type ErasureBlocker =
  | { readonly reason: "open_application"; readonly count: number }
  | { readonly reason: "running_lease"; readonly count: number };

/** What the caller has to count before asking. */
export type ErasureSubject = {
  /** Processes still open, on either side. */
  readonly openApplications: number;
  /** Tenancies in course, on either side. */
  readonly runningLeases: number;
};

/**
 * Whether anything is in the way, and what.
 *
 * A tenancy is checked **first**: somebody with both is in the middle of living somewhere, and
 * telling them to withdraw an application when the real obstacle is their lease would send them
 * to the wrong screen.
 *
 * This is a refusal rather than a partial erasure on purpose. Half-deleting a person who is
 * currently renting leaves the other party with a process they cannot read, and the honest answer
 * is that the relationship has to end before the record of it can.
 */
export function erasureBlocker(subject: ErasureSubject): ErasureBlocker | null {
  if (subject.runningLeases > 0) {
    return { reason: "running_lease", count: subject.runningLeases };
  }
  if (subject.openApplications > 0) {
    return { reason: "open_application", count: subject.openApplications };
  }

  return null;
}

/** What the screen says. It names the obstacle and where to go, never just "no se puede". */
export function erasureBlockerMessage(blocker: ErasureBlocker): string {
  if (blocker.reason === "running_lease") {
    return blocker.count === 1
      ? "Tienes un arriendo en curso. Mientras exista, el contrato y sus pagos son también el registro de la otra parte, así que no podemos eliminar tu cuenta."
      : `Tienes ${blocker.count} arriendos en curso. Mientras existan, los contratos y sus pagos son también el registro de la otra parte, así que no podemos eliminar tu cuenta.`;
  }

  return blocker.count === 1
    ? "Tienes un proceso abierto. Retíralo o espera a que se cierre y vuelve aquí."
    : `Tienes ${blocker.count} procesos abiertos. Retíralos o espera a que se cierren y vuelve aquí.`;
}

/** One line of the plan the screen shows before anything is destroyed. */
export type ErasureItem = {
  /** What it is, in es-CO: this is read by the person deciding. */
  readonly what: string;
  readonly fate: "deleted" | "kept";
  /**
   * Why it survives. Mandatory for `kept` and empty for `deleted`, and a test pins that: an
   * exception to the right of supresión that nobody wrote a reason for is an exception nobody can
   * defend.
   */
  readonly why: string;
};

/**
 * The whole plan, in the order somebody wants to read it: what disappears, then what does not.
 *
 * **This is not decoration — it is the specification `deleteAccount` implements.** The two are
 * meant to be read side by side, so a change to one that is not made in the other is visible.
 */
export const ERASURE_PLAN: readonly ErasureItem[] = [
  { what: "Tu cuenta y tu forma de entrar", fate: "deleted", why: "" },
  { what: "Tu perfil: nombre, teléfono, dirección y fecha de nacimiento", fate: "deleted", why: "" },
  {
    what: "Tu perfil de inquilino: documento, ingresos, ocupación y referencia",
    fate: "deleted",
    why: "",
  },
  { what: "Los archivos que subiste: cédula, desprendibles y certificados", fate: "deleted", why: "" },
  { what: "Tus inmuebles publicados y sus fotos", fate: "deleted", why: "" },
  { what: "Tus notificaciones", fate: "deleted", why: "" },
  {
    what: "Los contratos que firmaste y el registro de las firmas",
    fate: "kept",
    why: "Son la prueba de un acuerdo entre dos personas. Eliminarlos borraría también la evidencia de la otra parte, que no autorizó eso.",
  },
  {
    what: "Los arriendos que llegaste a tener, con sus meses y sus incidencias",
    fate: "kept",
    why: "Es el registro de una relación contractual de dos partes, y la ley obliga a conservarlo.",
  },
  {
    what: "Los procesos cerrados, con lo que declaraste en cada uno",
    fate: "kept",
    why: "Es lo que se le presentó a ese arrendador en su momento. Queda asociado a un identificador, no a tu cuenta.",
  },
];

/** The lines that describe a deletion, for the screen that lists them separately. */
export function erasureDeletions(): readonly ErasureItem[] {
  return ERASURE_PLAN.filter((item) => item.fate === "deleted");
}

/** The lines that describe a retention, each with its reason. */
export function erasureRetentions(): readonly ErasureItem[] {
  return ERASURE_PLAN.filter((item) => item.fate === "kept");
}
