/**
 * Firebase Admin SDK (v14) — SERVER ONLY.
 *
 * `server-only` fails the build if anyone imports this module from a file marked
 * "use client". Never prefix these credentials with NEXT_PUBLIC_.
 *
 * This SDK IGNORES Security Rules entirely: every operation here is fully privileged.
 * Authorize explicitly in each Server Action / Route Handler.
 */
import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function createApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    // Do not include the values in the message: this error ends up in logs.
    throw new Error(
      "Credenciales del Admin SDK incompletas. Requiere FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    // Environment variables store the newlines escaped.
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

/** Fluid Compute reuses instances across requests: initialize once per process. */
const [existingApp] = getApps();
const adminApp: App = existingApp ?? createApp();

export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);

export const adminDb = getFirestore(adminApp);

// `settings()` may only be called before the first operation, and only once;
// the flag keeps a second server bundle from invoking it again.
const SETTINGS_FLAG = "__madFirestoreSettings";
if (!(SETTINGS_FLAG in globalThis)) {
  Object.defineProperty(globalThis, SETTINGS_FLAG, { value: true });
  adminDb.settings({ ignoreUndefinedProperties: true });
}
