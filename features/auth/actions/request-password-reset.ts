"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { sendEmail } from "@/features/notification";
import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { adminAuth, adminDb } from "@/shared/firebase/admin";
import { resolveSiteUrl } from "@/shared/lib/site-url";

import {
  passwordResetEmail,
  resetThrottle,
  type ResetAttempts,
} from "../domain/password-reset";
import { passwordResetSchema } from "../validations/auth";

/** Where the counters live. No rule declares it, so the explicit closure denies every client. */
const COLLECTION = "passwordResetRequests";

/**
 * The document id for an address.
 *
 * **A hash, never the address itself.** A document id is not data you can hide: it shows in the
 * Firebase console, in an export and in any log line that names the path, so a collection keyed by
 * plaintext email would be a list of everyone who has ever forgotten their password, readable by
 * anyone who can see the console. The hash gives the counter the one thing it needs — the same
 * address maps to the same document — and nothing else.
 *
 * Unsalted on purpose, and it is worth saying why that is not the mistake it looks like: a salt
 * would have to be stable to keep the mapping, so it would be a single constant, which buys nothing
 * against an attacker who has both the constant and a list of addresses to try. What this defends
 * against is *casual* exposure of the address, and for that a plain digest is the honest tool. It is
 * not a password hash and nothing here is a secret.
 */
function counterKey(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

/**
 * Sends the email that lets somebody choose a new password.
 *
 * **It always answers the same thing**, and that is the whole security design of this action. If it
 * said "no existe una cuenta con ese correo" it would be an account-enumeration oracle: type in
 * addresses, learn which ones are registered here. That is the same rule `shared/auth/errors.ts`
 * already enforces on the login form, where invalid credentials and unknown user deliberately share
 * one message — and it would be pointless to keep it there and give it away here.
 *
 * So every branch below returns `true`: an unknown address, a throttled one, an account created
 * with Google that has no password, and a Resend failure. What differs is only what happens on the
 * server. The screen says "si existe una cuenta, te llega un correo", which is the truthful version
 * of the same silence.
 *
 * **The throttle is written before the email is sent**, for the same reason the interview reminder
 * marks itself as sent before it leaves: the failure to avoid is the one that repeats. And it is
 * written for unknown addresses too — skipping it there would make the endpoint's *timing* and its
 * Firestore traffic differ by whether the account exists, which is the oracle coming back in
 * through the side door.
 *
 * It never throws. A caller who could tell an internal failure from a refusal would learn something
 * from that difference too.
 */
export async function requestPasswordReset(input: unknown): Promise<{ readonly ok: true }> {
  const parsed = passwordResetSchema.safeParse(input);
  // An invalid address cannot be sent to, and the form already said so. Nothing to record.
  if (!parsed.success) return { ok: true };

  const { email } = parsed.data;

  try {
    const counter = adminDb().collection(COLLECTION).doc(counterKey(email));
    const snapshot = await counter.get();
    const data = snapshot.data();
    const previous: ResetAttempts | null =
      typeof data?.count === "number" && typeof data?.windowStartedAt === "number"
        ? { count: data.count, windowStartedAt: data.windowStartedAt }
        : null;

    const decision = resetThrottle(previous, Date.now());
    await counter.set({ ...decision.next, updatedAt: new Date() });

    if (!decision.allowed) {
      console.info("[password-reset] throttled");

      return { ok: true };
    }

    /*
     * **`url` is the continue URL — where Firebase sends the person once the password is already
     * changed — and not where the emailed link points.** Where the link points is the *action URL*
     * configured in the Firebase console; until that names this site it is Google's hosted page.
     *
     * This pointed at `/recuperar/confirmar` and that was a real bug, reported from the screen: the
     * reset completed on Firebase's page, Firebase then forwarded to the confirm screen with no
     * `oobCode`, and that screen — which exists precisely to consume a code — answered "este enlace
     * está incompleto". The password had just been changed successfully, so the one message the
     * person got was both alarming and false.
     *
     * `LOGIN_ROUTE` is the honest destination: the thing you do after choosing a new password is
     * sign in with it. It stays correct under the other configuration too — with a custom action
     * URL the confirm screen handles the code itself and sends people here on its own.
     */
    const requestHeaders = await headers();
    const origin = resolveSiteUrl({
      host: requestHeaders.get("host"),
      proto: requestHeaders.get("x-forwarded-proto"),
      configured: process.env.NEXT_PUBLIC_SITE_URL,
    });

    const link = await adminAuth().generatePasswordResetLink(email, {
      url: `${origin}${LOGIN_ROUTE}`,
    });

    await sendEmail(passwordResetEmail(email, link));
  } catch (error) {
    /*
     * `auth/user-not-found` lands here, and it is the expected case rather than a fault: somebody
     * mistyped their address, or never had an account. It is logged without the address — writing
     * it would rebuild, in the log, exactly the list this action refuses to expose.
     */
    const code = (error as { code?: unknown })?.code;
    if (code !== "auth/user-not-found") {
      console.error("[password-reset] could not send the reset email:", error);
    }
  }

  return { ok: true };
}
