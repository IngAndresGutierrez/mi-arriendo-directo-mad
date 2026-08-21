/**
 * Firebase Auth — CLIENT ONLY.
 *
 * One module per service on purpose: importing Auth must not pull Firestore or Storage
 * into the bundle. A barrel re-exporting all three would bring the problem back (~630 KB
 * of SDK on a login screen that only authenticates).
 */
import { connectAuthEmulator, getAuth } from "firebase/auth";

import { firebaseApp, useEmulator } from "@/shared/firebase/app";

export const auth = getAuth(firebaseApp);

const FLAG = "__madEmuladorAuth";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
