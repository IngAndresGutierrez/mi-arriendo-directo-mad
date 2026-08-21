/**
 * Firebase Admin SDK (v14) — SERVER ONLY.
 *
 * `server-only` fails the build if anyone imports this module from a file marked
 * "use client". Never prefix these credentials with NEXT_PUBLIC_.
 *
 * This SDK IGNORES Security Rules entirely: every operation here is fully privileged.
 * Authorize explicitly in each Server Action / Route Handler.
 *
 * Initialization is **lazy on purpose**: importing this module must not read the service
 * account. `next build` imports every route to collect its configuration, and on Vercel the
 * credentials are sensitive environment variables, which reach the Function at runtime but
 * not the build step — an eager `initializeApp()` at module scope failed the build with
 * "Failed to collect configuration for /api/session". A build never needs a private key.
 */
import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function createApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    // Do not include the values in the message: this error ends up in logs.
    throw new Error(
      "Incomplete Admin SDK credentials. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and " +
        "FIREBASE_PRIVATE_KEY are required.",
    );
  }

  return initializeApp({
    // Environment variables store the newlines escaped.
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

/** Fluid Compute reuses instances across requests: initialize once per process. */
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

let storage: Storage | undefined;
export function adminStorage(): Storage {
  storage ??= getStorage(adminApp());
  return storage;
}

let db: Firestore | undefined;
export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp());
    // `settings()` may only be called before the first operation, and only once; the flag
    // keeps a second server bundle from invoking it again on the same instance.
    const FLAG = "__madFirestoreSettings";
    if (!(FLAG in globalThis)) {
      Object.defineProperty(globalThis, FLAG, { value: true });
      db.settings({ ignoreUndefinedProperties: true });
    }
  }
  return db;
}
