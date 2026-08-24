"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCustomToken,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";

import { auth } from "@/shared/firebase/auth";

/*
 * ── Whether a deliberate sign-out is in flight ───────────────────────────────────────────────
 *
 * `signOutUser()` revokes the refresh tokens on the server **before** dropping the SDK's
 * credential, and that order is deliberate: the authoritative session is the cookie, so it dies
 * first — if the `DELETE` failed after `signOut(auth)` had already run, the server would still
 * think the person was signed in and the next page load would rebuild the client session from the
 * cookie it never cleared.
 *
 * The cost of that order is a window. Any `onSnapshot` still attached — the notification bell, the
 * process page, the tenancy page — is answered `permission-denied` by a backend that has just been
 * told this token is no longer valid. **That is the session ending, not a rule denying anything**,
 * and logging it as an error is worse than useless: it sent a real diagnosis through the deployed
 * rules, the composite indexes and the shape of 70 production documents before landing on "the user
 * pressed Cerrar sesión".
 *
 * A module-level flag and not an `onAuthStateChanged` listener, because the ordering is the whole
 * problem: `auth.currentUser` is still set at the moment of the denial, so asking the SDK cannot
 * tell this apart from a genuine one.
 */
let signingOut = false;

/** For a subscription deciding whether a denial is worth reporting. */
export function isSigningOut(): boolean {
  return signingOut;
}

/**
 * Has this browser's credential stopped being valid?
 *
 * **`isSigningOut()` answers the same question and only for the tab that pressed the button.** It is
 * a module flag, which is exactly right for a sign-out — the ordering is the whole problem there, so
 * asking the SDK cannot help — and useless for every other way a session dies: a password reset, an
 * admin revoking the tokens, the account being disabled. Firebase revokes the refresh tokens in all
 * of those, every open `onSnapshot` is answered `permission-denied`, and `auth.currentUser` is still
 * set because nothing has told the SDK yet.
 *
 * That gap arrived with the password reset flow and was found the way the sign-out one was: as a
 * `permission-denied` in the console that reads like a rules bug and is not. So this asks the one
 * question that actually settles it — **force a token refresh**. A revoked credential cannot mint a
 * new token, so a rejection here is proof the session is over, and a success is proof the denial was
 * about the query rather than the caller.
 *
 * It is a network call, so it belongs in an error path and nowhere near a render.
 */
export async function credentialRevoked(): Promise<boolean> {
  const user = auth.currentUser;
  // No user at all is the same answer for the caller's purposes: there is no session to report on.
  if (!user) return true;

  try {
    await user.getIdToken(true);

    return false;
  } catch {
    return true;
  }
}


/**
 * Exchanges the freshly issued idToken for an httpOnly session cookie.
 *
 * From here on Server Components and Server Actions know the user without needing the web
 * SDK. The client session is kept separately (default persistence) because Security Rules
 * need it for realtime reads.
 */
async function createServerSession(credential: UserCredential): Promise<void> {
  const idToken = await credential.user.getIdToken();

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    // Leave client and server in the same state: signed out.
    await signOut(auth).catch(() => undefined);
    throw new Error("No pudimos crear la sesión. Inténtalo de nuevo.");
  }

  // Signing back in without a full reload has to clear the flag, or a genuine denial after it
  // would be swallowed for the rest of the tab's life.
  signingOut = false;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await createServerSession(credential);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  // If the verification email fails the account already exists: do not abort signup,
  // the user can resend it later.
  await sendEmailVerification(credential.user).catch(() => undefined);

  await createServerSession(credential);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Force the account chooser: keeps the user from signing in with an already active
  // Google account without noticing.
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  await createServerSession(credential);
}

/**
 * Refreshes the session cookie with the user's current claims.
 *
 * Call it after the server changes a custom claim (the role, when the profile is
 * completed): `getIdToken(true)` forces a new token that already carries the claim, and
 * the server re-mints the cookie. Without this, Server Components keep reading the old role.
 */
export async function refreshServerSession(): Promise<void> {
  // `ensureClientSession`, not `auth.currentUser`: this runs right after a Server Action, when
  // the SDK may not have finished restoring, and giving up silently would leave the browser
  // reading the old role until the next full reload.
  const user = await ensureClientSession();
  if (!user) return;

  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("No pudimos actualizar tu sesión. Vuelve a iniciar sesión.");
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function signOutUser(): Promise<void> {
  // Set before the revoke, not after: the denial arrives inside that call, not once it returns.
  signingOut = true;
  await fetch("/api/session", { method: "DELETE" });
  await signOut(auth);
}

/**
 * Waits for the web SDK to finish restoring its session, and rebuilds it from the server's if
 * there is none.
 *
 * `auth.currentUser` is `null` for the first moments after a page loads — the SDK reads its
 * storage asynchronously — so asking for it directly answers "signed out" for anyone quick
 * enough to click. And there are real cases where it never comes back: cleared site data, a
 * private window, storage the browser reclaimed. In both the httpOnly cookie is still valid,
 * and the honest answer is not "your session expired" but "one moment".
 *
 * So: wait for the first definite answer, and if it is nobody, ask the server for a custom
 * token minted from the cookie and sign in with it. Only when *that* fails is the person
 * genuinely signed out.
 *
 * Returns the user, or `null` when there is no session on either side.
 */
export async function ensureClientSession(): Promise<User | null> {
  const restored = await new Promise<User | null>((resolve) => {
    // `onAuthStateChanged` fires once as soon as the SDK knows, which is the point: it is the
    // difference between "not yet" and "nobody".
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

  if (restored) {
    signingOut = false;
    return restored;
  }

  try {
    const response = await fetch("/api/session/token", { method: "POST" });
    if (!response.ok) return null;

    const { token } = (await response.json()) as { token?: string };
    if (!token) return null;

    const credential = await signInWithCustomToken(auth, token);
    signingOut = false;

    return credential.user;
  } catch {
    return null;
  }
}
