/**
 * Cloud Storage — SOLO cliente (subida de documentos de identidad y fotos).
 *
 * Impórtalo únicamente en las pantallas que suben o descargan archivos.
 */
import { connectStorageEmulator, getStorage } from "firebase/storage";

import { firebaseApp, useEmulator } from "@/lib/firebase/app";

export const storage = getStorage(firebaseApp);

const FLAG = "__madEmuladorStorage";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
