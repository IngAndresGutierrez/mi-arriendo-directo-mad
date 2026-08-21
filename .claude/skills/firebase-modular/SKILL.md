---
name: firebase-modular
description: Using the modular Firebase JS SDK (v10/v11/v12) on the client. Use it when initializing Firebase, reading/writing Firestore, authenticating users, uploading files to Storage, or whenever legacy v8 syntax shows up (firebase.firestore(), .collection().doc()). Alias - firebase-v10-sdk.
---

# Modular Firebase JS SDK (client)

The installed SDK is `firebase` **v12** (modular API, identical to v10/v11). **Never** write
namespaced v8 / v9-compat syntax.

## Hard rule: v8 is forbidden

```ts
// ❌ FORBIDDEN (v8 / compat) — it does not exist in the modular bundle
import firebase from "firebase/app";
firebase.initializeApp(config);
firebase.firestore().collection("properties").doc(id).get();
db.collection("applications").where("status", "==", "pending").get();

// ✅ MODULAR (v10+) — tree-shakeable
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
const snap = await getDoc(doc(db, "properties", id));
const q = query(collection(db, "applications"), where("status", "==", "pending"));
```

Signs you are copying legacy code: `firebase.` as a global object, chained
`.collection(...).doc(...)`, `firebase/compat/*`, `FieldValue.serverTimestamp()` as an instance
method, `db.settings({})`.

## One module per service (never a barrel)

The SDK is already initialized. Import **only the service you use**:

| Import | Brings |
| --- | --- |
| `@/shared/firebase/app` | the initialized app only (`firebaseApp`, the emulator flag) |
| `@/shared/firebase/auth` | `auth` |
| `@/shared/firebase/db` | `db` (Firestore, with persistent cache) |
| `@/shared/firebase/storage` | `storage` |

**Do not create a module that re-exports all three.** That barrel existed and cost ~630 KB of
SDK on the login screen, which only authenticates; splitting it cut the initial bundle by 35 %
(measured). If a screen does not query Firestore, it must not pay for Firestore.

Each module does its own `initializeApp` guard (`getApps()`, in `app.ts`) and connects its
emulator right after creating the instance.

```ts
// shared/firebase/app.ts (excerpt)
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";

const options: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(options);
```

- `enableIndexedDbPersistence()` is **deprecated**: use `persistentLocalCache` in
  `initializeFirestore`.
- Only the `NEXT_PUBLIC_*` keys of this config live on the client. The service account private
  key **never** enters this file → see the `firebase-admin-sdk` skill.
- Analytics imports `app.ts`, never a service module, and is loaded through a dynamic
  `import()` after hydration (`shared/analytics.tsx`).

## Client / server boundary in the App Router

The client SDK needs `window` for Auth persistence. Therefore:

- Every file importing `firebase/auth` or realtime Firestore hooks lives in a module marked
  `"use client"`.
- For reads in Server Components / Server Actions use the **Admin SDK**, not this one.
- Do not import the client modules from a Server Component: they drag the SDK into the RSC
  payload.

## Canonical operations

```ts
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// create with a generated id
await addDoc(collection(db, "applications"), {
  propertyId,
  tenantUid: auth.currentUser!.uid,
  status: "pending",
  createdAt: serverTimestamp(),
});

// upsert with a known id
await setDoc(doc(db, "properties", propertyId), data, { merge: true });

// update nested fields: dot notation, not partial objects
await updateDoc(doc(db, "properties", propertyId), { "rent.amount": 1_800_000 });

// query
const q = query(
  collection(db, "properties"),
  where("city", "==", "Bogotá"),
  where("status", "==", "available"),
  orderBy("createdAt", "desc"),
  limit(20),
);
const snap = await getDocs(q);
const properties = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// realtime: ALWAYS clean up the subscription
useEffect(() => onSnapshot(q, (s) => setDocs(s.docs.map((d) => d.data()))), [q]);
```

- Timestamps: `serverTimestamp()` imported from `firebase/firestore`, never `new Date()` for
  audit fields.
- Money: store **integer pesos** (`1_800_000`), never floats.
- Data coming back from Firestore is `DocumentData`: type it with converters (the
  `typescript-strict` skill), not with `as any`.

## Auth

```ts
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const cred = await signInWithEmailAndPassword(auth, email, password);
const idToken = await cred.user.getIdToken(); // → POST to a Route Handler to mint the session cookie
```

The session pattern in this project: sign in on the client → `getIdToken()` → a Route Handler
that mints a **session cookie** with the Admin SDK. That way Server Components know the user
without the client SDK.

## Storage (identity documents, employment letters, contracts)

```ts
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// path namespaced by uid → the Storage Rules can isolate per owner
const path = `applicants/${uid}/${applicationId}/id-front.jpg`;
const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
```

Never store identity documents in public paths, or under a guessable name with no uid. Validate
`contentType` and size **in the rules**, not only on the client.

## Emulators

```ts
if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
```

Connect the emulators **immediately after** creating each instance and before any operation.

## Before writing code

If you are unsure about a signature, check the real types in
`node_modules/firebase/firestore/dist/` or `node_modules/@firebase/firestore/dist/*.d.ts`
instead of assuming.
