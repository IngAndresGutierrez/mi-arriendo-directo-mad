/**
 * Firebase JS SDK modular (v12) — SOLO cliente.
 *
 * No importes este módulo desde un Server Component: arrastra el SDK completo al
 * RSC payload. Para leer/escribir en el servidor usa `lib/firebase/admin.ts`.
 *
 * Estas llaves NEXT_PUBLIC_* son configuración pública del SDK web y es correcto que
 * lleguen al navegador. La protección real de los datos son las Security Rules
 * (`firestore.rules`, `storage.rules`), no el secreto de estas llaves.
 */
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

function readPublicConfig(): FirebaseOptions {
  const requeridos = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const faltantes = Object.entries(requeridos)
    .filter(([, valor]) => !valor)
    .map(([clave]) => clave);

  if (faltantes.length > 0) {
    throw new Error(
      `Configuración de Firebase incompleta. Falta: ${faltantes.join(", ")}. ` +
        "Copia .env.example a .env.local y complétalo.",
    );
  }

  return {
    ...(requeridos as FirebaseOptions),
    // Opcional: solo lo usa Analytics.
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

const usaEmulador = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";

/** `getApps()` evita el error `duplicate-app` cuando el HMR de `next dev` recarga el módulo. */
export const firebaseApp = getApps().length ? getApp() : initializeApp(readPublicConfig());

export const auth = getAuth(firebaseApp);

/**
 * `initializeFirestore` con `persistentLocalCache` reemplaza al deprecado
 * `enableIndexedDbPersistence()`. `persistentMultipleTabManager` sincroniza pestañas.
 */
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const storage = getStorage(firebaseApp);

// Los emuladores deben conectarse inmediatamente después de crear cada instancia
// y antes de cualquier operación de red.
if (usaEmulador && !("__madEmuladoresConectados" in globalThis)) {
  Object.defineProperty(globalThis, "__madEmuladoresConectados", { value: true });
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
