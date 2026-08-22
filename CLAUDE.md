# miarriendodirecto.com — Project Guide

## Tech Stack
- **Frontend:** Next.js (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- **Backend:** Firebase Modular SDK v10+, Firestore, Firebase Auth, Cloud Storage

## Design System (MAD UI)
- **Primary / Trust:** `#2D124D` (deep purple) -> headings, structure, active borders.
- **Secondary / Accent:** `#00E5FF` (electric cyan) -> primary CTAs, "approved" status badges, progress bars.
- **Background:** `#F8F9FA` (off-white / sand) -> page and container backgrounds.

## Code Rules
- **Next.js:** Server Components by default. Add `'use client'` only for interactive sections.
- **Firebase:** Modular SDK v10+ only (`getDoc`, `setDoc`, `addDoc`). Never the legacy v8 syntax.
- **Validation:** Zod schemas wired to `react-hook-form`.
- **UI:** Reuse `shadcn/ui` components, and never leave unfinished comments or `TODO` markers.

## Versioned Next.js docs
@AGENTS.md

The installed version is **Next.js 16.3.2** (Turbopack by default, async `params`/`cookies()`,
`middleware.ts` → `proxy.ts`). Check `node_modules/next/dist/docs/01-app/` before writing
framework code.

## Language policy
Everything is in **English** — identifiers, comments, JSDoc, test names, commit messages,
documentation, Firestore collection and field names, custom claims and their values.

Three exceptions, and only these:
1. **URLs** (`/registro`, `/inicio`, `/registro/completar-perfil`): users see them.
2. **Copy visible to the user**: labels, error messages, titles, page metadata. The product
   is Colombian PropTech and speaks **es-CO** to tenants and landlords.
3. **Proper nouns and user content**: department names (`Bogotá D.C.`), addresses, and the
   fixture data that stands in for what a user would type.

Keys are English, labels are Spanish — `GENDER_LABELS` and `STATUS_LABEL` are the pattern:
`{ female: "Femenino" }`, `{ active: "Vigente" }`.

Domain glossary (the deployed names): `users`, `properties`, `applications`, `contracts`,
`payments`; `role` with values `tenant` / `landlord` / `admin`; `rent` for the monthly amount,
`status` for state. `scripts/migrate-i18n-domain.mjs` records the rename from the Spanish
names this project started with.

## Base files already in place
- `shared/firebase/app.ts` — initializes the app only (`firebaseApp`). One module per service:
  `shared/firebase/auth.ts`, `shared/firebase/db.ts`, `shared/firebase/storage.ts`. **Never write
  a barrel re-exporting the three**: it cost 630 KB of SDK on the login screen.
- `shared/analytics.tsx` — loads Analytics through a dynamic `import()` after hydration.
- `shared/brand/logo.tsx` — `<Logo width={200} priority />`; the only place with the PNG's
  dimensions.
- `shared/firebase/admin.ts` — Admin SDK (`server-only`): `adminAuth()`, `adminDb()`,
  `adminStorage()`. They are **lazy accessors, not constants**: importing the module must not
  read the service account, because `next build` imports every route and on Vercel the
  credentials are sensitive env vars that never reach the build step.
- `shared/auth/session.ts` — `getSessionUser()`, `requireUser()`, `requireRole()` over the
  httpOnly `session` cookie.
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `firebase.json`.
- `app/globals.css` — MAD UI tokens (light + dark, sidebar, charts, domain states).
- `components.json` — shadcn `radix-nova`. Use `shadcn add`, **never** `shadcn init` again, and
  **never pass `--overwrite`**: `add` also rewrites the component's dependencies. Installing the
  dialog with it rewrote `shared/ui/button.tsx` and silently dropped the `accent` variant and the
  `xl` size — the brand CTA every form submits with. After any `shadcn add`, read `git diff` and
  look for files you did not expect; recover one with `git checkout shared/ui/<file>.tsx`.
- `.env.example` — template; copy to `.env.local` (already created with the public keys).
- `shared/firebase/public-config.ts` — the Firebase **web** config, hardcoded. Public by
  design: Next inlines every `NEXT_PUBLIC_*` into the browser bundle, so these values ship to
  every visitor and access control lives in the rules. They are in code because the server needs
  them at request time too and this project's Vercel variables are sensitive ones that never
  reach the Function; reading them from `process.env` returned 500 on every route. Each value
  still honours an env override. The service account never goes here.
- `.firebaserc` — default project: **`mi-arriendo-directo-mad`**.
- `shared/firebase/analytics.ts` — deferred Analytics behind `isSupported()`; never pass
  personal data as event parameters.

## Code structure
The split is **vertical, by domain**. `mad-architecture` is the source of truth; in short:

```
app/                  routing only. (auth)/ and (app)/ are route groups: they do not change the URL
features/<domain>/    domain/ validations/ data/ actions/ ui/ + index.ts (public API)
shared/               ui/ form/ shell/ brand/ auth/ firebase/ format/ phone/ lib/
tests/rules/          security rules (unit tests are colocated with the code)
```

The boundaries are not a written convention, they are **enforced**: `tsconfig` only exposes
`@/app/*`, `@/features/*` and `@/shared/*` (there is no `@/*` wildcard), eslint forbids
importing another feature's internals and the Admin SDK outside `data/`/`actions/`/`api/`, and
`pnpm arch` (dependency-cruiser) checks cycles, `shared → features` and the purity of `domain/`.

Inside a feature, import with **relative paths**; `@/features/<domain>` is only for crossing
module boundaries, and always against its `index.ts`.

## Routes (all in Spanish)
The constants live in `shared/auth/routes.ts`; use those, never literal strings.

| Route | Constant | What it is |
| --- | --- | --- |
| `/` | `LOGIN_ROUTE` | Login (email + password, Google). It is the site root. |
| `/registro` | `SIGNUP_ROUTE` | Two-step signup: email → password. |
| `/registro/completar-perfil` | `COMPLETE_PROFILE_ROUTE` | Onboarding: there is a session but no profile yet. |
| `/inicio` | `HOME_ROUTE` | User portal: greeting, contracts and shortcuts. Destination after signing in. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | **Not implemented** (404). |
| `/inmuebles/publicar` | `PUBLISH_PROPERTY_ROUTE` | Where a landlord publishes. Needs a complete profile. |
| `/inmuebles/<slug>` | `propertyDetailRoute(slug)` | Public detail of one property. No session needed. |
| `/inmuebles` | `PROPERTIES_ROUTE` | Public catalog. **Not built yet** (404). |

- `POST /api/session` exchanges the idToken for an httpOnly session cookie (and requires a
  recent sign-in); **`PATCH` re-mints it** with the current claims after a role change;
  `DELETE` signs out and revokes the refresh tokens.
- `requireUser()` redirects to `LOGIN_ROUTE`; `requireRole()` to `HOME_ROUTE`.
- **`requireCompleteProfile()` is the guard for every product screen**: it requires a session
  and a profile. It lives in `features/profile` (import it from `@/features/profile`), not in
  `shared/auth`: "does this user have a profile?" is a question of the profile domain. The
  onboarding screen uses `requireUser()`, not this one, or the redirect would loop.
- **`/` is the login, so the destination after signing in can NEVER be `/`**: it would loop
  forever. `safeRedirect()` rejects `/`, `/registro` and `/recuperar` as destinations, plus
  any external URL (open redirect).
- The login and signup layout is `shared/shell/auth-shell.tsx`. Its side panel uses the
  `panel-marca` token (purple in both themes), never `bg-primary`.
- The email from signup step 1 lives in component state, **never in the URL**.
- **A property's URL is its slug alone** — `/inmuebles/apartaestudio-en-los-alcazares-manizales`,
  with no id appended: these links get pasted into WhatsApp and Facebook groups, where a random
  code at the end reads as unsafe to click. Uniqueness comes from `propertySlugs/{slug}`, whose
  document id *is* the slug, so a page resolves with one `get` and two landlords cannot claim the
  same URL. Older shapes (`<slug>-<id>` and a bare `<id>`) are permanently redirected, so links
  already shared keep working.

Links with no route yet (they 404): `/recuperar`, `/terminos`, `/privacidad`.
The `users/{uid}` document and the `role` claim are created during onboarding, not at signup:
the rules require `fullName` and the signup design does not ask for it.

## Project skills
The skills in `.claude/skills/` are the source of truth for their area. The last two are
external, installed with `npx skills add` and versioned in `.agents/skills/`. Invoke them
**before** writing code, not after:

| Skill | When |
| --- | --- |
| `nextjs-app-router` | any file in `app/`, `next.config.ts`, `proxy.ts`, Server Actions, caching |
| `firebase-modular` | client SDK: init, Firestore, Auth, Storage, emulators |
| `firebase-admin-sdk` | server: session cookies, custom claims, privileged writes |
| `firestore-security-rules` | `firestore.rules`, `storage.rules`, a new collection, "who can read this?" |
| `shadcn-tailwind` | components, `app/globals.css`, `components.json`, colors |
| `typescript-strict` | domain types, Firestore converters, `tsconfig.json` |
| `zod-react-hook-form` | any form or validation schema |
| `mad-feature` | building a whole screen or flow from a mockup — it orchestrates the rest |
| `mad-architecture` | where each file goes, module boundaries, moving/renaming folders, structural refactors |
| `frontend-design` | visual hierarchy, typography, composition (**not** for picking colors: the palette is fixed) |
| `vercel-react-best-practices` | performance: waterfalls, bundle, RSC, re-renders |

## Naming conventions
- **Everything in English**: variables, functions, types, components, props, files, comments,
  test names, Firestore collections and fields, custom claims and their values.
- **Files** in `kebab-case`, **components** in `PascalCase`, **module constants** in
  `SCREAMING_SNAKE_CASE`.
- **The three exceptions** are in "Language policy" above: URLs, user-facing copy, and
  proper nouns / user content.

## Shared form components
Reuse them instead of repeating markup; each form used to duplicate the ARIA wiring, with the
risk of leaving a field unconnected.

| Component | For |
| --- | --- |
| `shared/form/text-field.tsx` | `TextField`: label + input + error + `aria-invalid`/`aria-describedby`. Takes `{...register("field")}` directly. |
| `shared/form/form-alert.tsx` | `FormAlert`: form-level error with `role="alert"`. |
| `features/auth/ui/google-button.tsx` | `GoogleButton`: Google sign-in, with spinner. |
| `features/auth/ui/or-divider.tsx` | `OrDivider`: the "or" divider. |
| `shared/form/submit-button.tsx` | `SubmitButton`: cyan CTA with spinner and progress label. |
| `features/auth/ui/password-requirements.tsx` | `PasswordRequirements`: checklist derived from `PASSWORD_REQUIREMENTS`. |
| `shared/shell/auth-shell.tsx` | `AuthShell`: two-column layout for login and signup. |
| `shared/brand/logo.tsx` | `Logo`: the only place with the PNG's dimensions. |
| `shared/form/select-field.tsx` | `SelectField`: select with label, error and ARIA. Controlled with `Controller`. |
| `shared/form/phone-field.tsx` | `PhoneField`: country selector + national number. |
| `shared/shell/app-shell.tsx` | `AppShell`: the frame of every product screen — menu and content. A page brings only its heading and its body. |
| `shared/shell/app-nav.tsx` | `AppNav`: the `NAV` list itself, shared by the two surfaces that show it. **It is a Client Component**: it passes icon components to `NavItem`. |
| `shared/shell/app-sidebar.tsx` | `AppSidebar`: the menu always visible from `lg` up. |
| `shared/shell/app-drawer.tsx` | `AppDrawer`: below `lg`, the bar with the hamburger plus the same menu in a drawer. Owns the open state. |
| `shared/ui/nav-item.tsx` | `NavItem`: a drawer row. Without `href` it renders disabled with a "Pronto" badge. `activeOn` marks the section on routes that do not hang off its path. |
| `shared/ui/coming-soon-card.tsx` | `ComingSoonCard`: wraps mocked-up UI whose function does not exist yet. |

## Phone numbers
- Stored in **E.164** (`phone: "+573001234567"`) plus the country ISO (`phoneCountry: "CO"`).
  The country is not derived from the number: `+1` is shared by the United States, Canada,
  Puerto Rico and the Dominican Republic.
- The catalog is in `shared/phone/countries.ts`. **Colombia is the default** and heads the
  list. The list is curated, not exhaustive: every dial code in it is verified.
- Validation is per country: strict for Colombia (10 digits starting with 3), generic for the
  rest (6–14 digits). To tighten another country, add its rule to `PHONE_RULES`.
- The form revalidates the number when the country changes; without that, the previous
  country's error stays on screen.

## Sections not built yet
The menu shows Soporte, Contrato, Facturación and Ajustes **disabled**, with a "Pronto"
badge, instead of linking to a 404. To activate one: create the route and add its `href` to
the `NAV` array in `shared/shell/app-nav.tsx` — the one list both surfaces render, so the
sidebar and the drawer cannot disagree about what the product contains.

**The menu has two shapes and one content.** From `lg` up it is a fixed 16rem sidebar: a wide
screen has the room, and hiding the sections behind a click there costs one on every
navigation and buys nothing. Below `lg` it is a drawer behind the hamburger, because 16rem of
permanent menu on a phone would leave nothing for the property form.

There is **no "Publicar" entry in the menu**: publishing is something you do to your
properties, not a separate place. The action lives on `/mis-inmuebles`, next to the list it
adds to, and the drawer keeps "Mis inmuebles" marked as the current section while the form is
open (`activeOn`).

The support card and the catalog card are mocked up inside `ComingSoonCard`: they are visible
but not interactive. The support card deliberately **carries no photo of a person** — a stock
image presented as "our team" would claim something false.

## Verification commands
```bash
pnpm typegen       # next typegen — regenerates the route types (PageProps, LayoutProps)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint, module boundaries included
pnpm arch          # dependency-cruiser: cycles and forbidden arrows between layers
pnpm build         # next build
pnpm test          # unit: schemas and pure logic, colocated in features/ and shared/
pnpm test:rules    # security rules against the emulator (tests/rules/) — needs JDK 21+
```

After moving or renaming a route: `rm -rf .next && pnpm typegen`, or `tsc` fails on the
generated types with an error that has nothing to do with your change.

## Security Rules tests
`pnpm test:rules` boots the Firestore emulator and runs `tests/rules/` (59 cases, every rule
with a mandatory negative case). It needs **JDK 21+**; Homebrew's `openjdk@21` is *keg-only*,
so it has to go on the PATH:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"        # persist it in ~/.zshrc if you use it often
pnpm test:rules
```

Every new or modified rule is tested here before `firebase deploy`. When you add a
collection, add its access-denied test too.

## Security — non-negotiable invariants
1. **No secrets on the client.** Only the `NEXT_PUBLIC_FIREBASE_*` keys (the web SDK's public
   config) reach the browser. `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` and any service
   account credential are **never** prefixed with `NEXT_PUBLIC_`, hardcoded, logged or
   committed.
2. **`firebase-admin` is server-only.** `shared/firebase/admin.ts` starts with
   `import "server-only"` and is never imported from a file marked `"use client"`.
3. **Every Server Action and Route Handler revalidates**: authenticate (session) → validate
   (Zod) → authorize against the real data → business invariants → write. Never trust a `uid`
   or an `id` that arrives in the `FormData`.
4. **Security Rules are deny-by-default.** No `allow read, write: if true;` and no
   `if request.auth != null;` as a blanket rule. Identity documents, income, contracts and
   payments are not listable by the client.
5. **Sensitive data is never cached in a shared scope** (`"use cache"` without a per-uid tag),
   never stored in `localStorage`, never carried in `searchParams`, never logged.
   **Every `<form>` carries `method="post"`**, even the ones JavaScript submits: before the page
   hydrates there is no handler to prevent the default, and a form with no method is sent as a
   GET — the password in the URL, and from there in the browser history and the server logs.
   Next serves a POST to a page route as a normal render, so the fallback is the form again,
   empty, with nothing leaked.
6. **Any rules change is tested against the emulator** (`firebase emulators:exec`), negative
   case included, before `firebase deploy`.
