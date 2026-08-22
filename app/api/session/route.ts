import { cookies } from "next/headers";

import { adminAuth } from "@/shared/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/shared/auth/session";
import { createSessionSchema } from "@/features/auth";

/** Maximum window between the sign-in and issuing the long-lived cookie. */
const MAX_LOGIN_AGE_MS = 5 * 60 * 1000;

/**
 * Exchanges the client's idToken for an httpOnly session cookie.
 *
 * This endpoint is public: it validates the body, verifies the token against Firebase and
 * requires a recent sign-in before issuing a cookie that lives for `SESSION_MAX_AGE_MS`.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    // `true` also rejects tokens from already revoked sessions.
    const claims = await adminAuth().verifyIdToken(parsed.data.idToken, true);

    if (Date.now() - claims.auth_time * 1000 > MAX_LOGIN_AGE_MS) {
      return Response.json({ error: "Vuelve a iniciar sesión" }, { status: 401 });
    }

    const sessionCookie = await adminAuth().createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    // The client gets a generic message — a specific one would tell an expired token from a
    // forged one. The server keeps the reason, or an outage like this one is undebuggable.
    console.error("POST /api/session failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "No pudimos crear la sesión" }, { status: 401 });
  }
}

/**
 * Re-issues the session cookie for the **same** user, with their current claims.
 *
 * Needed after changing a custom claim (the role when the profile is completed, for
 * instance): the existing cookie was minted earlier and still carries the old claims.
 *
 * Unlike `POST`, it does not require a recent sign-in: the caller already holds a valid
 * session cookie and can only refresh their own, so there is no privilege escalation. The
 * strict `auth_time` check stays where it matters: creating the session from scratch.
 */
export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const currentCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!currentCookie) {
    return Response.json({ error: "No hay sesión que refrescar" }, { status: 401 });
  }

  try {
    const [currentClaims, tokenClaims] = await Promise.all([
      adminAuth().verifySessionCookie(currentCookie, true),
      adminAuth().verifyIdToken(parsed.data.idToken, true),
    ]);

    // You may only refresh your own session.
    if (currentClaims.uid !== tokenClaims.uid) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const sessionCookie = await adminAuth().createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    cookieStore.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "No pudimos refrescar la sesión" }, { status: 401 });
  }
}

/** Signs the user out and revokes their refresh tokens. */
export async function DELETE(): Promise<Response> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const claims = await adminAuth().verifySessionCookie(cookie);
      await adminAuth().revokeRefreshTokens(claims.sub);
    } catch {
      // invalid or expired cookie: clearing it from the browser is enough
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
