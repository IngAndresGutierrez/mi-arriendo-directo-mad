/**
 * Sesión del servidor a partir de la cookie httpOnly `session`.
 *
 * Flujo: el cliente hace login con el SDK modular → obtiene `getIdToken()` →
 * lo envía a `POST /api/session` → esa Route Handler crea la session cookie con el
 * Admin SDK. Así los Server Components conocen al usuario sin cargar el SDK web.
 */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "session";
/** 5 días, el máximo razonable para una session cookie de Firebase. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000;

export type RolUsuario = "inquilino" | "propietario" | "admin";

export type SessionUser = {
  readonly uid: string;
  readonly email: string | null;
  /** Viene de custom claims: el cliente no lo puede falsificar. */
  readonly rol: RolUsuario;
};

const ROLES: readonly RolUsuario[] = ["inquilino", "propietario", "admin"];

function normalizarRol(valor: unknown): RolUsuario {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor)
    ? (valor as RolUsuario)
    : "inquilino";
}

/** `null` si no hay sesión, o si la cookie está expirada, revocada o manipulada. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // `true` comprueba además que la sesión no haya sido revocada.
    const claims = await adminAuth.verifySessionCookie(cookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      rol: normalizarRol(claims.rol),
    };
  } catch {
    // No loggees la cookie ni el error crudo: contiene material de sesión.
    return null;
  }
}

/** Usa esto en Server Components y al inicio de cada Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Autorización por rol. La pertenencia sobre datos concretos se valida contra Firestore. */
export async function requireRol(...roles: readonly RolUsuario[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect("/");
  return user;
}
