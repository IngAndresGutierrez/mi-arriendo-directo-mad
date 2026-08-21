/**
 * Inicialización de la app de Firebase en el cliente. Este módulo importa **solo**
 * `firebase/app`, nada más.
 *
 * Está separado de `client.ts` a propósito: quien necesite únicamente la app —por ejemplo
 * Analytics— no debe arrastrar Firestore, Auth y Storage al bundle. Ese acoplamiento
 * costaba cientos de KB en páginas que no usan la base de datos.
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
    // Opcional: solo lo usa Analytics.
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

/** `getApps()` evita `duplicate-app` cuando el HMR de `next dev` recarga el módulo. */
export const firebaseApp = getApps().length ? getApp() : initializeApp(readPublicConfig());

export const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";
