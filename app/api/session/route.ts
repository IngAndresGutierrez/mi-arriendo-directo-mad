import { cookies } from "next/headers";

import { adminAuth } from "@/shared/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/shared/auth/session";
import { createSessionSchema } from "@/features/auth";

/** Ventana máxima entre el login y la emisión de la cookie de larga duración. */
const MAX_LOGIN_AGE_MS = 5 * 60 * 1000;

/**
 * Canjea el idToken del cliente por una session cookie httpOnly.
 *
 * Este endpoint es público: valida el cuerpo, verifica el token contra Firebase y exige
 * que el login sea reciente antes de emitir una cookie que vive 5 días.
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
    // `true` rechaza además tokens de sesiones ya revocadas.
    const claims = await adminAuth.verifyIdToken(parsed.data.idToken, true);

    if (Date.now() - claims.auth_time * 1000 > MAX_LOGIN_AGE_MS) {
      return Response.json({ error: "Vuelve a iniciar sesión" }, { status: 401 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
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
  } catch {
    // No filtres el error de Firebase: distinguiría token expirado de token falso.
    return Response.json({ error: "No pudimos crear la sesión" }, { status: 401 });
  }
}

/**
 * Re-emite la session cookie para el **mismo** usuario, con sus claims actuales.
 *
 * Necesario tras cambiar un custom claim (por ejemplo el rol al completar el perfil): la
 * cookie existente se acuñó antes y conserva los claims viejos.
 *
 * A diferencia de `POST`, no exige login reciente: quien llama ya tiene una session cookie
 * válida y solo puede refrescar la suya, así que no hay escalada de privilegios. La
 * comprobación estricta de `auth_time` se mantiene donde sí importa: al crear la sesión
 * desde cero.
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
      adminAuth.verifySessionCookie(currentCookie, true),
      adminAuth.verifyIdToken(parsed.data.idToken, true),
    ]);

    // Solo puedes refrescar tu propia sesión.
    if (currentClaims.uid !== tokenClaims.uid) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
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

/** Cierra la sesión y revoca los refresh tokens del usuario. */
export async function DELETE(): Promise<Response> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const claims = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(claims.sub);
    } catch {
      // cookie inválida o expirada: basta con borrarla del navegador
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
