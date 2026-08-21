/**
 * Firebase Auth — SOLO cliente.
 *
 * Módulo por servicio a propósito: importar Auth no debe traer Firestore ni Storage al
 * bundle. Un barrel que reexportara los tres devolvería el problema (≈630 KB de SDK en
 * una pantalla de login que solo autentica).
 */
import { connectAuthEmulator, getAuth } from "firebase/auth";

import { firebaseApp, useEmulator } from "@/lib/firebase/app";

export const auth = getAuth(firebaseApp);

const FLAG = "__madEmuladorAuth";
if (useEmulator && !(FLAG in globalThis)) {
  Object.defineProperty(globalThis, FLAG, { value: true });
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
