"use server";

import { createHash, randomBytes, randomInt } from "node:crypto";

import { sendSms, sendWhatsAppTwilio } from "@/features/notification";
import { adminAuth, adminDb } from "@/shared/firebase/admin";
import { toE164 } from "@/shared/phone/countries";

import {
  codeProblem,
  CODE_LENGTH,
  CODE_PROBLEM_MESSAGES,
  CODE_TTL_MS,
  type Challenge,
} from "../domain/collaborator-auth";
import { requestCodeSchema, verifyCodeSchema } from "../validations/errand";

/**
 * Where the challenges live. **No rule declares this collection**, so the explicit closure at the
 * end of `firestore.rules` denies every client — the same protection `signatureChallenges` relies
 * on, and for the same reason: a SHA-256 of six digits falls to a million guesses, so a challenge a
 * client could read is a challenge a client can solve.
 */
const CHALLENGES = "collaboratorChallenges";
const PHONES = "collaboratorPhones";

/** Hex SHA-256 of the salted code. The code itself is never written anywhere. */
function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

/**
 * `randomInt`, not `Math.random()`.
 *
 * This is a credential: `Math.random()` is seeded predictably enough that a stream of codes from one
 * process can be reconstructed, which turns a five-attempt limit into no limit at all. `randomInt`
 * comes from the same CSPRNG as the salt beside it.
 */
function newCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** The document id for a phone: a hash, never the number — see `requestPasswordReset`'s note. */
function challengeId(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}

export type RequestCodeResult =
  | { readonly ok: true; readonly phone: string }
  | { readonly ok: false; readonly error: string };

/**
 * Sends a sign-in code to a collaborator's phone.
 *
 * **It answers the same thing whether or not that phone belongs to anybody**, which is the same
 * rule `requestPasswordReset` follows and for the same reason: a different answer would turn this
 * form into a way of asking "does this number work with miarriendoDIRECTO?" — and the numbers being
 * probed would be people's mobiles. So an unknown number gets the code screen and no message.
 *
 * The code goes out on **both channels**, like the errand itself. A collaborator who cannot receive
 * the WhatsApp still gets the SMS, and somebody locked out of the one screen this product gives them
 * has no other way in.
 */
export async function requestCollaboratorCode(input: unknown): Promise<RequestCodeResult> {
  const parsed = requestCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el número." };

  const e164 = toE164(parsed.data.phoneCountry, parsed.data.phoneNational.replace(/\D/g, ""));
  if (!e164) return { ok: false, error: "Revisa el número." };

  try {
    const reservation = await adminDb().collection(PHONES).doc(e164).get();
    const collaboratorUid = reservation.data()?.uid;

    /*
     * No account: nothing is sent and nothing is said. The screen still advances to the code step,
     * so the two cases are indistinguishable from outside — and the code that never arrives is the
     * same experience as one that went to a phone somebody no longer has.
     */
    if (typeof collaboratorUid !== "string") return { ok: true, phone: e164 };

    const code = newCode();
    const salt = randomBytes(16).toString("hex");

    /*
     * Written **before** the message leaves, the same order the interview reminder uses: the failure
     * worth avoiding is the one that repeats. A code sent and not stored is a code that cannot be
     * verified; a code stored and not sent costs one retry.
     *
     * `set` without merge replaces any previous challenge, which is what resets the attempt counter
     * — asking for a new code requires holding the phone, so that is not a way around the limit.
     */
    await adminDb()
      .collection(CHALLENGES)
      .doc(challengeId(e164))
      .set({
        codeHash: hashCode(code, salt),
        salt,
        expiresAt: Date.now() + CODE_TTL_MS,
        attempts: 0,
        uid: collaboratorUid,
      });

    const body = `${code} es tu código para entrar a miarriendoDIRECTO. Vence en 10 minutos y solo sirve una vez. No lo compartas.`;

    await Promise.all([
      sendSms({ to: e164, body }),
      sendWhatsAppTwilio({ to: e164, body, variables: [code] }),
    ]);
  } catch (error) {
    // Never the phone and never the code: both are in the failure path of a credential.
    console.error("[collaborator] could not send the sign-in code:", error);
  }

  return { ok: true, phone: e164 };
}

export type VerifyCodeResult =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly error: string };

/**
 * Checks the code and, if it is right, hands back a **custom token**.
 *
 * The browser exchanges it through `signInWithCustomToken` and then `POST /api/session` for the same
 * httpOnly cookie every other user of this product carries. Nothing new is invented: the collaborator
 * is a Firebase user like anybody else, which is what lets the Security Rules keep speaking
 * `request.auth.uid` instead of learning a second notion of identity.
 *
 * **A wrong code costs an attempt**, and the increment happens whatever the outcome — a counter that
 * only moved on some failures would be a limit with a hole in it.
 */
export async function verifyCollaboratorCode(input: unknown): Promise<VerifyCodeResult> {
  const parsed = verifyCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el código." };

  const e164 = toE164(parsed.data.phoneCountry, parsed.data.phoneNational.replace(/\D/g, ""));
  if (!e164) return { ok: false, error: CODE_PROBLEM_MESSAGES.wrong };

  const reference = adminDb().collection(CHALLENGES).doc(challengeId(e164));

  try {
    const snapshot = await reference.get();
    const data = snapshot.data();

    const challenge: Challenge | null =
      data && typeof data.codeHash === "string" && typeof data.salt === "string"
        ? {
            codeHash: data.codeHash,
            salt: data.salt,
            expiresAt: Number(data.expiresAt ?? 0),
            attempts: Number(data.attempts ?? 0),
          }
        : null;

    const problem = codeProblem(challenge, hashCode(parsed.data.code, challenge?.salt ?? ""), Date.now());

    if (problem) {
      // Only a wrong code is worth counting: an expired or spent challenge is already refusing.
      if (problem === "wrong") {
        await reference.update({ attempts: (challenge?.attempts ?? 0) + 1 });
      }

      return { ok: false, error: CODE_PROBLEM_MESSAGES[problem] };
    }

    const uid = typeof data?.uid === "string" ? data.uid : null;
    if (!uid) return { ok: false, error: CODE_PROBLEM_MESSAGES.missing };

    /*
     * Spent on success, not left to expire. A code that still worked after signing in would be a
     * second key to the same door sitting in somebody's SMS history — the same reason the signature
     * challenge is deleted the moment it is used.
     */
    await reference.delete();

    return { ok: true, token: await adminAuth().createCustomToken(uid, { role: "collaborator" }) };
  } catch (error) {
    console.error("[collaborator] could not verify the sign-in code:", error);

    return { ok: false, error: "No pudimos verificar el código. Inténtalo otra vez." };
  }
}
