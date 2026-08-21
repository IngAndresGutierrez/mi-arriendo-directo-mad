/**
 * Firebase Admin SDK (v14) — SOLO servidor.
 *
 * `server-only` hace fallar el build si alguien importa este módulo desde un archivo
 * con "use client". Nunca prefijes estas credenciales con NEXT_PUBLIC_.
 *
 * Este SDK IGNORA por completo las Security Rules: cada operación aquí tiene
 * privilegios totales. Autoriza explícitamente en cada Server Action / Route Handler.
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
    // No incluyas los valores en el mensaje: este error termina en logs.
    throw new Error(
      "Credenciales del Admin SDK incompletas. Requiere FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    // Las variables de entorno guardan los saltos de línea escapados.
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

/** Fluid Compute reutiliza instancias entre requests: inicializa una sola vez por proceso. */
const [existingApp] = getApps();
const adminApp: App = existingApp ?? createApp();

export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);

export const adminDb = getFirestore(adminApp);

// `settings()` solo puede llamarse antes de la primera operación y una única vez;
// el flag evita que un segundo bundle del servidor lo vuelva a invocar.
const SETTINGS_FLAG = "__madFirestoreSettings";
if (!(SETTINGS_FLAG in globalThis)) {
  Object.defineProperty(globalThis, SETTINGS_FLAG, { value: true });
  adminDb.settings({ ignoreUndefinedProperties: true });
}
