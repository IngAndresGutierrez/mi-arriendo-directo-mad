import { cookies } from "next/headers";

import { adminAuth } from "@/shared/firebase/admin";
import { SESSION_COOKIE } from "@/shared/auth/session";

/**
 * Hands the browser a custom token for the user its session cookie already identifies.
 *
 * **Why this exists.** There are two sessions, not one. The httpOnly cookie is what Server
 * Components and Server Actions read; the Firebase web SDK keeps its own, in IndexedDB, and
 * that is the one Cloud Storage and the Security Rules check when the browser uploads a photo
 * straight to the bucket. They have different lifetimes and different failure modes: clearing
 * site data, a private window, or storage the browser decided to reclaim leaves the client
 * signed out while the cookie is perfectly valid. What the user sees is "tu sesión expiró"
 * while they are, by every measure that matters, still signed in.
 *
 * This endpoint closes that gap. It mints nothing on its own authority: it reads the cookie,
 * verifies it — `true` also rejects a session whose refresh tokens were revoked — and issues a
 * token for **that same uid**. Whoever holds the cookie can already act as that user through
 * every Server Action in the product, so this grants no privilege they did not have; it moves
 * one they already had to the other half of the browser.
 *
 * `POST`, not `GET`: nothing that mints a credential should be reachable by a prefetch, a
 * preload scanner, or a link someone was sent.
 */
export async function POST(): Promise<Response> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!cookie) {
    return Response.json({ error: "No hay sesión" }, { status: 401 });
  }

  try {
    const claims = await adminAuth().verifySessionCookie(cookie, true);
    const token = await adminAuth().createCustomToken(claims.uid);

    return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // The client gets a generic message; the server keeps the reason.
    console.error("POST /api/session/token failed:", error instanceof Error ? error.message : error);

    return Response.json({ error: "No pudimos renovar la sesión" }, { status: 401 });
  }
}
