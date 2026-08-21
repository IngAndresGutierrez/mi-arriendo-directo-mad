/**
 * Firebase app initialization on the client. This module imports **only**
 * `firebase/app`, nothing else.
 *
 * It is deliberately separate from the service modules: code that only needs the app —
 * Analytics, for instance — must not drag Firestore, Auth and Storage into the bundle.
 * That coupling cost hundreds of KB on pages that never touch the database.
 */
import { getApp, getApps, initializeApp } from "firebase/app";

import { FIREBASE_PUBLIC_CONFIG, USE_EMULATOR } from "./public-config";

/** `getApps()` avoids `duplicate-app` when `next dev` HMR reloads the module. */
export const firebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_PUBLIC_CONFIG);

export const useEmulator = USE_EMULATOR;
