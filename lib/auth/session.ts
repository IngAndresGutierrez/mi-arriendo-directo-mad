/**
 * Sesión del servidor a partir de la cookie httpOnly `session`.
 *
 * Flujo: el cliente hace login con el SDK modular → obtiene `getIdToken()` → lo envía a
 * `POST /api/session` → esa Route Handler crea la session cookie con el Admin SDK. Así los
 * Server Components conocen al usuario sin cargar el SDK web.
 */
import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COMPLETE_PROFILE_ROUTE, HOME_ROUTE, LOGIN_ROUTE } from "@/lib/auth/routes";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "session";
/** 5 días, el máximo razonable para una session cookie de Firebase. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000;

export type UserRole = "inquilino" | "propietario" | "admin";

export type SessionUser = {
  readonly uid: string;
  readonly email: string | null;
  /** Viene de custom claims: el cliente no lo puede falsificar. */
  readonly role: UserRole;
};

const ROLES = new Set<string>(["inquilino", "propietario", "admin"]);

function normalizeRole(value: unknown): UserRole {
  return typeof value === "string" && ROLES.has(value) ? (value as UserRole) : "inquilino";
}

/**
 * `null` si no hay sesión, o si la cookie está expirada, revocada o manipulada.
 *
 * Envuelto en `cache()` de React: `verifySessionCookie(cookie, true)` hace una llamada de
 * red a Firebase para comprobar revocación, y un layout y su página suelen necesitar el
 * usuario en el mismo request. Sin esto se verificaría una vez por llamada.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // `true` comprueba además que la sesión no haya sido revocada.
    const claims = await adminAuth.verifySessionCookie(cookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      role: normalizeRole(claims.rol),
    };
  } catch {
    // No loggees la cookie ni el error crudo: contiene material de sesión.
    return null;
  }
});

/** Usa esto en Server Components y al inicio de cada Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_ROUTE);
  return user;
}

/**
 * Sesión **y** perfil completo. Úsalo en toda pantalla del producto.
 *
 * Quien acaba de registrarse tiene sesión pero no perfil: lo manda a completarlo. La
 * pantalla de onboarding usa `requireUser()`, no esta, o el redirect sería un bucle.
 */
export async function requireCompleteProfile(): Promise<SessionUser> {
  const user = await requireUser();

  // Import diferido: `lib/data/profile` importa el Admin SDK y no queremos que toda
  // pantalla que solo necesite `requireUser` arrastre la lectura de Firestore.
  const { hasProfile } = await import("@/lib/data/profile");
  if (!(await hasProfile(user.uid))) redirect(COMPLETE_PROFILE_ROUTE);

  return user;
}

/** Autorización por rol. La pertenencia sobre datos concretos se valida contra Firestore. */
export async function requireRole(...roles: readonly UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(HOME_ROUTE);
  return user;
}
