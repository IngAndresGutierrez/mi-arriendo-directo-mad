/**
 * Firestore — SOLO cliente (lecturas en tiempo real y escrituras del usuario).
 *
 * Para leer en el servidor usa `lib/firebase/admin.ts`. Este módulo es pesado: impórtalo
 * solo en las pantallas que realmente consultan la base de datos.
 */
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import { firebaseApp, useEmulator } from "@/lib/firebase/app";

/**
 * `persistentLocalCache` reemplaza al deprecado `enableIndexedDbPersistence()`.
 * `persistentMultipleTabManager` sincroniza pestañas.
 */
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const FLAG = "__madEmuladorFirestore";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
