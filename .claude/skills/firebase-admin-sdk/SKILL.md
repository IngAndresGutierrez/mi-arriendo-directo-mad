---
name: firebase-admin-sdk
description: Firebase Admin SDK on the server - Server Actions, Route Handlers, session cookies, custom claims and privileged Firestore writes. Use it when handling service account credentials, verifying sessions on the server, or writing data the client must not touch (contracts, payments, statuses).
---

# Firebase Admin SDK (server)

`firebase-admin` v14. It runs **only** on Node (the default runtime of Vercel Functions /
Fluid Compute). It ignores Security Rules entirely: every line you write here is fully
privileged code.

## Rule #1: it never crosses to the client

```ts
// shared/firebase/admin.ts
import "server-only";                     // build error if anyone imports it from the client
```

Forbidden:
- Importing `shared/firebase/admin.ts` from a file marked `"use client"`.
- Prefixing any secret with `NEXT_PUBLIC_` (that injects it into the browser bundle).
- Returning Admin SDK objects from a Server Action (`DocumentReference`, `Timestamp`, a full
  `UserRecord`). Serialize to a plain POJO before returning.
- Logging `FIREBASE_PRIVATE_KEY` or the full `idToken`.

Environment variables (in `.env.local` and `vercel env`, **without** `NEXT_PUBLIC_`):
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

## Singleton initialization

**`shared/firebase/admin.ts` already exists** (`adminAuth`, `adminDb`, `adminStorage`) and so
does **`shared/auth/session.ts`** (`getSessionUser`, `requireUser`, `requireRole`). Import
them; do not create another instance. Fluid Compute reuses instances across requests.

```ts
// shared/firebase/admin.ts (excerpt)
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createApp(): App {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) throw new Error("FIREBASE_PRIVATE_KEY is not defined");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // environment variables store the newlines escaped
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

// Lazy on purpose: importing this module must NOT read the service account.
let app: App | undefined;
function adminApp(): App {
  app ??= getApps()[0] ?? createApp();
  return app;
}

let auth: Auth | undefined;
export function adminAuth(): Auth {
  auth ??= getAuth(adminApp());
  return auth;
}
// …same shape for adminDb() and adminStorage()
```

**Never initialize at module scope.** `next build` imports every route to collect its
configuration, so an eager `initializeApp()` runs during the build — and on Vercel the
credentials are sensitive environment variables, which reach the Function at runtime but not
the build step. The symptom is `Failed to collect configuration for /api/session` with
"incomplete Admin SDK credentials", on a project whose variables are perfectly set. A build
never needs a private key.

**Always** import by subpath (`firebase-admin/app`, `firebase-admin/auth`,
`firebase-admin/firestore`), never `import admin from "firebase-admin"` with
`admin.firestore()` — that is the legacy form.

## Session: session cookies, not an idToken on every request

An `idToken` lasts 1h and verifying it with `verifyIdToken` hits the network. A session cookie
lasts days and is verified locally.

```ts
// app/api/session/route.ts
import { cookies } from "next/headers";
import { adminAuth } from "@/shared/firebase/admin";

const MAX_AGE = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) return new Response("Missing idToken", { status: 400 });

  // revoked:true rejects tokens from revoked sessions
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  // require a recent sign-in before issuing a long-lived cookie
  if (Date.now() - decoded.auth_time * 1000 > 5 * 60 * 1000) {
    return new Response("Reauthentication required", { status: 401 });
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: MAX_AGE });
  const jar = await cookies();                    // ⚠️ async in Next 16
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

The helper Server Components and Server Actions use:

```ts
// shared/auth/session.ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/shared/firebase/admin";
import { LOGIN_ROUTE } from "@/shared/auth/routes";

export type SessionUser = { uid: string; email: string | null; role: "tenant" | "landlord" | "admin" };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const claims = await adminAuth.verifySessionCookie(session, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      role: (claims.role as SessionUser["role"]) ?? "tenant",
    };
  } catch {
    return null;                                  // invalid / expired / revoked cookie
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_ROUTE);               // or unauthorized() if you enable authInterrupts
  return user;
}
```

## Every Server Action revalidates authorization

The client can invoke a Server Action with any payload. Never trust a `uid` that arrives in
the form.

```ts
"use server";
import { updateTag } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/shared/auth/session";
import { adminDb } from "@/shared/firebase/admin";
import { approveApplicationSchema } from "../validations/application";

export async function approveApplication(formData: FormData) {
  const user = await requireUser();                        // 1. authentication
  const parsed = approveApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors };

  const ref = adminDb.collection("applications").doc(parsed.data.applicationId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Application not found");
    const application = snap.data()!;

    const property = await tx.get(adminDb.collection("properties").doc(application.propertyId));
    // 2. authorization: does this user own the property?
    if (property.data()?.landlordUid !== user.uid) throw new Error("Not authorized");
    // 3. business invariant
    if (application.status !== "pending") throw new Error("The application was already resolved");

    tx.update(ref, { status: "approved", resolvedAt: FieldValue.serverTimestamp() });
  });

  updateTag(`applications-${user.uid}`);                    // read-your-writes
  return { ok: true as const };
}
```

Invariable order: **authenticate → validate with Zod → authorize against the real data →
invariants → write → invalidate cache**.

## Custom claims for roles

Roles live in claims, not in a Firestore field the client can read or write. Only the Admin SDK
sets them, and the rules read them through `request.auth.token.role`.

```ts
await adminAuth.setCustomUserClaims(uid, { role: "landlord" });
```

**And the session cookie goes stale too.** It was minted before the claim, so
`verifySessionCookie` will keep returning the previous role and Server Components will read it
wrong. After changing a claim the cookie has to be re-minted:

1. client: `await user.getIdToken(true)` → a new token that already carries the claim;
2. `PATCH /api/session` with that token → `createSessionCookie` again.

That `PATCH` does **not** require a recent sign-in (unlike `POST`): the caller already holds a
valid cookie and can only refresh their own, so there is no escalation. Verify that the cookie's
`uid` and the token's match.

## Firestore from Admin: a different API from the client's

```ts
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// here chaining IS correct (this is the Admin SDK's official API, not legacy v8)
await adminDb.collection("contracts").doc(id).set({
  createdAt: FieldValue.serverTimestamp(),
  balance: FieldValue.increment(-amount),
});

const snap = await adminDb.collection("applications")
  .where("tenantUid", "==", user.uid)
  .orderBy("createdAt", "desc")
  .limit(20)
  .get();
```

- `FieldValue.serverTimestamp()` / `FieldValue.increment()` / `FieldValue.arrayUnion()` come
  from `firebase-admin/firestore` (not from `firebase/firestore`).
- **Serialize before returning to a component**: `Timestamp` is not serializable in the RSC
  payload → `snap.data().createdAt.toDate().toISOString()`.
- Use `runTransaction` for any state change with a precondition, and `bulkWriter()`/`batch()`
  for bulk writes (500 per batch max).

## Runtime notes

- Do not use it in `proxy.ts`: the proxy runtime should not do network verification and the
  bundle is too large. In the proxy only check the **presence** of the cookie; the real
  verification happens in the page or the action.
- Do not force `runtime = "edge"`: `firebase-admin` needs Node APIs.
- Emulator: export `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and
  `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`; the SDK detects them on its own.
