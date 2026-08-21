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

import { auth } from "@/lib/firebase/auth";

/**
 * Canjea el idToken recién emitido por una session cookie httpOnly.
 *
 * A partir de aquí los Server Components y las Server Actions conocen al usuario sin
 * necesitar el SDK web. La sesión del cliente se conserva aparte (persistencia por
 * defecto) porque las Security Rules la necesitan para las lecturas en tiempo real.
 */
async function createServerSession(credential: UserCredential): Promise<void> {
  const idToken = await credential.user.getIdToken();

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    // Deja cliente y servidor en el mismo estado: sin sesión.
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

  // Si el correo de verificación falla, la cuenta ya existe: no abortes el registro,
  // el usuario puede reenviarlo después.
  await sendEmailVerification(credential.user).catch(() => undefined);

  await createServerSession(credential);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Fuerza el selector de cuenta: evita entrar con una cuenta de Google ya activa sin
  // que la persona lo note.
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  await createServerSession(credential);
}

/**
 * Refresca la session cookie con los claims actuales del usuario.
 *
 * Llámalo después de que el servidor cambie un custom claim (el rol al completar el
 * perfil): `getIdToken(true)` fuerza un token nuevo con el claim ya incluido, y el
 * servidor re-acuña la cookie. Sin esto, los Server Components siguen leyendo el rol viejo.
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
