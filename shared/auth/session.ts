/**
 * Server-side session, derived from the httpOnly `session` cookie.
 *
 * Flow: the client signs in with the modular SDK → gets `getIdToken()` → posts it to
 * `POST /api/session` → that Route Handler mints the session cookie with the Admin SDK.
 * Server Components then know the user without loading the web SDK.
 */
import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HOME_ROUTE, LOGIN_ROUTE } from "@/shared/auth/routes";
import { adminAuth } from "@/shared/firebase/admin";

export const SESSION_COOKIE = "session";
/**
 * Seven days. Firebase allows up to fourteen for a session cookie; seven is a week, which is
 * the unit a person actually thinks in — signing in on Monday and still being signed in the
 * following Monday morning.
 *
 * It is not the whole story of "am I still signed in", and that is worth knowing before
 * changing it: the web SDK keeps a session of its own, with its own storage and its own
 * lifetime, and that is the one Cloud Storage checks when the browser uploads a photo. When
 * they disagree, `ensureClientSession()` rebuilds the client's from this one.
 */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000;

export type UserRole = "tenant" | "landlord" | "admin";

export type SessionUser = {
  readonly uid: string;
  readonly email: string | null;
  /** Comes from custom claims: the client cannot forge it. */
  readonly role: UserRole;
};

const ROLES = new Set<string>(["tenant", "landlord", "admin"]);

function normalizeRole(value: unknown): UserRole {
  return typeof value === "string" && ROLES.has(value) ? (value as UserRole) : "tenant";
}

/**
 * `null` when there is no session, or the cookie is expired, revoked or tampered with.
 *
 * Wrapped in React's `cache()`: `verifySessionCookie(cookie, true)` makes a network call
 * to Firebase to check revocation, and a layout and its page usually need the user within
 * the same request. Without this it would verify once per call.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // `true` also checks that the session has not been revoked.
    const claims = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      role: normalizeRole(claims.role),
    };
  } catch {
    // Never log the cookie or the raw error: it carries session material.
    return null;
  }
});

/** Use this in Server Components and at the start of every Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_ROUTE);
  return user;
}

/** Role-based authorization. Ownership of concrete data is validated against Firestore. */
export async function requireRole(...roles: readonly UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(HOME_ROUTE);
  return user;
}
