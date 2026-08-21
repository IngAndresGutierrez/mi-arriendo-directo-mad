# miarriendodirecto.com - Guía del Proyecto

## Stack Tecnológico
- **Frontend:** Next.js (App Router), TypeScript Strict, Tailwind CSS, shadcn/ui
- **Backend:** Firebase Modular SDK v10+, Firestore, Firebase Auth, Cloud Storage

## Sistema de Diseño (MAD UI)
- **Primary / Trust:** `#2D124D` (Púrpura Profundo) -> Encabezados, estructuras, bordes activos.
- **Secondary / Accent:** `#00E5FF` (Cian Eléctrico) -> Botones principales (CTA), badges de estado "Aprobado", barras de progreso.
- **Background:** `#F8F9FA` (Blanco Roto / Arena) -> Fondos de página y contenedores.

## Reglas de Código
- **Next.js:** Usa Server Components por defecto. Agrega `'use client'` solo para secciones interactivas.
- **Firebase:** Usa estrictamente el SDK Modular v10+ (`getDoc`, `setDoc`, `addDoc`). No uses la sintaxis legada v8.
- **Validaciones:** Esquemas con Zod e integración con `react-hook-form`.
- **UI:** Reutiliza componentes de `shadcn/ui` sin dejar comentarios inconclusos o marcadores `TODO`.

## Documentación de Next.js versionada
@AGENTS.md

La versión instalada es **Next.js 16.3.2** (Turbopack por defecto, `params`/`cookies()`
asíncronos, `middleware.ts` → `proxy.ts`). Consulta `node_modules/next/dist/docs/01-app/`
antes de escribir código de framework.

## Archivos base ya creados
- `lib/firebase/client.ts` — SDK modular (cliente): `auth`, `db`, `storage`, emuladores.
- `lib/firebase/admin.ts` — Admin SDK (`server-only`): `adminAuth`, `adminDb`, `adminStorage`.
- `lib/auth/session.ts` — `getSessionUser()`, `requireUser()`, `requireRol()` sobre la cookie
  httpOnly `session`.
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `firebase.json`.
- `app/globals.css` — tokens MAD UI (light + dark, sidebar, charts, estados del dominio).
- `components.json` — shadcn `radix-nova`. Usa `shadcn add`, **nunca** `shadcn init` de nuevo.
- `.env.example` — plantilla; copia a `.env.local` (ya creado con las llaves públicas).
- `.firebaserc` — proyecto por defecto: **`mi-arriendo-directo-mad`**.
- `lib/firebase/analytics.ts` — Analytics diferido con `isSupported()`; nunca le pases datos
  personales como parámetros de evento.

Pendiente de implementar: `POST/DELETE /api/session` (crear y borrar la session cookie) y la
ruta `/login` a la que redirige `requireUser()`.

## Skills del proyecto
Las skills en `.claude/skills/` son la fuente de verdad de cada área. Invócalas **antes** de
escribir código, no después:

| Skill | Cuándo |
| --- | --- |
| `nextjs-app-router` | cualquier archivo en `app/`, `next.config.ts`, `proxy.ts`, Server Actions, caching |
| `firebase-modular` | SDK de cliente: init, Firestore, Auth, Storage, emuladores |
| `firebase-admin-sdk` | servidor: session cookies, custom claims, escrituras privilegiadas |
| `firestore-security-rules` | `firestore.rules`, `storage.rules`, colección nueva, "¿quién puede leer esto?" |
| `shadcn-tailwind` | componentes, `app/globals.css`, `components.json`, colores |
| `typescript-strict` | tipos de dominio, converters de Firestore, `tsconfig.json` |
| `zod-react-hook-form` | cualquier formulario o schema de validación |

## Seguridad — invariantes que no se negocian
1. **Ningún secreto en el cliente.** Solo las llaves `NEXT_PUBLIC_FIREBASE_*` (config pública
   del SDK web) llegan al navegador. `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` y
   cualquier credencial de service account **jamás** se prefijan con `NEXT_PUBLIC_`, ni se
   hardcodean, ni se loggean, ni se commitean.
2. **`firebase-admin` es solo servidor.** `lib/firebase/admin.ts` empieza con
   `import "server-only"` y nunca se importa desde un archivo con `"use client"`.
3. **Toda Server Action y Route Handler revalida**: autenticar (sesión) → validar (Zod) →
   autorizar contra el dato real → invariantes de negocio → escribir. Nunca confíes en un
   `uid` o `id` que venga del `FormData`.
4. **Las Security Rules son deny-by-default.** Nada de `allow read, write: if true;` ni de
   `if request.auth != null;` como regla global. Cédulas, ingresos, contratos y pagos no son
   listables por el cliente.
5. **Datos sensibles nunca se cachean en un scope compartido** (`"use cache"` sin tag por
   uid), ni se guardan en `localStorage`, ni viajan en `searchParams`, ni se loggean.
6. **Cualquier cambio en rules se prueba con el emulador** (`firebase emulators:exec`) con
   caso negativo incluido, antes de `firebase deploy`.
