/**
 * Firestore — CLIENT ONLY (realtime reads and user writes).
 *
 * To read on the server use `shared/firebase/admin.ts`. This module is heavy: import it
 * only in screens that actually query the database.
 */
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import { firebaseApp, useEmulator } from "@/shared/firebase/app";

/**
 * `persistentLocalCache` replaces the deprecated `enableIndexedDbPersistence()`.
 * `persistentMultipleTabManager` keeps tabs in sync.
 */
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const FLAG = "__madEmuladorFirestore";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
