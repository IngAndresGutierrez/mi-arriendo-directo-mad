/**
 * The records a landlord checks before handing over keys, and what they found.
 *
 * Every one of these is consulted **by hand**, on the entity's own site: none of them has an
 * open API, and the commercial services that do reach them need a contract. So the product does
 * the honest half — it lists what to check, links straight to it, and keeps what was found —
 * and never claims to have run a search it did not run.
 *
 * The result is written down because the alternative is a landlord remembering four searches
 * across several days, and a tenant with no way of knowing where they stand.
 */
export const CHECK_SOURCES = [
  {
    id: "simit",
    name: "SIMIT",
    what: "Multas y comparendos de tránsito",
    url: "https://www.fcm.org.co/simit/",
  },
  {
    id: "police",
    name: "Policía Nacional",
    what: "Antecedentes judiciales",
    url: "https://antecedentes.policia.gov.co/",
  },
  {
    id: "procuraduria",
    name: "Procuraduría",
    what: "Antecedentes disciplinarios",
    url: "https://www.procuraduria.gov.co/CertWEB/Certificado.aspx",
  },
  {
    id: "contraloria",
    name: "Contraloría",
    what: "Responsabilidad fiscal",
    url: "https://www.contraloria.gov.co/web/guest/atencion-al-ciudadano/tramites-servicios/certificado-de-antecedentes-fiscales",
  },
] as const;

export type CheckSource = (typeof CHECK_SOURCES)[number];
export type CheckSourceId = CheckSource["id"];

export const CHECK_SOURCE_IDS = CHECK_SOURCES.map((source) => source.id);

/**
 * What one search turned up.
 *
 * `findings` is not a verdict. Somebody with an unpaid speeding ticket is not somebody who will
 * not pay rent, and the product does not decide that — it records what was found and leaves the
 * decision where it belongs. That is also why a finding does not block the process: only *not
 * having looked* does.
 */
export const CHECK_STATUSES = ["pending", "clean", "findings"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CHECK_STATUS_LABELS: Readonly<Record<CheckStatus, string>> = {
  pending: "Sin consultar",
  clean: "Sin hallazgos",
  findings: "Con hallazgos",
};

export type CheckResult = {
  readonly status: Exclude<CheckStatus, "pending">;
  /** What was found, or anything worth leaving written down. The tenant reads it. */
  readonly note: string;
  /** ISO 8601. */
  readonly at: string;
};

export type CheckResults = Readonly<Partial<Record<CheckSourceId, CheckResult>>>;

export function checkStatusOf(results: CheckResults, source: CheckSourceId): CheckStatus {
  return results[source]?.status ?? "pending";
}

/** How many are done, for the header line. */
export function checkProgress(results: CheckResults): {
  readonly done: number;
  readonly total: number;
} {
  return {
    done: CHECK_SOURCE_IDS.filter((id) => checkStatusOf(results, id) !== "pending").length,
    total: CHECK_SOURCE_IDS.length,
  };
}

/**
 * Why the records stage cannot be left yet, or `null`.
 *
 * Two reasons, in order: without the tenant's authorisation nothing may be consulted at all, and
 * after that, what is left to consult. A finding is never one of them — see `CheckStatus`.
 */
export type ChecksBlocker =
  | { readonly reason: "unauthorized" }
  | { readonly reason: "unchecked"; readonly count: number };

export function checksBlocker(
  authorizedAt: string | null,
  results: CheckResults,
): ChecksBlocker | null {
  if (!authorizedAt) return { reason: "unauthorized" };

  const { done, total } = checkProgress(results);

  return done < total ? { reason: "unchecked", count: total - done } : null;
}

/** The blocker in words, addressed to whoever is reading the button. */
export function checksBlockerMessage(blocker: ChecksBlocker, isLandlord: boolean): string {
  if (blocker.reason === "unauthorized") {
    return isLandlord
      ? "El inquilino todavía no autoriza la consulta de sus antecedentes. Sin eso no puedes consultarlos."
      : "Falta que autorices la consulta de tus antecedentes.";
  }

  const one = blocker.count === 1;

  return isLandlord
    ? `Te falta${one ? "" : "n"} ${blocker.count} consulta${one ? "" : "s"} por registrar.`
    : `El propietario está revisando tus antecedentes: le falta${one ? "" : "n"} ${blocker.count} de ${CHECK_SOURCE_IDS.length}.`;
}
