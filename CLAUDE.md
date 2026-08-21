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
- `shared/firebase/app.ts` — solo inicializa la app (`firebaseApp`). Un módulo por servicio:
  `shared/firebase/auth.ts`, `shared/firebase/db.ts`, `shared/firebase/storage.ts`. **No hagas un
  barrel que reexporte los tres**: costaba 630 KB de SDK en el login.
- `shared/analytics.tsx` — carga Analytics con `import()` dinámico tras la hidratación.
- `shared/brand/logo.tsx` — `<Logo width={200} priority />`; único sitio con las
  dimensiones del PNG.
- `shared/firebase/admin.ts` — Admin SDK (`server-only`): `adminAuth`, `adminDb`, `adminStorage`.
- `shared/auth/session.ts` — `getSessionUser()`, `requireUser()`, `requireRole()` sobre la cookie
  httpOnly `session`.
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `firebase.json`.
- `app/globals.css` — tokens MAD UI (light + dark, sidebar, charts, estados del dominio).
- `components.json` — shadcn `radix-nova`. Usa `shadcn add`, **nunca** `shadcn init` de nuevo.
- `.env.example` — plantilla; copia a `.env.local` (ya creado con las llaves públicas).
- `.firebaserc` — proyecto por defecto: **`mi-arriendo-directo-mad`**.
- `shared/firebase/analytics.ts` — Analytics diferido con `isSupported()`; nunca le pases datos
  personales como parámetros de evento.

## Estructura del código
El corte es **vertical por dominio**. `mad-architecture` es la fuente de verdad; en corto:

```
app/                  solo routing. (auth)/ y (app)/ son route groups: no cambian la URL
features/<dominio>/   domain/ validations/ data/ actions/ ui/ + index.ts (API pública)
shared/               ui/ form/ shell/ brand/ auth/ firebase/ format/ phone/ lib/
tests/rules/          security rules (los unitarios van colocados junto al código)
```

Las fronteras no son una convención escrita, están **verificadas**: `tsconfig` solo expone
`@/app/*`, `@/features/*` y `@/shared/*` (no hay comodín `@/*`), eslint prohíbe importar los
internos de otro feature y el Admin SDK fuera de `data/`/`actions/`/`api/`, y `pnpm arch`
(dependency-cruiser) revisa ciclos, `shared → features` y la pureza de `domain/`.

Dentro de un feature se importa con **rutas relativas**; `@/features/<dominio>` es solo para
cruzar de módulo, y siempre contra su `index.ts`.

## Rutas (todas en español)
Las constantes viven en `shared/auth/routes.ts`; usa esas, no strings literales.

| Ruta | Constante | Qué es |
| --- | --- | --- |
| `/` | `LOGIN_ROUTE` | Login (correo + contraseña, Google). Es la raíz del sitio. |
| `/registro` | `SIGNUP_ROUTE` | Registro en 2 pasos: correo → contraseña. |
| `/registro/completar-perfil` | `COMPLETE_PROFILE_ROUTE` | Onboarding: hay sesión pero falta el perfil. |
| `/inicio` | `HOME_ROUTE` | Portal del usuario: saludo, contratos y atajos. Destino tras autenticarse. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | **Sin implementar** (da 404). |

- `POST /api/session` canjea el idToken por session cookie httpOnly; `DELETE` cierra sesión y
  revoca los refresh tokens.
- `requireUser()` redirige a `LOGIN_ROUTE`; `requireRole()` a `HOME_ROUTE`.
- **`requireCompleteProfile()` es el guard de toda pantalla del producto**: exige sesión y
  perfil. Vive en `features/perfil` (se importa de `@/features/perfil`), no en `shared/auth`:
  "¿tiene perfil?" es una pregunta del dominio de perfil. La pantalla de onboarding usa
  `requireUser()`, no esta, o el redirect haría bucle.
- `POST /api/session` crea la cookie (exige login reciente); **`PATCH` la re-acuña** con los
  claims actuales tras cambiar el rol; `DELETE` cierra sesión.
- **`/` es el login, así que el destino tras entrar NUNCA puede ser `/`**: sería un bucle
  infinito. `safeRedirect()` rechaza `/`, `/registro` y `/recuperar` como destino, además de
  cualquier URL externa (open redirect).
- El layout de login y registro es `shared/shell/auth-shell.tsx`. Su panel lateral usa el
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
| `mad-architecture` | dónde va cada archivo, fronteras entre módulos, mover/renombrar carpetas, refactor estructural |
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
| `shared/form/text-field.tsx` | `TextField`: label + input + error + `aria-invalid`/`aria-describedby`. Acepta `{...register("campo")}` directo. |
| `shared/form/form-alert.tsx` | `FormAlert`: error a nivel de formulario con `role="alert"`. |
| `features/auth/ui/google-button.tsx` | `GoogleButton`: acceso con Google, con spinner. |
| `features/auth/ui/or-divider.tsx` | `OrDivider`: separador "o". |
| `shared/form/submit-button.tsx` | `SubmitButton`: CTA cian con spinner y etiqueta de progreso. |
| `features/auth/ui/password-requirements.tsx` | `PasswordRequirements`: checklist derivado de `PASSWORD_REQUIREMENTS`. |
| `shared/shell/auth-shell.tsx` | `AuthShell`: layout de dos columnas de login y registro. |
| `shared/brand/logo.tsx` | `Logo`: único sitio con las dimensiones del PNG. |
| `shared/form/select-field.tsx` | `SelectField`: select con label, error y ARIA. Se controla con `Controller`. |
| `shared/form/phone-field.tsx` | `PhoneField`: selector de país + número nacional. |
| `shared/shell/app-sidebar.tsx` | `AppSidebar`: menú lateral del producto. **Es Client Component**: pasa componentes de icono a `NavItem` y usa `usePathname`. |
| `shared/ui/nav-item.tsx` | `NavItem`: sin `href` se renderiza deshabilitado con tooltip "Próximamente". |
| `shared/ui/coming-soon-card.tsx` | `ComingSoonCard`: envuelve UI maquetada cuya función no existe aún. |

## Teléfonos
- Se guardan en **E.164** (`telefono: "+573001234567"`) más el ISO del país
  (`telefonoPais: "CO"`). El país no se deduce del número: `+1` lo comparten Estados Unidos,
  Canadá, Puerto Rico y República Dominicana.
- El catálogo está en `shared/phone/countries.ts`. **Colombia es el valor por defecto** y
  encabeza la lista. La lista es curada, no exhaustiva: cada indicativo está verificado.
- La validación es por país: Colombia estricta (10 dígitos empezando por 3), el resto
  genérica (6–14 dígitos). Para endurecer otro país, añade su regla en `PHONE_RULES`.
- El formulario revalida el número al cambiar de país; si no, el error del país anterior se
  queda visible.

## Secciones aún no construidas
El menú lateral muestra Soporte, Contrato, Facturación y Ajustes **deshabilitadas** con un
tooltip de "Próximamente", en lugar de enlazar a 404. Para activar una: crea la ruta y
añade su `href` en el arreglo `NAV` de `shared/shell/app-sidebar.tsx`.

La tarjeta de soporte y la del catálogo están maquetadas dentro de `ComingSoonCard`: se ven
pero no son interactivas. La de soporte **no lleva foto de persona** a propósito — una imagen
de stock presentada como "nuestro equipo" afirmaría algo falso.

## Comandos de verificación
```bash
pnpm typegen       # next typegen — regenera los tipos de ruta (PageProps, LayoutProps)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint, incluidas las fronteras entre módulos
pnpm arch          # dependency-cruiser: ciclos y flechas prohibidas entre capas
pnpm build         # next build
pnpm test          # unitarios: schemas y lógica pura, colocados en features/ y shared/
pnpm test:rules    # security rules contra el emulador (tests/rules/) — requiere JDK 21+
```

Tras mover o renombrar una ruta: `rm -rf .next && pnpm typegen`, o `tsc` falla por los tipos
generados y el error no tiene nada que ver con tu cambio.

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
2. **`firebase-admin` es solo servidor.** `shared/firebase/admin.ts` empieza con
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
