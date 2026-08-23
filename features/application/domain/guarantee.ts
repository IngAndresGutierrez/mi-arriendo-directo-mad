/**
 * The guarantee: a **rental insurance policy**, not a co-signer.
 *
 * Ley 820 de 2003 forbids cash deposits on urban housing leases in Colombia, so what stands
 * between a landlord and an empty month is either somebody who signs beside the tenant or a
 * policy. In this first phase the product points at one product it can describe precisely —
 * **Sura's digital rental insurance** — which is taken out online and **needs no co-signer**:
 * asking a tenant to produce a relative with a property is the requirement that stops most
 * applications, and the whole point of this platform is that the process does not stop.
 *
 * The policy is bought on Sura's site. This product does not sell insurance, is not a broker and
 * takes no commission, so what it does here is the honest half: say what the policy covers, hand
 * over the two pieces of data the form asks for — both of which are already on this screen — and
 * keep the record of what was taken out.
 */
export const GUARANTEE_PROVIDER = {
  name: "Sura",
  product: "Seguro de arrendamiento digital",
  /** Where it is quoted and bought. Everything happens on their side. */
  quoteUrl: "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador",
} as const;

/** What the policy answers for, in Sura's own terms. */
export const GUARANTEE_COVERAGES = [
  "Pago del arriendo si el inquilino incumple.",
  "Pago de las cuotas de administración.",
  "Asistencia domiciliaria: plomería, electricidad, cerrajería, reemplazo de vidrios, gastos de traslado y asistencia jurídica telefónica.",
] as const;

/*
 * What Sura's form asks for is two things — the tenant's email and the registry number — and both
 * are already on this screen: the email came with the tenant's account, the registry number with
 * the listing. The panel hands them over with a copy button instead of listing them in prose,
 * which is why there is no constant here: a list that repeats what is rendered beside its value
 * is a second copy to keep in step.
 */

/** Twelve months, and only while the policy is current and paid. */
export const GUARANTEE_MAX_MONTHS = 12;

export const GUARANTEE_LIMIT_NOTE =
  `Si hay reclamación, la cobertura se mantiene hasta que se restituya el inmueble o hasta que el ` +
  `inquilino pague lo que debe, con un máximo de ${GUARANTEE_MAX_MONTHS} meses. El seguro tiene ` +
  `que estar vigente y al día.`;

/**
 * Where the policy stands.
 *
 * `requested` is its own state because Sura's study takes days and both sides need somewhere to
 * look during them: without it the screen would say "sin garantía" while the answer is on its way,
 * which is the kind of silence that ends in a phone call.
 */
export const GUARANTEE_STATES = ["none", "requested", "active"] as const;
export type GuaranteeState = (typeof GUARANTEE_STATES)[number];

export const GUARANTEE_STATE_LABELS: Readonly<Record<GuaranteeState, string>> = {
  none: "Sin solicitar",
  requested: "En estudio",
  active: "Póliza activa",
};

export type Guarantee = {
  /** ISO 8601 when the landlord said they had applied for it, or `null`. */
  readonly requestedAt: string | null;
  /** ISO 8601 when the policy was recorded as issued, or `null`. */
  readonly activeAt: string | null;
  /** Sura's policy number. Empty until it exists. */
  readonly policyNumber: string;
  /** Anything worth leaving written down. Both sides read it. */
  readonly note: string;
};

export function guaranteeState(guarantee: Guarantee | null): GuaranteeState {
  if (!guarantee) return "none";
  if (guarantee.activeAt && guarantee.policyNumber) return "active";
  if (guarantee.requestedAt) return "requested";
  return "none";
}

/**
 * Why the process cannot move past the guarantee.
 *
 * Only an issued policy lets it through. "Ya la solicité" is not a guarantee — it is a wait, and
 * moving to the signature on a policy Sura may still refuse is how a landlord ends up with a
 * signed contract and nothing behind it.
 */
export type GuaranteeBlocker = "not_requested" | "not_issued" | null;

export function guaranteeBlocker(guarantee: Guarantee | null): GuaranteeBlocker {
  const state = guaranteeState(guarantee);

  if (state === "none") return "not_requested";
  if (state === "requested") return "not_issued";
  return null;
}

export function guaranteeBlockerMessage(
  blocker: GuaranteeBlocker,
  isLandlord: boolean,
): string | null {
  switch (blocker) {
    case "not_requested":
      return isLandlord
        ? `Solicita la póliza de arrendamiento en ${GUARANTEE_PROVIDER.name} para poder continuar.`
        : `El propietario todavía no ha solicitado la póliza de arrendamiento.`;
    case "not_issued":
      return isLandlord
        ? "Cuando Sura expida la póliza, registra su número aquí para continuar."
        : "La póliza está en estudio. El propietario la registrará aquí cuando Sura la expida.";
    default:
      return null;
  }
}
