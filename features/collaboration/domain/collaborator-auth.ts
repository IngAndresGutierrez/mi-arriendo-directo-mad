/**
 * The collaborator, and how they prove who they are.
 *
 * **They sign in with a one-time code sent to their phone, and never with a password.** That was a
 * deliberate reversal of the first request, which was for the phone number to be both the username
 * and the password. A phone number is not a secret — it is on WhatsApp, it gets forwarded, it is on
 * a business card — so that scheme would have let anybody who knew the number read encargos carrying
 * addresses, schedules and other people's names. Under Ley 1581 that is personal data with no
 * access control at all.
 *
 * What replaces it costs the collaborator nothing extra, which is the point: they type the number
 * they already gave, a code arrives on the channel this feature is already using to reach them, and
 * they are in. Nothing to remember between one errand and the next — which matters, because there
 * may be a month between them — and the factor is *having* the phone rather than *knowing* it.
 *
 * The mechanics are the contract signature's, deliberately: same length, same attempt limit, same
 * "the code is salted, hashed and never stored in the clear". A second, weaker OTP implementation
 * in the same product would be the one that gets attacked.
 */

/** Six digits, like the signature code: long enough to resist guessing inside its lifetime. */
export const CODE_LENGTH = 6;

/**
 * Five tries, then the challenge is spent.
 *
 * **A wrong code costs an attempt**, which is the half that is easy to leave out and makes the
 * limit meaningless without it — a counter nothing decrements is not a limit. Asking for a new code
 * replaces the challenge and resets the count, which is fine: getting a fresh code requires holding
 * the phone, which is the thing being proved.
 */
export const CODE_MAX_ATTEMPTS = 5;

/** Ten minutes. Long enough for an SMS to arrive on a bad network, short enough to matter. */
export const CODE_TTL_MS = 10 * 60_000;

/** Why a code was refused. One shape so the screen and the action cannot word it differently. */
export const CODE_PROBLEMS = ["expired", "too_many_attempts", "wrong", "missing"] as const;
export type CodeProblem = (typeof CODE_PROBLEMS)[number];

export const CODE_PROBLEM_MESSAGES: Readonly<Record<CodeProblem, string>> = {
  missing: "Pide un código nuevo para entrar.",
  expired: "Ese código ya venció. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos. Pide un código nuevo.",
  wrong: "El código no coincide. Revísalo e inténtalo otra vez.",
};

/** What the stored challenge holds. The code itself is **never** one of these fields. */
export type Challenge = {
  readonly codeHash: string;
  readonly salt: string;
  readonly expiresAt: number;
  readonly attempts: number;
};

/**
 * Is this code acceptable? Pure, so every branch is testable without a backend.
 *
 * **Expiry and the attempt limit are checked before the code is compared**, and the order is not
 * cosmetic: comparing first would let somebody keep testing guesses against a challenge that is
 * already spent, which is exactly the limit they are trying to get around.
 */
export function codeProblem(
  challenge: Challenge | null,
  candidateHash: string,
  now: number,
): CodeProblem | null {
  if (!challenge) return "missing";
  if (now >= challenge.expiresAt) return "expired";
  if (challenge.attempts >= CODE_MAX_ATTEMPTS) return "too_many_attempts";
  if (challenge.codeHash !== candidateHash) return "wrong";

  return null;
}

/*
 * **There is deliberately no `maskPhone` here.** The screen has to confirm *where* the code went —
 * somebody with two phones needs to know which to pick up — without printing the whole number on a
 * page anybody can reach by typing a number into a form. That is exactly what `maskChannel` in the
 * signature stage already does, and it is reused from `@/features/application/client` rather than
 * written again: the same call `features/lease` makes for `Payout` and `receiptFileProblem`.
 *
 * A second one was written here first and was wrong — it produced `+5730 012 ••• ••67` for a
 * Colombian number, splitting the country code in the wrong place, and the test that was supposed to
 * catch it only asserted that `"+57"` appeared *somewhere*, which `"+5730"` satisfies. Two maskers
 * is two chances to leak a digit, and the one nobody looks at is the copy.
 */

/** A collaborator, as the product knows them. Keyed by their Firebase uid. */
export type CollaboratorDoc = {
  readonly name: string;
  /** E.164, like every phone in this product. It is also how they sign in. */
  readonly phone: string;
  readonly phoneCountry: string;
  readonly createdAt: { toDate(): Date };
  readonly updatedAt: { toDate(): Date };
};

export type Collaborator = Omit<CollaboratorDoc, "createdAt" | "updatedAt"> & {
  readonly uid: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};
