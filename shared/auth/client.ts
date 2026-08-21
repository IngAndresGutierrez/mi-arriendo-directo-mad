"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";

import { auth } from "@/shared/firebase/auth";

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
  const user = auth.currentUser;
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
  await fetch("/api/session", { method: "DELETE" });
  await signOut(auth);
}
