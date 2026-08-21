/**
 * Cloud Storage — CLIENT ONLY (identity document and photo uploads).
 *
 * Import it only in screens that upload or download files.
 */
import { connectStorageEmulator, getStorage } from "firebase/storage";

import { firebaseApp, useEmulator } from "@/shared/firebase/app";

export const storage = getStorage(firebaseApp);

const FLAG = "__madEmuladorStorage";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
