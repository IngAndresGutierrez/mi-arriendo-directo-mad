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

import { FIREBASE_PUBLIC_CONFIG } from "./public-config";

/**
 * `true` when this process is pointed at the local emulator suite.
 *
 * The Admin SDK routes itself to the emulators off these variables, so what is left to decide is
 * the **credential**: there is no service account for a project that only exists on this machine,
 * and demanding one would make the emulator unusable from the server side.
 */
function emulated(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function createApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  /*
   * Against the emulators the project id is the whole configuration. It is expected to start with
   * `demo-`, which is what makes the isolation structural rather than a matter of remembering: the
   * SDKs refuse to contact any real backend for such a project, so a driver run cannot reach
   * production even if every other variable is wrong. The e2e suite filled the real catalogue with
   * 306 listings once, and this is the fix for that, not a convenience.
   */
  if (emulated()) {
    if (!projectId?.startsWith("demo-")) {
      throw new Error(
        `The emulator hosts are set but FIREBASE_PROJECT_ID is "${projectId ?? "(empty)"}". ` +
          "Point it at a demo- project: anything else risks writing to a real one.",
      );
    }

    return initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
  }

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
    storageBucket: FIREBASE_PUBLIC_CONFIG.storageBucket,
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
