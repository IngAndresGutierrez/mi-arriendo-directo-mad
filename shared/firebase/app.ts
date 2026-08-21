/**
 * Firebase app initialization on the client. This module imports **only**
 * `firebase/app`, nothing else.
 *
 * It is deliberately separate from the service modules: code that only needs the app —
 * Analytics, for instance — must not drag Firestore, Auth and Storage into the bundle.
 * That coupling cost hundreds of KB on pages that never touch the database.
 */
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";

function readPublicConfig(): FirebaseOptions {
  const required = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Configuración de Firebase incompleta. Falta: ${missing.join(", ")}. ` +
        "Copia .env.example a .env.local y complétalo.",
    );
  }

  return {
    ...(required as FirebaseOptions),
    // Optional: only Analytics uses it.
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

/** `getApps()` avoids `duplicate-app` when `next dev` HMR reloads the module. */
export const firebaseApp = getApps().length ? getApp() : initializeApp(readPublicConfig());

export const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";
