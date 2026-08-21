---
name: firebase-modular
description: Uso del Firebase JS SDK modular (v10/v11/v12) en el cliente. Úsala al inicializar Firebase, leer/escribir Firestore, autenticar usuarios, subir archivos a Storage o cuando aparezca sintaxis legada v8 (firebase.firestore(), .collection().doc()). Alias - firebase-v10-sdk.
---

# Firebase JS SDK modular (cliente)

El SDK instalado es `firebase` **v12** (API modular idéntica a v10/v11). **Nunca** escribas
sintaxis namespaced v8/v9-compat.

## Regla dura: v8 está prohibido

```ts
// ❌ PROHIBIDO (v8 / compat) — no existe en el bundle modular
import firebase from "firebase/app";
firebase.initializeApp(config);
firebase.firestore().collection("inmuebles").doc(id).get();
db.collection("postulaciones").where("estado", "==", "pendiente").get();

// ✅ MODULAR (v10+) — tree-shakeable
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
const snap = await getDoc(doc(db, "inmuebles", id));
const q = query(collection(db, "postulaciones"), where("estado", "==", "pendiente"));
```

Señales de que estás copiando código legado: `firebase.` como objeto global,
`.collection(...).doc(...)` encadenado, `firebase/compat/*`, `FieldValue.serverTimestamp()`
como método de instancia, `db.settings({})`.

## Un módulo por servicio (no un barrel)

El SDK ya está inicializado. Importa **solo el servicio que uses**:

| Import | Trae |
| --- | --- |
| `@/lib/firebase/app` | solo la app inicializada (`firebaseApp`, `usaEmulador`) |
| `@/lib/firebase/auth` | `auth` |
| `@/lib/firebase/db` | `db` (Firestore, con caché persistente) |
| `@/lib/firebase/storage` | `storage` |

**No crees un módulo que reexporte los tres.** Ese barrel existía y costaba ~630 KB de SDK
en la pantalla de login, que solo autentica; separarlo bajó el bundle inicial un 35 %
(medido). Si una pantalla no consulta Firestore, no debe pagar Firestore.

Cada módulo hace su propio guard de `initializeApp` (`getApps()`, en `app.ts`) y conecta su
emulador justo después de crear la instancia.

```ts
// lib/firebase/app.ts (extracto)
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

- `enableIndexedDbPersistence()` está **deprecado**: usa `persistentLocalCache` en
  `initializeFirestore`.
- Solo las llaves `NEXT_PUBLIC_*` de esta config viven en el cliente. La private key del
  service account **jamás** entra a este archivo → ver skill `firebase-admin-sdk`.
- Analytics importa `app.ts`, nunca un módulo de servicio, y se carga con `import()`
  dinámico tras la hidratación (`components/analytics.tsx`).

## Frontera cliente / servidor en App Router

El SDK de cliente necesita `window` para persistencia de Auth. Por eso:

- Todo archivo que importe `firebase/auth` o hooks de Firestore en tiempo real va en un
  módulo con `"use client"`.
- Para lectura en Server Components / Server Actions usa el **Admin SDK**, no este.
- No importes los módulos de cliente desde un Server Component: arrastran el SDK al RSC payload.

## Operaciones canónicas

```ts
import {
  addDoc,
  collection,
  deleteDoc,
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

// crear con id generado
await addDoc(collection(db, "postulaciones"), {
  inmuebleId,
  inquilinoUid: auth.currentUser!.uid,
  estado: "pendiente",
  createdAt: serverTimestamp(),
});

// upsert con id conocido
await setDoc(doc(db, "inmuebles", inmuebleId), data, { merge: true });

// actualizar campos anidados: notación de puntos, no objetos parciales
await updateDoc(doc(db, "inmuebles", inmuebleId), { "canon.valor": 1_800_000 });

// consulta
const q = query(
  collection(db, "inmuebles"),
  where("ciudad", "==", "Bogotá"),
  where("estado", "==", "disponible"),
  orderBy("createdAt", "desc"),
  limit(20),
);
const snap = await getDocs(q);
const inmuebles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// tiempo real: SIEMPRE limpia la suscripción
useEffect(() => onSnapshot(q, (s) => setDocs(s.docs.map((d) => d.data()))), [q]);
```

- Timestamps: `serverTimestamp()` importado de `firebase/firestore`, nunca `new Date()`
  para campos de auditoría.
- Dinero: guarda **enteros en pesos** (`1_800_000`), no floats.
- Los datos que vuelven de Firestore son `DocumentData`: tipa con converters
  (skill `typescript-strict`), no con `as any`.

## Auth

```ts
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const cred = await signInWithEmailAndPassword(auth, email, password);
const idToken = await cred.user.getIdToken(); // → POST a una Route Handler para crear session cookie
```

Patrón de sesión en este proyecto: login en el cliente → `getIdToken()` → Route Handler que
crea una **session cookie** con Admin SDK. Así los Server Components conocen al usuario sin
SDK de cliente.

## Storage (cédulas, certificados laborales, contratos)

```ts
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// ruta namespaced por uid → las Storage Rules pueden aislar por dueño
const path = `postulaciones/${uid}/${postulacionId}/cedula-frente.jpg`;
const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
```

Nunca guardes documentos de identidad en rutas públicas ni con nombre adivinable sin uid.
Valida `contentType` y tamaño **en las rules**, no solo en el cliente.

## Emuladores

```ts
if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
```

Conecta los emuladores **inmediatamente después** de crear cada instancia y antes de
cualquier operación.

## Antes de escribir código

Si dudas de una firma, verifica los tipos reales en `node_modules/firebase/firestore/dist/`
o `node_modules/@firebase/firestore/dist/*.d.ts` en lugar de asumir.
