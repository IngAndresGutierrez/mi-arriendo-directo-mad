/**
 * Firebase **web** config. Public by design, and hardcoded on purpose.
 *
 * These values are not secrets: Next inlines every NEXT_PUBLIC_* variable into the browser
 * bundle, so anyone can read them from the shipped JavaScript. Access control comes from
 * firestore.rules and storage.rules, never from hiding this config.
 *
 * They live in code rather than in the environment because the server needs them at request
 * time too — a Client Component is rendered on the server first — and on Vercel this project's
 * variables are sensitive ones that do not reach the Function's environment. Reading them from
 * `process.env` produced a 500 on every route: "incomplete Firebase config" during SSR of the
 * login page.
 *
 * There is deliberately **no general environment override**: one that arrives empty or mangled
 * wins over the literal (`"" ?? fallback` is `""`), and that is exactly how production ended up
 * throwing `auth/invalid-api-key`. To point at another Firebase project, edit this file — one
 * visible place. The service account NEVER belongs here: see `shared/firebase/admin.ts`.
 *
 * The **one** exception is the emulator suite, and it is written so it cannot reproduce that bug:
 * it applies only when `NEXT_PUBLIC_FIREBASE_USE_EMULATOR` is `1` *and* the project id starts with
 * `demo-`. Production sets neither, and an empty or mangled value fails the `demo-` test and falls
 * straight back to the literal — so there is no path by which a bad variable reaches production.
 *
 * It has to exist because the two halves must agree: the browser mints the session token and the
 * Admin SDK verifies it, and against the emulators that failed with `session cookie has incorrect
 * "aud" claim. Expected "demo-mad-e2e" but got "mi-arriendo-directo-mad"`.
 */
import type { FirebaseOptions } from "firebase/app";

/** Emulators are opt-in and off unless the environment asks for them. */
export const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";

const PRODUCTION_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyDNjhH1vSsSFT2ooB0bVXuxEQktu7ZKNFs",
  authDomain: "mi-arriendo-directo-mad.firebaseapp.com",
  projectId: "mi-arriendo-directo-mad",
  storageBucket: "mi-arriendo-directo-mad.firebasestorage.app",
  messagingSenderId:
    "58684574578",
  appId: "1:58684574578:web:4d1cb22edf2e0863a66beb",
  measurementId:
    "G-T8BTMETF8D",
};

/**
 * The emulated project, when there is one. Both conditions are required, and both are absent in
 * production — see the note at the top of the file for why it is shaped this way.
 */
const EMULATED_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const emulatedConfig: FirebaseOptions | null =
  USE_EMULATOR && EMULATED_PROJECT_ID?.startsWith("demo-")
    ? {
        // The Auth emulator ignores the key; it only has to be present and non-empty.
        apiKey: "demo-emulator-key",
        authDomain: `${EMULATED_PROJECT_ID}.firebaseapp.com`,
        projectId: EMULATED_PROJECT_ID,
        storageBucket: `${EMULATED_PROJECT_ID}.firebasestorage.app`,
        messagingSenderId: "0",
        appId: `1:0:web:${EMULATED_PROJECT_ID.replace(/-/g, "")}`,
      }
    : null;

export const FIREBASE_PUBLIC_CONFIG: FirebaseOptions = emulatedConfig ?? PRODUCTION_CONFIG;
