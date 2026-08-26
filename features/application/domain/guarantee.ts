import type { Dictionary } from "@/shared/i18n";

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
export type GuaranteeCopy = Dictionary["guarantee"];

/**
 * The insurer. **Its name stays here and its product name moved to the dictionary**: "Sura" is a
 * proper noun and identical in every language, while "seguro de arrendamiento digital" is a
 * description and reads as one.
 */
export const GUARANTEE_PROVIDER = {
  name: "Sura",
  /** Where it is quoted and bought. Everything happens on their side. */
  quoteUrl: "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador",
} as const;

/** What the policy answers for, in Sura's own terms. */

/*
 * What Sura's form asks for is two things — the tenant's email and the registry number — and both
 * are already on this screen: the email came with the tenant's account, the registry number with
 * the listing. The panel hands them over with a copy button instead of listing them in prose,
 * which is why there is no constant here: a list that repeats what is rendered beside its value
 * is a second copy to keep in step.
 */

/**
 * The plan to take out, and it is not a preference.
 *
 * Sura's quoter offers several tiers, and only this one answers for the administration fee and
 * carries the home assistance the coverages above describe. A landlord who picks the cheaper tier
 * discovers the difference on the month they need it, which is the worst possible moment, so the
 * panel says it once, plainly, next to the button that opens the quoter.
 */
export const GUARANTEE_PLAN = "Plus";

/**
 * Where the tenant's link is allowed to point.
 *
 * The landlord pastes this link and the **tenant** is the one who clicks it, from a page they
 * trust, about their own lease. Accepting any URL would turn that into a way to put an arbitrary
 * destination in front of them — so the host is checked, not just the shape. The comparison is on
 * the parsed hostname, never on the string: `sura.co.example.com` contains "sura.co" and is not
 * Sura.
 */
export const GUARANTEE_LINK_HOST = "sura.co";

/** Twelve months, and only while the policy is current and paid. */
export const GUARANTEE_MAX_MONTHS = 12;


/**
 * Where the policy stands.
 *
 * `requested` is its own state because Sura's study takes days and both sides need somewhere to
 * look during them: without it the screen would say "sin garantía" while the answer is on its way,
 * which is the kind of silence that ends in a phone call.
 *
 * `waived` is the landlord saying they do not want one. **Nothing in Colombian law requires a
 * rental insurance policy**, so this is a decision that was always theirs to make — the stage was
 * simply written as if it were not, and a landlord renting to a relative or to somebody they have
 * rented to for years had no way past it but to buy a policy they did not want. What the product
 * owes them is the consequence, said once and plainly, not a gate.
 */
export const GUARANTEE_STATES = ["none", "requested", "active", "waived"] as const;
export type GuaranteeState = (typeof GUARANTEE_STATES)[number];

/*
 * **What waiving it actually means lives in the dictionary now**, as `guarantee.waivedNote` and
 * `guarantee.waivedTenantNote`, and the reason it is worth a note here is the reason it is worth
 * saying at all: **Ley 820 de 2003 forbids a cash deposit on an urban housing lease**, so the policy
 * is not one guarantee among several — with it declined there is nothing behind the lease. That is a
 * legitimate choice and a common one between people who know each other; it is not a small one, and
 * the landlord reads that sentence *before* the switch, not after.
 */

export type Guarantee = {
  /** ISO 8601 when the landlord said they had applied for it, or `null`. */
  readonly requestedAt: string | null;
  /**
   * ISO 8601 when the landlord said they do not want a policy, or `null`.
   *
   * A timestamp and not a `required: boolean`, for the reason every other decision in this domain
   * is one — `requestedAt`, `activeAt`, `checksAuthorizedAt`, `acceptedClauseAt`: *when* it was
   * decided is part of the record both parties read, and a bare boolean answers "no" the same way
   * whether it was decided today or never asked at all.
   */
  readonly waivedAt: string | null;
  /** ISO 8601 when the policy was recorded as issued, or `null`. */
  readonly activeAt: string | null;
  /** Sura's policy number. Empty until it exists. */
  readonly policyNumber: string;
  /**
   * Sura's link for the tenant to continue the process, or empty.
   *
   * The quoter ends by producing a link tied to that quote, and Sura emails it to the tenant as
   * well. It is kept here because an email is a thing that gets lost: the tenant should be able
   * to find it on the page about their own rental, and the landlord should be able to see that
   * they handed it over. It carries the quote's identifier, so it is treated as the credential it
   * is — never logged and never put in a URL of ours.
   */
  readonly tenantLink: string;
  /** Anything worth leaving written down. Both sides read it. */
  readonly note: string;
};

/**
 * Whether a URL is one of Sura's, decided on the parsed hostname.
 *
 * Pure and unit-tested because it is the whole of the protection: the tenant clicks whatever
 * this returns `true` for.
 */
export function isProviderLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  return host === GUARANTEE_LINK_HOST || host.endsWith(`.${GUARANTEE_LINK_HOST}`);
}

/**
 * Where it stands, and the order of these four lines is the whole rule.
 *
 * **An issued policy outranks a waiver.** You do not un-buy a policy: once one exists, the record
 * is that the lease has a guarantee, and a stale `waivedAt` underneath must not be able to say
 * otherwise. `canWaiveGuarantee` is what stops the pair arising in the first place; this is what
 * makes it harmless if it ever does.
 *
 * A waiver outranks a *request*, though, because that pair is ordinary: a landlord may say they
 * applied, think better of it and decide they do not want one after all. The `requestedAt` stays —
 * it happened — and the state is the last decision.
 */
export function guaranteeState(guarantee: Guarantee | null): GuaranteeState {
  if (!guarantee) return "none";
  if (guarantee.activeAt && guarantee.policyNumber) return "active";
  if (guarantee.waivedAt) return "waived";
  if (guarantee.requestedAt) return "requested";
  return "none";
}

/**
 * Whether the landlord may still turn the policy off.
 *
 * Not once one exists. Offering the switch then would be offering to un-buy something, and what it
 * would actually do is hide a policy the tenant has already been told about — so the control is
 * gone, which is the same rule the rest of this product follows about a button that no longer
 * changes anything.
 */
export function canWaiveGuarantee(guarantee: Guarantee | null): boolean {
  return guaranteeState(guarantee) !== "active";
}

/**
 * Why the process cannot move past the guarantee.
 *
 * An issued policy lets it through, and so does the landlord having said they do not want one.
 * What does **not** is "ya la solicité": that is a wait, not a guarantee, and moving to the
 * signature on a policy Sura may still refuse is how a landlord ends up with a signed contract and
 * nothing behind it. The difference between a waiver and a pending request is that the first is a
 * decision and the second is an unanswered question — a stage blocks on the question, never on the
 * answer being one it would not have chosen.
 */
export type GuaranteeBlocker = "not_requested" | "not_issued" | null;

export function guaranteeBlocker(guarantee: Guarantee | null): GuaranteeBlocker {
  const state = guaranteeState(guarantee);

  if (state === "waived") return null;
  if (state === "none") return "not_requested";
  if (state === "requested") return "not_issued";
  return null;
}

export function guaranteeBlockerMessage(
  blocker: GuaranteeBlocker,
  isLandlord: boolean,
  copy: GuaranteeCopy,
): string | null {
  const { blockers } = copy;

  switch (blocker) {
    case "not_requested":
      return isLandlord
        ? `${blockers.notRequestedLandlordBefore} ${GUARANTEE_PROVIDER.name} ${blockers.notRequestedLandlordAfter}`
        : blockers.notRequestedTenant;
    case "not_issued":
      return isLandlord ? blockers.notIssuedLandlord : blockers.notIssuedTenant;
    default:
      return null;
  }
}
