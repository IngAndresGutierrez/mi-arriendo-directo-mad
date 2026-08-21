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
 * Each value still honours an environment override, so another Firebase project can be pointed
 * at without touching this file. The service account NEVER belongs here: see
 * `shared/firebase/admin.ts`.
 */
import type { FirebaseOptions } from "firebase/app";

export const FIREBASE_PUBLIC_CONFIG: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDNjhH1vSsSFT2ooB0bVXuxEQktu7ZKNFs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "mi-arriendo-directo-mad.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mi-arriendo-directo-mad",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "mi-arriendo-directo-mad.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "58684574578",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:58684574578:web:4d1cb22edf2e0863a66beb",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-T8BTMETF8D",
};

/** Emulators are opt-in and off unless the environment asks for them. */
export const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1";
