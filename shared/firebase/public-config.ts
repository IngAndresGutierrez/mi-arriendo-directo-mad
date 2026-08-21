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
 * There is deliberately **no environment override**: an override that arrives empty or mangled
 * wins over the literal (`"" ?? fallback` is `""`), and that is exactly how production ended up
 * throwing `auth/invalid-api-key`. To point at another Firebase project, edit this file — one
 * visible place. The service account NEVER belongs here: see `shared/firebase/admin.ts`.
 */
import type { FirebaseOptions } from "firebase/app";

export const FIREBASE_PUBLIC_CONFIG: FirebaseOptions = {
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

/** Emulators are opt-in and off unless the environment asks for them. */
export const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";
