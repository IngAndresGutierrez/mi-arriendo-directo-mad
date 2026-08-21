---
name: firebase-admin-sdk
description: Firebase Admin SDK en el servidor - Server Actions, Route Handlers, session cookies, custom claims y escrituras privilegiadas en Firestore. Úsala al manejar credenciales de service account, verificar sesiones en el servidor o escribir datos que el cliente no puede tocar (contratos, pagos, estados).
---

# Firebase Admin SDK (servidor)

`firebase-admin` v14. Corre **solo** en Node (runtime por defecto de Vercel Functions /
Fluid Compute). Ignora por completo las Security Rules: cada línea que escribas aquí es
código con privilegios totales.

## Regla #1: nunca cruza al cliente

```ts
// lib/firebase/admin.ts
import "server-only";                     // build error si alguien lo importa desde el cliente
```

Prohibido:
- Importar `lib/firebase/admin.ts` desde un archivo con `"use client"`.
- Prefijar cualquier secreto con `NEXT_PUBLIC_` (eso lo inyecta en el bundle del navegador).
- Devolver desde una Server Action objetos del Admin SDK (`DocumentReference`, `Timestamp`,
  `UserRecord` completo). Serializa a POJO plano antes de retornar.
- Loggear `FIREBASE_PRIVATE_KEY` o el `idToken` completo.

Variables de entorno (en `.env.local` y `vercel env`, **sin** `NEXT_PUBLIC_`):
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

## Inicialización singleton

**Ya existen `lib/firebase/admin.ts`** (`adminAuth`, `adminDb`, `adminStorage`) y
**`lib/auth/session.ts`** (`getSessionUser`, `requireUser`, `requireRole`). Impórtalos; no
crees otra instancia. Fluid Compute reutiliza instancias entre requests.

```ts
// lib/firebase/admin.ts (extracto)
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createApp(): App {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) throw new Error("FIREBASE_PRIVATE_KEY no está definida");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // las variables de entorno escapan los saltos de línea
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

const adminApp = getApps().length ? getApps()[0]! : createApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
adminDb.settings({ ignoreUndefinedProperties: true });
```

Imports **siempre** por subpath (`firebase-admin/app`, `firebase-admin/auth`,
`firebase-admin/firestore`), nunca `import admin from "firebase-admin"` con
`admin.firestore()` — esa es la forma legada.

## Sesión: session cookies, no idToken en cada request

Un `idToken` dura 1h y verificarlo con `verifyIdToken` hace red. La session cookie dura días
y se verifica localmente.

```ts
// app/api/session/route.ts
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

const MAX_AGE = 60 * 60 * 24 * 5 * 1000; // 5 días

export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) return new Response("Falta idToken", { status: 400 });

  // revoked:true rechaza tokens de sesiones revocadas
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  // exige login reciente antes de emitir cookie de larga duración
  if (Date.now() - decoded.auth_time * 1000 > 5 * 60 * 1000) {
    return new Response("Reautenticación requerida", { status: 401 });
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: MAX_AGE });
  const jar = await cookies();                    // ⚠️ async en Next 16
  jar.set("session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE / 1000,
  });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const jar = await cookies();
  const session = jar.get("session")?.value;
  if (session) {
    const { sub } = await adminAuth.verifySessionCookie(session).catch(() => ({ sub: null }));
    if (sub) await adminAuth.revokeRefreshTokens(sub);
  }
  jar.delete("session");
  return new Response(null, { status: 204 });
}
```

Helper que usan Server Components y Server Actions:

```ts
// lib/auth/session.ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";

export type SessionUser = { uid: string; email: string | null; rol: "inquilino" | "propietario" | "admin" };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const claims = await adminAuth.verifySessionCookie(session, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      rol: (claims.rol as SessionUser["rol"]) ?? "inquilino",
    };
  } catch {
    return null;                                  // cookie inválida/expirada/revocada
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");                  // o unauthorized() si activas authInterrupts
  return user;
}
```

## Toda Server Action revalida autorización

El cliente puede invocar una Server Action con cualquier payload. Nunca confíes en un `uid`
que venga del formulario.

```ts
"use server";
import { updateTag } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { aprobarPostulacionSchema } from "@/lib/schemas/postulacion";

export async function aprobarPostulacion(formData: FormData) {
  const user = await requireUser();                        // 1. autenticación
  const parsed = aprobarPostulacionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors };

  const ref = adminDb.collection("postulaciones").doc(parsed.data.postulacionId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Postulación no encontrada");
    const post = snap.data()!;

    const inmueble = await tx.get(adminDb.collection("inmuebles").doc(post.inmuebleId));
    // 2. autorización: ¿este usuario es dueño del inmueble?
    if (inmueble.data()?.propietarioUid !== user.uid) throw new Error("No autorizado");
    // 3. invariante de negocio
    if (post.estado !== "pendiente") throw new Error("La postulación ya fue resuelta");

    tx.update(ref, { estado: "aprobada", resueltaEn: FieldValue.serverTimestamp() });
  });

  updateTag(`postulaciones-${user.uid}`);                  // read-your-writes
  return { ok: true as const };
}
```

Orden invariable: **autenticar → validar con Zod → autorizar contra el dato real →
invariantes → escribir → invalidar cache**.

## Custom claims para roles

Los roles viven en claims, no en un campo de Firestore que el cliente pueda leer/escribir.
Solo el Admin SDK los define, y las rules los leen vía `request.auth.token.rol`.

```ts
await adminAuth.setCustomUserClaims(uid, { rol: "propietario" });
```

**Y la session cookie también queda vieja.** Se acuñó antes del claim, así que
`verifySessionCookie` seguirá devolviendo el rol anterior y los Server Components leerán mal.
Tras cambiar un claim hay que re-acuñar la cookie:

1. cliente: `await user.getIdToken(true)` → token nuevo con el claim ya incluido;
2. `PATCH /api/session` con ese token → `createSessionCookie` de nuevo.

Ese `PATCH` **no** exige login reciente (a diferencia de `POST`): quien llama ya tiene una
cookie válida y solo puede refrescar la suya, así que no hay escalada. Verifica que el `uid`
de la cookie y el del token coincidan.

## Firestore desde Admin: API distinta a la del cliente

```ts
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// aquí SÍ es encadenado (esta es la API oficial del Admin SDK, no v8 legado)
await adminDb.collection("contratos").doc(id).set({
  creadoEn: FieldValue.serverTimestamp(),
  saldo: FieldValue.increment(-monto),
});

const snap = await adminDb.collection("postulaciones")
  .where("inquilinoUid", "==", user.uid)
  .orderBy("createdAt", "desc")
  .limit(20)
  .get();
```

- `FieldValue.serverTimestamp()` / `FieldValue.increment()` / `FieldValue.arrayUnion()`
  vienen de `firebase-admin/firestore` (no de `firebase/firestore`).
- **Serializa antes de devolver a un componente**: `Timestamp` no es serializable en el RSC
  payload → `snap.data().createdAt.toDate().toISOString()`.
- Usa `runTransaction` para cualquier cambio de estado con condición previa, y
  `bulkWriter()`/`batch()` para escrituras masivas (tope 500 por batch).

## Notas de runtime

- No lo uses en `proxy.ts`: el runtime de proxy no debe hacer verificación de red y el
  bundle es demasiado grande. En proxy solo comprueba **presencia** de la cookie; la
  verificación real ocurre en la página/action.
- No fuerces `runtime = "edge"`: `firebase-admin` requiere APIs de Node.
- Emulador: exporta `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` y
  `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`; el SDK los detecta solo.
