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
- `lib/firebase/app.ts` — solo inicializa la app (`firebaseApp`). Un módulo por servicio:
  `lib/firebase/auth.ts`, `lib/firebase/db.ts`, `lib/firebase/storage.ts`. **No hagas un
  barrel que reexporte los tres**: costaba 630 KB de SDK en el login.
- `components/analytics.tsx` — carga Analytics con `import()` dinámico tras la hidratación.
- `components/brand/logo.tsx` — `<Logo width={200} priority />`; único sitio con las
  dimensiones del PNG.
- `lib/firebase/admin.ts` — Admin SDK (`server-only`): `adminAuth`, `adminDb`, `adminStorage`.
- `lib/auth/session.ts` — `getSessionUser()`, `requireUser()`, `requireRole()` sobre la cookie
  httpOnly `session`.
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `firebase.json`.
- `app/globals.css` — tokens MAD UI (light + dark, sidebar, charts, estados del dominio).
- `components.json` — shadcn `radix-nova`. Usa `shadcn add`, **nunca** `shadcn init` de nuevo.
- `.env.example` — plantilla; copia a `.env.local` (ya creado con las llaves públicas).
- `.firebaserc` — proyecto por defecto: **`mi-arriendo-directo-mad`**.
- `lib/firebase/analytics.ts` — Analytics diferido con `isSupported()`; nunca le pases datos
  personales como parámetros de evento.

## Rutas (todas en español)
Las constantes viven en `lib/auth/routes.ts`; usa esas, no strings literales.

| Ruta | Constante | Qué es |
| --- | --- | --- |
| `/` | `LOGIN_ROUTE` | Login (correo + contraseña, Google). Es la raíz del sitio. |
| `/registro` | `SIGNUP_ROUTE` | Registro en 2 pasos: correo → contraseña. |
| `/panel` | `HOME_ROUTE` | Destino tras autenticarse. Provisional: reemplazar por el portal real. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | **Sin implementar** (da 404). |

- `POST /api/session` canjea el idToken por session cookie httpOnly; `DELETE` cierra sesión y
  revoca los refresh tokens.
- `requireUser()` redirige a `LOGIN_ROUTE`; `requireRole()` a `HOME_ROUTE`.
- **`/` es el login, así que el destino tras entrar NUNCA puede ser `/`**: sería un bucle
  infinito. `safeRedirect()` rechaza `/`, `/registro` y `/recuperar` como destino, además de
  cualquier URL externa (open redirect).
- El layout de login y registro es `components/auth/auth-shell.tsx`. Su panel lateral usa el
  token `panel-marca` (púrpura en ambos temas), nunca `bg-primary`.
- El correo del paso 1 del registro vive en estado del componente, **nunca en la URL**.

Enlaces que aún no tienen ruta (dan 404): `/recuperar`, `/terminos`, `/privacidad`.
El documento `usuarios/{uid}` y el claim `rol` se crean en el onboarding, no en el registro:
las rules exigen `nombre` y el diseño de registro no lo pide.

## Skills del proyecto
Las skills en `.claude/skills/` son la fuente de verdad de cada área. Las dos últimas son
externas, instaladas con `npx skills add` y versionadas en `.agents/skills/`. Invócalas **antes** de
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
| `mad-feature` | construir una pantalla o flujo completo desde un mockup — orquesta las demás |
| `frontend-design` | jerarquía visual, tipografía, composición (**no** para elegir colores: la paleta ya está fija) |
| `vercel-react-best-practices` | rendimiento: waterfalls, bundle, RSC, re-renders |

## Convención de nombres
- **Identificadores en inglés**: variables, funciones, tipos, componentes, props, archivos.
- **Copy y comentarios en español** (es-CO): es el idioma del producto y del equipo.
- **Vocabulario del dominio, en español**: `inquilino`, `propietario`, `inmueble`,
  `postulacion`, `canon`. Son los nombres reales de las colecciones de Firestore y de los
  custom claims; traducirlos desalinearía el código de las rules desplegadas.
- **URLs en español** (`/registro`, `/panel`, `/recuperar`): son visibles para el usuario.

## Componentes compartidos de formulario
Reutilízalos en vez de repetir markup; antes cada formulario duplicaba el ARIA y se corría
el riesgo de dejar un campo sin conectar.

| Componente | Para |
| --- | --- |
| `components/ui/text-field.tsx` | `TextField`: label + input + error + `aria-invalid`/`aria-describedby`. Acepta `{...register("campo")}` directo. |
| `components/auth/form-alert.tsx` | `FormAlert`: error a nivel de formulario con `role="alert"`. |
| `components/auth/google-button.tsx` | `GoogleButton`: acceso con Google, con spinner. |
| `components/auth/or-divider.tsx` | `OrDivider`: separador "o". |
| `components/auth/submit-button.tsx` | `SubmitButton`: CTA cian con spinner y etiqueta de progreso. |
| `components/auth/password-requirements.tsx` | `PasswordRequirements`: checklist derivado de `PASSWORD_REQUIREMENTS`. |
| `components/auth/auth-shell.tsx` | `AuthShell`: layout de dos columnas de login y registro. |
| `components/brand/logo.tsx` | `Logo`: único sitio con las dimensiones del PNG. |

## Comandos de verificación
```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm build         # next build
pnpm test          # unitarios: schemas y lógica pura (tests/unit/)
pnpm test:rules    # security rules contra el emulador (tests/rules/) — requiere JDK 21+
```

## Tests de Security Rules
`pnpm test:rules` levanta el emulador de Firestore y corre `tests/rules/` (35 casos, con
caso negativo obligatorio). Requiere **JDK 21+**; `openjdk@21` de Homebrew es *keg-only*, así
que hay que ponerlo en el PATH:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"        # persistir en ~/.zshrc si lo usas seguido
pnpm test:rules
```

Toda regla nueva o modificada se prueba aquí antes de `firebase deploy`. Al agregar una
colección, agrega también su test de acceso denegado.

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
