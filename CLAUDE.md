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

Domain glossary (the deployed names): `users`, `properties`, `applications`, `tenantProfiles`,
`contracts`, `payments`, `notifications`; `role` with values `tenant` / `landlord` / `admin`; `rent` for the monthly amount,
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
  them at request time too, and this project's `NEXT_PUBLIC_*` variables in Vercel are marked
  **Sensitive**, which is not there to inline at *build* time — reading them from `process.env`
  returned 500 on every route. (A **Route Handler** does read a sensitive variable fine at request
  time: see `CRON_SECRET`. The two are different moments, and conflating them is what made this
  note wrong.) **There is deliberately no general env override**, contrary to what this said for a
  while: an override that arrives empty wins over the literal — `"" ?? fallback` is `""` — and that
  is how production threw `auth/invalid-api-key`. The **one** exception is the emulator, gated on
  `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` *and* a project id starting with `demo-`, neither of which
  production sets; an empty value fails the `demo-` test and falls back to the literal. It exists
  because the browser mints the session token and the Admin SDK verifies it, so both halves must
  name the same project. The service account never goes here.
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
| `/inicio` | `HOME_ROUTE` | User portal: greeting, **the contracts in course** and shortcuts. Destination after signing in. The card lists the open processes with the stage each one is on — it used to read a `contracts` collection nothing writes, so it told somebody with three open processes that they had nothing. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | **Not implemented** (404). |
| `/inmuebles/publicar` | `PUBLISH_PROPERTY_ROUTE` | Where a landlord publishes. Needs a complete profile. |
| — | — | Publishing requires the **matrícula inmobiliaria**, and it is stored beside the street in `properties/{id}/private/location`, never in the public document: with that number anyone can pull the certificate and read the address off it, so publishing it would publish the address by the back door. Validated loosely — the circle is two or three digits and the separator is written every way — because the only real check is against the registry, which this product does not do. |
| `/mis-inmuebles` | `MY_PROPERTIES_ROUTE` | The landlord's own listings: edit, copy link, delete. |
| `/postularme/<slug>` | `applyToPropertyRoute(slug)` | Where a tenant applies. Needs a complete profile; redirects to the process if one is already open. |
| `/contratos` | `CONTRACTS_ROUTE` | Every process the user is part of, on either side: the open ones with their stage rail, the closed ones with why they closed. **It is called "Contratos" because that is what it produces** — everything up to the first canon is the negotiation that *ends* in a signed contract, and the tenancy that runs afterwards is a different thing with a different lifetime. **`/contrato` and `/contrato/<id>` redirect here permanently** (301 in `next.config.ts`): every email already sent points at the old path, and the browser keeps the `#etapa-…` fragment across the redirect. |
| `/contratos/<id>` | `applicationRoute(id)` | One process: its seven stages. A non-party gets 404, the same answer as a process that does not exist. |
| `/arriendos` | `RENTALS_ROUTE` | The tenancies in course, on either side. This is the **other half of the product**: `/contratos` is the negotiation that ends in a signed contract, and this is the year that follows it. The question it answers is not "¿vamos a hacer esto?" but "¿está pagado este mes?". The forward that used to live here was a **307 written in the page and never a 301 nor a rule in `next.config.ts`**, precisely so this page could replace it — a permanent redirect would have been cached against it, and a `next.config.ts` rule resolves before routing and would shadow the route. |
| `/arriendos/<id>` | `rentalRoute(id)` | One tenancy: the term, where the canon goes, every month of it, and the incidents the tenant has reported. **The id is the application's**: one process produces one tenancy, so `/contratos/<id>` and `/arriendos/<id>` are two halves of one story under one key. A non-party — or an id whose process has not finished yet, so no tenancy was opened — is **forwarded to `/contratos/<id>`**, which is both the privacy answer and what keeps every notification sent before the rename working: they all point at `/arriendos/<id>#etapa-…`. |
| `/perfil-inquilino` | `TENANT_PROFILE_ROUTE` | "Mi perfil": the account details given at signup **and** the reusable tenant dossier, on one page with one save. |
| `/soporte` | `SUPPORT_ROUTE` | How to reach a person: WhatsApp and email, each saying what it is good for. No form and no ticket number — there is no queue behind one. **It is the one page that renders in either chrome** (`app/soporte/`, outside both route groups): the product's menu when there is a session, the public header when there is not. Needing help is not something you should have to sign in to do, and "Contacto" sits in the public header either way. |
| `/mis-inmuebles/<id>/editar` | `editPropertyRoute(id)` | Editing one. **Both publishing and saving an edit end on the list**, not on the listing: what a landlord does next is copy its link, publish another, or look at what they already have, and all three are there. |
| `/inmuebles/<slug>` | `propertyDetailRoute(slug)` | Public detail of one property. No session needed. **The map lives here**: a circle over the zone, never a pin — see "The map" below. |
| `/inmuebles` | `PROPERTIES_ROUTE` | Public catalog with facets. `?city`, `?type`, `?bedrooms`, `?lease`, `?features`, `?sort`, `?page`; anything the options do not recognise is ignored rather than queried. |

- `POST /api/session` exchanges the idToken for an httpOnly session cookie (and requires a
  recent sign-in); **`PATCH` re-mints it** with the current claims after a role change;
  `DELETE` signs out and revokes the refresh tokens.
- `requireUser()` redirects to `LOGIN_ROUTE`; `requireRole()` to `HOME_ROUTE`.
- **There are two sessions, not one**, and this is the trap behind "tu sesión expiró" appearing
  to someone perfectly signed in. The httpOnly cookie (7 days, `SESSION_MAX_AGE_MS`) is what the
  server reads; the **web SDK keeps its own** in IndexedDB, and that is the one Cloud Storage and
  the Security Rules check when the browser uploads a photo straight to the bucket. They have
  different storage and different failure modes — cleared site data, a private window, storage
  the browser reclaimed — and `auth.currentUser` is also `null` for the first moments after any
  page load, so reading it directly answers "signed out" to anyone quick enough to click.
  **Never read `auth.currentUser` to decide whether someone is signed in**: call
  `ensureClientSession()` (`shared/auth/client.ts`), which waits for the first definite answer
  and, if it is nobody, rebuilds the client session from the cookie through
  `POST /api/session/token`. That endpoint mints a custom token for the uid its own cookie
  names, so it grants nothing the cookie holder did not already have.
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

**On a wide screen the catalog is a fixed frame and only the list scrolls.** From `lg` the public
chrome is `fixed inset-0` and `main` owns the overflow; the results column keeps its own
`overflow-y-auto` so the heading, the facets and the pager stay put — a filter you cannot see is
a filter you forget you applied. `h-svh` alone was not enough: the document still scrolled the
header out of view by its own height. Below `lg` the page scrolls as a page, because an inner
scroller on a phone fights the address bar and pull-to-refresh, and there the facets are behind a
button anyway. `CATALOG_PAGE_SIZE` is **6**.

## SEO, and the half of the product that deliberately has none

**Two halves, opposite answers.** The catalog and a property's detail exist to be found and shared;
the management portal is the private workspace of two named people and carries no SEO at all. Every
decision below follows from that split.

**The words a listing is described with are the domain's, not the page's**
(`features/property/domain/seo.ts`, pure and unit-tested). The same sentence has to come out of
three places that never see each other — the `<title>`, the Open Graph card a paste produces, and
the JSON-LD — and three copies is three chances to describe it differently, with the one people
notice being the WhatsApp preview.

- **The landlord's own headline is not used.** They write "HERMOSO APTO REMODELADO 😍", which is
  neither specific nor comparable with the other five links in a group chat. `propertyMetaTitle`
  produces the fact sheet — *Apartamento en arriendo en Palermo, Manizales · $ 1.400.000* — and the
  page's `<h1>` stays theirs. Same for the description: what a preview needs is the fact sheet in an
  identical shape across every listing, not the first 160 characters of a greeting.
- **The price is the total**, `rent + adminFee`. Publishing the rent alone is the surprise at the end.
- **Too long degrades in steps, it does not get chopped.** The price goes first, then the
  neighbourhood; **the city never goes**, because "dónde" is the question before "cuánto". Clamping
  the whole string instead produced *"Apartamento en arriendo en Ciudadela del Norte La Enea…"*, a
  title that no longer says which city — caught by its own test rather than in production.

**Neither the street nor any coordinate goes into structured data, and there is no `geo` block at
all.** This is the same rule as the map, one layer earlier and in the place nobody reviews: a
`<script>` is not read when looking at a page. Even the blunted `area.approx` stays out — publishing
it would invite a search engine to draw the pin this product deliberately does not draw.
`seo.test.ts` asserts the absence over the serialised tree and `tests/e2e/seo.mjs` asserts it again
over the HTML a stranger receives.

**What is on each public page:**

| | |
| --- | --- |
| Detail | `RealEstateListing` whose `about` is an `Accommodation` (an `Offer` hung off the listing says *the web page* costs $1.400.000), `businessFunction: LeaseOut` and `unitCode: MON` so the canon does not read as a sale price, plus a `BreadcrumbList` mirroring the two links the page actually offers. No `aggregateRating`, no `priceValidUntil`: marking up things that do not exist is the one structured-data mistake that earns a manual action. |
| Catalog | `CollectionPage` + `ItemList` of **the items on the page being rendered**, with positions counted from where the page starts — an `ItemList` claiming 1..6 on page four tells a search engine that four URLs are the same six results. |

**Only the city is canonical, and there is deliberately no `noindex` on the other facets.** A
`noindex` beside a canonical pointing elsewhere is two contradictory instructions, and Google's
documented answer to the pair is to trust neither. The canonical alone is the whole instruction;
discovery of what is behind page four is the sitemap's job.

**`app/robots.ts` and `app/sitemap.ts`.** The sitemap is `force-dynamic` on purpose: prerendered it
would freeze the catalogue as it looked on deploy day, and freeze it *empty* — on Vercel the service
account never reaches the build step, so a build-time read has no credentials. It never throws, like
`listNotifications`, and `lastModified` is each listing's own `updatedAt` rather than "now", because
a sitemap where everything changed today is a sitemap whose dates get ignored.

**The portal is `noindex, nofollow` from one line in `app/(app)/layout.tsx`**, and `(auth)` has the
same — with `/` overriding it back to `index: true`, because a route group does not change the URL
and that file is also the site root. Two pages used to carry `robots: { index: false }` of their own:
metadata merges **per field**, so their object replaced the layout's whole one and silently dropped
the `nofollow`. The `Disallow` list in `robots.txt` is about crawl budget rather than secrecy —
every one of those pages redirects to the login without a session — and the two controls fail in
different directions, which is why both are there.

**The shared card is generated, not the first photo.** `app/(public)/inmuebles/[slug]/opengraph-image.tsx`
draws a fixed 1200×630: the photo on the left, and on a brand panel the price, the neighbourhood and
the rooms. A raw photo is cropped to 1.91:1 by every client, so a portrait shot of a kitchen
previewed as a cupboard — and the two things anybody decides on were not on the card at all. Four
things about it:

- **No photo is a different composition, not the same one with a hole**: the fact sheet across the
  full width, set larger. Half a card of flat purple reads as an image that failed to load.
- **The photo is fetched here and embedded**, with a timeout and a size cap, so a failure is a value
  this code can see. Handed to satori as a remote `<img src>`, a 404 throws from inside the layout
  pass and takes the whole card with it — turning a missing picture into a missing preview.
- **A slug that no longer resolves still gets a card** ("este anuncio ya no está disponible"), never
  a 500 that leaves the link previewing as broken.
- **`revalidate = 3600`.** The route is cached per slug after the first request, and the price is the
  largest thing on it. Revalidating on the write would be exact and is not available: the path
  carries a build hash `updateProperty` cannot construct.

`shared/brand/og.ts` holds the three brand hex values, and it is the one place in this product where
a literal colour is correct: satori lays out inline styles into a PNG with no stylesheet and no
`var(--primary)` to resolve. If a token in `globals.css` changes, that file changes with it.

**`metadataOrigin()` (`shared/lib/site-url.ts`) is not `resolveSiteUrl()`.** A link in an email must
point where the person actually is, so it reads the request; a canonical tag must name the *one*
address a page is published at, and "wherever this request came from" is exactly what a canonical
exists to stop — a preview deployment declaring itself the canonical home of every listing is how a
catalogue gets deindexed. It uses `||` and not `??`: an env var that exists and is empty is a string,
and `new URL("")` throws from inside the root layout, which is every page.

**Inside the catalog, the logo is the way back to the catalog.** Everything in the `(public)` route
group *is* the catalog — the list and one property's detail — so `app/(public)/layout.tsx` renders
`PublicChrome` with `homeHref={PROPERTIES_ROUTE}`; `/soporte` renders the same header from outside
that group and keeps the default, `/`, because from there "el inicio" really is the way in. A prop
and not `usePathname()`: the answer is a fact about the route, known at build time, and reading it at
runtime would make a Client Component out of the whole header. Sending somebody browsing listings to
`/` dropped them on a login screen — a dead end for a visitor, and a way out of what they were
looking at for anyone already signed in.

**And the detail page carries a "Volver a los inmuebles" arrow**, top left, the same shape the
process page uses. A real link and not `history.back()`: this page is also reached from a URL pasted
into WhatsApp, where there is nothing to go back to. What it does not carry across is the filters — the
catalog keeps its whole state in the URL and this link does not — so the browser's own back gesture
is still the one that returns the search exactly as it was.

**One `outline` button per card, not one `accent`.** A page of the catalog is six cards, and six cyan
buttons are six calls to action competing with each other, which is none. What should draw the eye in
a card is the price; "Ver inmueble" is the shortcut, and the card's own title already leads to the
same page.

**The catalog filters, counts, sorts and paginates in memory**, over one query capped by
`CATALOG_MAX_SCAN`. That is deliberate: faceted search needs a count per option computed against
the *other* filters, and Firestore cannot answer that without one composite index per
combination of facets — an unbounded set. It stops being the right shape somewhere in the low
thousands; what it wants then is a search index or a maintained counter per facet, not a bigger
cap. `features/property/domain/catalog.ts` holds all of it, pure and unit-tested.

Two rules that are easy to break there. A facet is **never counted against itself**: with
"Apartamento" selected, the number beside "Casa" is what you would get by switching, or every
unselected option reads zero and the filter looks broken. And an option that is **selected is
never hidden**, even at zero — two filters can contradict each other, and hiding the checkbox
would leave a filter applied with no way to switch it off.

The URL is the catalog's only state, so `parseCatalogFilters` and `catalogQuery` are inverses of
each other and a shared link always reproduces what was on screen. Only the city is canonical
for search engines: the facets and the page number are ways of looking at the same catalog.
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

## Button emphasis: one cyan per view

The stage panels drifted twice and both drifts made the same page unreadable, in opposite
directions.

**First, the size.** `size="lg"` is `h-9 px-2.5` — in this design system that is a *small* button.
The brand CTA is `size="xl"` (`h-11 px-4 rounded-xl`), which is what `SubmitButton`, the property
CTA and the advance button use, and it is what matches an `h-11` input. Twenty-seven buttons across
the six stage panels were on `lg`, so every action *inside* a stage was smaller than the button that
leaves it. They are all `xl` now.

**Then, the colour.** With only `outline` available for anything secondary — a border the same grey
as every card edge — real actions were being promoted to `accent`, and the guarantee panel ended up
with three cyan buttons. Three CTAs is none.

So there are three levels, and the rule is **one `accent` per view**:

| Variant | For |
| --- | --- |
| `accent` | the one action of that view. Cyan. If two are on screen at once, one of them is wrong. |
| `brand` | a real control that is not that one. Brand purple on the border and the label. |
| `outline` / `ghost` | furniture: cancel, dismiss, a row-level copy button. |

`brand` uses **`--brand-panel`, never `--primary`**: in dark mode `--primary` *is* the cyan, so a
`border-primary` secondary button would end up competing with the very CTA it defers to. The same
trap applies to `status-current`, which is cyan too — the guarantee panel's "elige el plan Plus"
note used it and formed a cyan block with the button beneath it, besides claiming to be a process
state when it is an instruction.

**And prefer removing a button to recolouring it.** The guarantee panel had five; it has three.
Two of them were a submit for a single field, so the field saves itself: `saveGuaranteeProgress`
runs 800 ms after typing stops, which also cannot leave a link filled-but-unsaved at the moment the
landlord switches to Sura's tab. A field that saves itself needs to *say* so — there is no button
to go quiet — and it must **notify on transitions, not on saves**: an auto-saving note would
otherwise ring the tenant's bell on every keystroke, so the two once-only events are "the policy
became requested" and "a link appeared".

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
| `shared/form/text-field.tsx` | `TextField`: label + input + error + `aria-invalid`/`aria-describedby`. Takes `{...register("field")}` directly. `hint` is permanent text below the field; `hintTooltip` is the same sentence behind an icon beside the label — for what a field *is* rather than what it needs. |
| `shared/form/field-hint.tsx` | `FieldHint`: that icon. Opens on hover, on focus **and on click** (Radix tooltips do not open on touch), closes on a tap outside, and renders the sentence `sr-only` as well so the field stays described for a screen reader. |
| `shared/shell/account-menu.tsx` | `AccountMenu`: on the public header, who you are signed in as. It shows the initial of the **email** (the session cookie carries it; reading the profile would add a Firestore round trip to the catalog) and holds "Mi portal", "Mi perfil" and "Cerrar sesión". Without a session the header offers "Iniciar sesión" instead — showing that to somebody already signed in read as a session that had expired. |
| `shared/form/form-alert.tsx` | `FormAlert`: form-level error with `role="alert"`. |
| `features/auth/ui/google-button.tsx` | `GoogleButton`: Google sign-in, with spinner. |
| `features/auth/ui/or-divider.tsx` | `OrDivider`: the "or" divider. |
| `shared/form/submit-button.tsx` | `SubmitButton`: cyan CTA with spinner and progress label. |
| `features/auth/ui/password-requirements.tsx` | `PasswordRequirements`: checklist derived from `PASSWORD_REQUIREMENTS`. |
| `shared/shell/auth-shell.tsx` | `AuthShell`: two-column layout for login and signup. |
| `shared/brand/logo.tsx` | `Logo`: the only place with the PNG's dimensions. |
| `shared/form/select-field.tsx` | `SelectField`: select with label, error and ARIA. Controlled with `Controller`. |
| `shared/form/phone-field.tsx` | `PhoneField`: country selector + national number. Its ids are generated: two can share a page (yours and your reference's), and with fixed ids `label for=` resolves to the first, so typing in one filled the other. |
| `shared/shell/app-shell.tsx` | `AppShell`: the frame of every product screen — menu and content. A page brings only its heading and its body. |
| `shared/shell/app-nav.tsx` | `AppNav`: the `NAV` list itself, shared by the two surfaces that show it. **It is a Client Component**: it passes icon components to `NavItem`. |
| `shared/shell/app-sidebar.tsx` | `AppSidebar`: the menu always visible from `lg` up, narrow by default, widened with the arrow. The width also picks the mark: the full lockup when open, the icon alone when collapsed — **both on the light chip**, because half of either one is `#330852` against a `#2d124d` panel, which is contrast 1.05 and therefore not dim but absent. The chip goes away when a reversed logo exists, not before. |
| `shared/shell/sidebar-state.ts` | The cookie that remembers that width. Read on the server so the first paint is already right. |
| `shared/shell/app-drawer.tsx` | `AppDrawer`: below `lg`, the bar with the hamburger plus the same menu in a drawer. Owns the open state. |
| `shared/ui/nav-item.tsx` | `NavItem`: a menu entry. Without `href` it renders disabled with a "Pronto" badge. `activeOn` marks the section on routes that do not hang off its path; `shortLabel` is what the narrow rail shows instead of a name too long to sit under an icon. |
| `shared/ui/coming-soon-card.tsx` | `ComingSoonCard`: wraps mocked-up UI whose function does not exist yet. |

## The map, and the one rule that shapes it

A landlord can place the property on a map when they publish it, and the public detail page draws
it. **The exact point is stored where the street is stored, and only a blunted one is published** —
`features/property/domain/property.ts`.

That is the whole design, and it follows from one fact: a coordinate to five decimals *is* the
address. Paste it into any map and the street name comes back. So the split that already exists
between `properties/{id}` and `properties/{id}/private/location` had to hold for the coordinate too,
or the map would have undone it one field at a time.

| Where | What | Who reads it |
| --- | --- | --- |
| `properties/{id}/private/location.point` | the exact point, as placed | the owner, an admin |
| `properties/{id}.area.approx` | that point snapped to a **0.005° grid** — a cell of ~550 m | everybody |

`approximateLocation()` does the snapping and it **snaps, never jitters**. Random noise looks safer
and is worse: it changes on every render, so anyone who loads the page a few times averages it away
and recovers the real point. A deterministic snap gives up the same information every time, and that
is the guarantee — the reader learns the cell and nothing inside it.

The public map draws a **circle of `APPROX_RADIUS_M` = 400 m and never a pin**, and that number is
proven rather than chosen: the worst case is a point in the corner of its cell, half a diagonal from
the centre (~394 m), and `property.test.ts` asserts it across seven points from Leticia to San
Andrés. Weaken `LOCATION_GRID` and that test fails before a tenant is shown a circle their rental is
not in. The owner — and only the owner — also sees their own point inside the circle, for the same
reason the street is on that page for them alone.

Four more things worth keeping:

- **It is optional, and it stays optional.** Requiring it would lock every listing published before
  the map out of its own edit form (publishing and editing are the same form), and would shut out a
  landlord whose street OpenStreetMap has not drawn — which in rural Colombia is most of them. A
  listing with no point renders its location in words, exactly as before, and the map is added to
  that section rather than replacing it.
- **The picker is a crosshair over a map that moves, not a pin that drags.** A draggable marker
  cannot be operated with a keyboard at all, and this is the one screen where that would mean not
  being able to publish; a map pans with the arrow keys and zooms with `+`/`−` for free, so the
  accessible path *is* the control instead of an escape hatch beside it. It reports on `moveend`, so
  what is under the crosshair is what is stored — and **nothing is reported below zoom 14**
  (`MIN_PICK_ZOOM`), because a pan at country zoom is a department, not a location. Without that
  guard a landlord who idly dragged the map acquired a point a hundred kilometres from their house.
- **"Centrar en el barrio" asks a geocoder only what the listing already publishes** — barrio, city,
  department. Not the street: sending it to Nominatim to be logged would give away, through the back
  door, exactly what `private/location` exists to keep. It is Server-Action-gated (an unauthenticated
  keyless geocoder proxy is an open proxy, and the abuse arrives under this product's name) and
  answering nothing is the **expected** case, not an error — OSM's coverage of small Colombian towns
  is thin, and the point can always be placed by hand.
- **Tiles come from OpenStreetMap's own servers, which is a decision with an expiry date.**
  `shared/map/tiles.ts` is one constant and one attribution string for that reason: OSMF's policy is
  written for light use by small sites and a public catalogue that takes off is neither. When traffic
  arrives the change is a keyed provider in `TILE_URL`; what must not happen is that decision being
  made silently by growth. Driver runs never touch those servers — `stubTiles` in
  `tests/e2e/lib.mjs`, the same lesson as the empty `RESEND_API_KEY`.

Leaflet is **148 KB in its own chunk**, behind `next/dynamic` with no SSR (it reads `window` on
import) and referenced by no page entry in the build manifest: only the publish form and a property's
detail page ever download it. Both boundaries are a thin `"use client"` wrapper, because `ssr: false`
is not allowed inside a Server Component.

`tests/e2e/map.mjs` makes the assertion nothing else can: that the HTML a stranger receives contains
neither coordinate, anywhere — not in the map, not in a `data-` attribute, not in the RSC payload at
the end of the document. It was verified by leaking the point on purpose and watching it go red.

## Where someone lives
The **city depends on its department**, in the profile as in the property form: two selects, the
second offering the municipalities of the first (`shared/geo/municipalities.ts` — the 1.122 from
DANE, generated, so no small town is missing) and cleared when the department changes. The pair is
validated together (`superRefine` on the address), because free text let "Manizales, Antioquia"
through: a pair that does not exist.

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

## The rental process (`features/application`)

Seven stages, in `domain/application.ts`, and the landlord moves it **one stage at a time** —
nothing advances by itself, because each of these is a decision someone makes off the platform
and then records here. `submitted → tenant_data → background_check → interview → guarantee →
contract_signature → first_payment`.

**Except the end, which is the one deliberate exception**: confirming the first canon *is* the
decision, so it ends the process and opens the tenancy in the same movement. There is no eighth
stage to advance to.

**Two stages were removed, and both for the same reason: they recorded nothing.** `approved`
("Postulación aprobada") sat between the policy and the signature — but deciding to go to the
signature *is* approving, so it was one decision written down twice. The notification survived it:
`application_approved` is now sent on landing on `contract_signature`, because "tu postulación fue
aprobada" is the sentence the tenant was waiting for and "avanzaste a Firma del contrato" is not.
And `active` ("Arriendo en curso") was never a stage at all — it was the tenancy, listed among the
steps of the negotiation that produces it, and until somebody pressed a button to reach it the
tenant had paid, the landlord had confirmed, and the page with the months on it did not exist.

**What says the process finished is `completedAt`, a timestamp on the application** — like
`waivedAt`, `checksAuthorizedAt` and `acceptedClauseAt`, and for the same reason: *when* it ended is
part of the record both parties read, and a bare flag answers "no" identically whether it ended
yesterday or is still on stage three. `isCompleted()` is the one question, read from the one field;
it used to be `stage === "active"`, which meant every screen that needed to know had to know the
name of the last stage. The **status stays `open`**: an application whose tenancy is running has not
been rejected or withdrawn, and it is still the document both parties come back to for the contract
they signed. `stageState` and `stageProgressLabel` take the completion rather than deriving it from
the position — the last stage is the one that asks for the money, so "last" and "finished" stopped
being the same thing the day `active` went.

**`approved` and `active` are still written on documents in the database**, so `normalizeStage()`
maps them (to `contract_signature` and `first_payment`) and the converter in `data/application.ts`
marks a stored `active` as completed, dated from its own history entry. A stage the code no longer
knows lands as `stageIndex() === -1`, which reads as "before the first step" in every comparison —
no migration to run, and the old links and old notifications keep meaning what they meant.

There is no separate "revisión de documentos" stage: reviewing them **is** stage two, where each
one is approved or rejected. A stage repeating what the previous one settled is a stage everybody
clicks through without reading.

**`interview` is built, and it is the one stage that is mostly about agreeing on a time.** The
landlord proposes a day, an hour and a channel - Google Meet, WhatsApp or a plain phone call, 30
minutes - and the tenant **confirms**, which is what turns a proposal into an appointment: a time
only one side knows is a time nobody shows up to, so the process does not move on without it. The
tenant can also say the slot does not work, with a note; proposing again **replaces** the whole
arrangement, because a confirmation belongs to the time it was given for. The **Meet link only
appears once confirmed** - before that there is nothing to walk into, and offering it invites
somebody to try on the wrong day. Afterwards the landlord writes down how it went (`went_well` /
`with_reservations` plus a sentence), and **that is what unblocks the next stage**; like a records
search, a reservation never blocks - what blocks is not having held the interview. The note is
read by both, and the form says so, because a conclusion the other party cannot see is a decision
made behind their back. The call happens off the platform: this product hosts no video, and the
part that gets lost in a chat thread is the agreement about *when*, which is what it keeps.

**Two reminders go out for a confirmed interview**: one **a day before** and one **ten minutes
before**, to both parties, over the three channels at once - the bell, an email and a **WhatsApp**.
Ten minutes before a call is exactly the moment when "they will see it when they open the app" is
not good enough.

Nobody clicks a reminder into existence, so a **Vercel Cron** wakes the server: `vercel.json`
calls `GET /api/cron/interview-reminders` every five minutes, which is also the accuracy of the
ten-minute one - it leaves on the first tick inside the window. The route **refuses to run without
`CRON_SECRET`** and answers 401 to a wrong one: a job that messages every tenant with an interview
is not something to leave open on a guessable path.

**This cron is why the project is on Vercel Pro.** Hobby's minimum interval is *once a day*, and an
expression that would run more often does not degrade quietly - it **fails the deployment**, so the
whole product stops shipping over a five-minute schedule. Hobby is also ±59 min imprecise, which
would make even the day-before reminder approximate and the ten-minute one impossible. And the
plan was coming anyway: Hobby's fair-use terms restrict it to *"non-commercial, personal use
only"*, and this is a product with contracts and rent in it. The cron was simply the first thing
to hit the wall.

Two things must be true in Vercel or the sweep is a 503 every five minutes. `CRON_SECRET` has to
exist **in Production** - it lived only in `.env.local` for a while, so the route would have
refused every tick that reached it. It is stored **Sensitive**, which is unreadable after creation
and redacted from build logs; that is not the same restriction as the one behind
`public-config.ts`, whose problem is that `NEXT_PUBLIC_*` is inlined at **build** time and a
sensitive value is not there to inline. A Route Handler reads `process.env` at request time, and
that is **verified**: with the secret stored Sensitive, `GET /api/cron/interview-reminders` on
production answers **401** to a wrong bearer, not 503. The way to check it again after any change
to that variable is exactly that call - 401 means it arrived, 503 means it did not.

`dueReminder()` holds the rules and is unit-tested: only a **confirmed** interview is reminded (a
proposal nobody accepted is not an appointment); nothing is sent once the call has started; and
when both windows are open at once - an interview confirmed nine minutes before it begins - only
the closest one is sent and the stale one is **written off**, because "manana tienes la entrevista"
arriving ten minutes before it starts is worse than silence. What was sent is written on the
interview *before* anything leaves: the sweep wakes up every five minutes, and the other order
would cost the same reminder every five minutes until the call.

**WhatsApp needs three things this repository cannot hold**: a WhatsApp Business phone number
(`WHATSAPP_PHONE_NUMBER_ID`), its token (`WHATSAPP_TOKEN`) and a **template approved by Meta**
(`WHATSAPP_TEMPLATE`, defaulting to `interview_reminder`). Business-initiated messages outside the
24-hour window a person's own message opens cannot be free text, so the words live in the WhatsApp
Business account and this project passes two parameters: the property and when the call is. Without
credentials the message is logged and the other two channels still go out - the same contract as
Resend without a key.

**A phone on `notify()` is what says "this one also goes over WhatsApp".** Every other movement of
a process is news, and news belongs in the bell and the inbox: a phone that buzzes for each of seven
stages is a phone somebody mutes, and then the reminder arrives muted too.

Times are stored as instants and shown in Colombian time. The form's two fields are read as
Bogota wall time with a fixed `-05:00` - Colombia has no daylight saving, so that offset is exact
all year - and `interviewWhen()` is the single formatter the panel, the bell and the email share:
for the one fact this stage exists to carry, three copies that could drift is the worst possible
bug.

**`tenant_data` is built.** The tenant uploads the documents their occupation calls for and both
sides see them previewed; the landlord approves or rejects each one, with a reason on a
rejection. `background_check` cannot query anything — SIMIT, the RUNT and the Policía have no open API — so
it does the honest half: it lists the four sources a Colombian landlord checks, links straight to
each, and **keeps what was found**. The landlord marks every one "sin hallazgos" or "con
hallazgos" with a note, and the tenant reads the same list, which is the point of writing it down.

**The portal links are the landlord's**, and only theirs. The tenant sees each source, what it
covers and its result; handing them a shortcut to look up their own record turns a page about
their application into an invitation to go and check themselves, and it is the landlord who holds
the authorisation to run the search. The addresses are the ones the entities serve the query
from, not the page a search engine offers — the Policía's is `srvcnpc`, and SIMIT needs
`#/estado-cuenta` or it opens on its home screen.

Two rules there. Nothing may be recorded without the tenant's **express authorisation** (Ley
1581, dated, given per application) — enforced in the action, not only in the interface. And **a
finding never blocks the process**: somebody with an unpaid speeding ticket is not somebody who
will not pay rent, and that decision is the landlord's. What blocks is not having looked. A
finding *is* notified, with its note; a clean result is not — four "no encontré nada" would make
the bell useless on the day it matters.

**The advance button is in two places, and it is one control.** `AdvanceButton` renders at the top,
beside "Rechazar postulación", and again at the **foot of the stage being worked on** — the question
"am I done with this step?" is answered at the end of the step, and scrolling back up past seven cards
to press a button about what you just finished is a scroll that means nothing. Two rules keep the
pair honest. The one at the top is **always** there and, when the stage is blocked, stays visible
with the reason: that is where somebody goes to find out what is missing. The one at the foot renders
**only when the step is done** — a card that ended in a disabled button would end in a "no" whose
reason is already written above it — and the page decides that from the *same* `blockedBecause` it
hands the top one, computed once, because two buttons that disagreed about whether the step is
finished is exactly the incoherence a second button invites. This is also the one place where two
`accent` buttons are legitimately on screen at once: they are not two calls to action competing for a
decision, they are the same one within reach twice.

Its stable handle is `data-slot="stage-actions"` on the top row, and a stage's card is
`#etapa-<stage>`. A driver that matches `Continuar a` without scoping to one of them now finds two
buttons and fails on ambiguity — which is how four drivers broke at once the day the second one
landed. `advanceButton(page)` in `tests/e2e/lib.mjs` is the top one; `.first()` is a guess about
document order, not a statement about which button you mean.

**A finished stage keeps its panel**, folded shut and without its buttons. Looking up what was
uploaded three stages ago is a normal thing to want, and a process that hides what was agreed the
moment it moves on is a record nobody can audit. The buttons go because a control that no longer
changes anything is the same lie as a "Continuar" that does not continue — `readOnly` on each
panel, decided by the page, which is the only place that knows which stage the process is on.

**Every panel starts folded, and a change of stage folds them all.** The header carries the
state — "5 de 5 subidos", "2 de 4 consultadas" — so what a click reveals is the controls, not the
news; seven stages each unfolding on their own would be a page nobody can see the shape of.
`resetOn` carries the current stage, so moving forward leaves the timeline collapsed instead of
growing a section at a time.

**A stage's work lives inside the stage.** `StageTimeline` takes a `work` map and folds each
entry into its own card as a `StagePanel` — a chevron that rotates, open by default because the
panel only renders on the stage being worked on and hiding the one thing there is to do behind a
click is a click for nothing. It is passed in rather than imported: the documents belong to the
tenant profile module and the timeline should not have to know that. Before this the panel sat in
a section of its own above the timeline, which is why it needed a link pointing at it — and why
the page rendered its heading twice, once from each side.

**The advance button is gated at `tenant_data`.** `documentsBlocker()` answers *why* in one of
three ways — something missing, something rejected, something unreviewed — and the button says
it: `aria-disabled` (so the tooltip stays reachable, unlike `disabled`, which drops out of the
tab order and stops firing hover), the sentence in the page, and a **"Ver qué falta"** button
that scrolls to the stage's card and outlines it for three seconds. The blocked button itself does
nothing on click: a control announced as unavailable that turns out to act is its own kind of
lie, and Playwright refuses to click it for the same reason a screen reader would not offer it.

Two details worth keeping: the identity document is accepted **either as one file with both
faces or as two photos** — a scanner gives you the first, a phone the second, and demanding the
second from someone holding the first is asking them to split a PDF. And the landlord's verdicts
live **on the application**, never on the document: a payslip approved by one landlord is not
approved for the next, and a verdict written onto the tenant's profile would follow them
everywhere.

**`guarantee` is built, and in this first phase it is one product**: Sura's *seguro de
arrendamiento digital*, taken out online at `ecomm.sura.co/seguros/hogar/arriendo/cotizador`, which
**needs no co-signer** - producing a relative who owns property is the requirement that stops most
applications in Colombia, and this whole product exists so the process does not stop. The stage is
called "Poliza de arrendamiento" in the timeline for the same reason.

The policy is bought on Sura's site: this product does not sell insurance, is not a broker and
takes nothing for pointing at it. What the panel does is the part that *is* its job - say what the
policy answers for (rent on default, administration fees, home assistance), state the ceiling (12
months, and only while the policy is current and paid), hand the landlord the two things Sura's
form asks for **with a copy button** - the tenant's email and the registry number, both already on
that screen - and keep the record of what was taken out.

Two rules. The **registry number never reaches the tenant's side** of this panel, for the reason
it lives outside the public document: with it anyone pulls the certificate and reads the address
off it. And **"ya la solicité" does not unblock the stage** - only a policy number does. A
requested policy is a wait, and signing a contract on a study the insurer may still refuse leaves
the landlord with nothing behind it. `requested` exists as its own state anyway, because Sura's
study takes days and both sides need somewhere to look during them.

**But the policy itself is optional, and the stage used to be written as if it were not.** Nothing
in Colombian law requires rental insurance, so a landlord renting to a relative — or to a tenant of
six years — had no way past this stage but to buy something they did not want. There is a **switch**
at the top of the panel, landlord-only: *"Este arriendo lleva póliza de arrendamiento"*. Off, the
state is `waived` and `guaranteeBlocker` answers `null`, so the process advances with no policy at
all. Five things about it:

- **The consequence is stated beside the switch, not in a tooltip.** Ley 820 forbids a cash deposit,
  so with the policy declined there is *nothing* behind the lease — the policy is not one guarantee
  among several. `GUARANTEE_WAIVED_NOTE` says it, in brand purple rather than red: this product says
  "this matters" without saying "this is wrong", because the decision is legitimately theirs.
- **`waivedAt` is a timestamp, not a `required: boolean`** — like `requestedAt`, `activeAt`,
  `checksAuthorizedAt` and `acceptedClauseAt`. *When* it was decided is part of the record both
  parties read, and a bare boolean answers "no" identically whether it was decided today or never
  asked at all.
- **An issued policy outranks a waiver**, and the order of the four checks in `guaranteeState` is the
  whole rule: swapping the first two makes a lease with a policy read as having none. A waiver *does*
  outrank a mere request, because applying and then thinking better of it is ordinary. And
  `canWaiveGuarantee` removes the switch once a policy exists — offering it then would be offering to
  un-buy a policy the tenant has already been told about.
- **The three older write paths disagree about the waiver on purpose.**
  `recordGuaranteeRequested` and `recordGuaranteePolicy` clear it (asking for a policy *is* wanting
  one); `saveGuaranteeProgress` **preserves** it, because that one is an autosave — a landlord who
  declined the policy and then fixes a word in the note is not asking for it, and clearing it there
  would flip the switch back while they typed, with nothing on screen to explain it.
- **Only waiving notifies** (`guarantee_waived`). Turning the requirement back on asks the tenant for
  nothing; applying for the policy is what notifies, as it already did. A switch that rang the bell in
  both directions would ring it twice for a landlord making up their mind, and the second message
  would contradict the first. `waivedAt` is preserved when already set, so re-pressing the same side
  does not re-notify — the same "notify on transitions, not on saves" rule this stage already follows.

With no policy the panel **stops rendering the Sura apparatus** — coverages, quoter sheet, link field
and policy number are all controls that no longer do anything. The record of the decision is what
stays, and it renders for whoever does *not* have the switch (the tenant, and the landlord once the
stage is past): with the switch in front of you it repeated its own warning word for word, two
paragraphs saying the same thing.

The tenant reads the same coverages and the same state, and is told that Sura may write to them to
complete the study: it is their default the policy insures and their inbox it reaches, so learning
about it from a phone call would mean finding out last about something that is about them. When the
landlord has declined it they are told the opposite, plainly — nobody will study their profile and
Sura will not write — because that is exactly the expectation the other notification set.

**`shared/ui/switch.tsx` is hand-written over the Radix primitive**, like `tabs.tsx`, so
`shadcn add` cannot rewrite `button.tsx` on the way past. Its checked colour is `--brand-panel` and
never `--primary`: in dark mode `--primary` *is* the cyan.

**`tests/e2e/guarantee.mjs` was red for a long time and nobody knew what it was hiding.** It
self-initialised the Admin SDK with the *real* service account read from `.env.local`, at an absolute
path, so against the emulators it died before its first assertion — which means the whole guarantee
stage had gone unverified in a browser for as long as that was true. Swapping it to `adminDb()` /
`adminFieldValue()` from `lib.mjs` was the entire fix, and it is green at 29 assertions now. Two of
the other three drivers in that group (`interview`, `rentals-layout`, `reminders`) still have it.

**There is no deposit stage, and there must never be one.** Ley 820 de 2003 forbids cash
deposits on urban housing leases in Colombia. `guarantee` — a co-signer or an insurance policy —
is what stands in for it, and a test asserts the word never comes back.

**`contract_signature` is built, and the signature is ours.** Nobody creates an account anywhere
and nothing leaves the product: the landlord uploads the contract, and each party signs it here
with a **one-time code sent to the channel they already verified** — their account's email or their
profile's WhatsApp. There is no provider, and that is a deliberate reading of the law rather than a
shortcut: **Ley 820 de 2003, art. 3** says a residential lease *"puede ser verbal o escrito"*, so a
signature is not what makes it valid. It is evidence, and the bar is how well the evidence holds.

**Decreto 2364 de 2012** is what that bar is made of. It calls an electronic signature *confiable*
when the creation data belongs exclusively to the signer and any later alteration is detectable;
when the method is agreed between the parties there is a presumption in its favour, **but the party
that provides the method has to be able to prove it is sound — and that party is us**. So each
requirement has a place in the code, not a paragraph in a policy:

| Requirement | Where it lives |
| --- | --- |
| The parties agreed the method | `acceptedClauseAt` + `clauseVersion`, recorded when the code is *requested* — the agreement has to precede the mechanism, not accompany its result |
| Creation data exclusive to the signer | the code goes to the channel on their **profile**, never to an address typed at signing time, plus the session's own uid |
| Alteration detectable | `documentHash` — every signature binds to the SHA-256 of the exact file, so **replacing the contract voids the signatures by itself**, with no cleanup |
| We can prove it | `signedAt`, `ip`, `userAgent` and the masked channel, kept on the application and read by **both** parties |

What it is **not** is a *firma digital* with an ONAC-accredited certificate, which carries a
stronger statutory presumption. The difference is probative weight, not validity; revisit it for
high-value leases. The clause wording is the piece that deserves a lawyer's eye, because the
presumption rests on it.

**The challenge lives in its own collection, `signatureChallenges`, and no client can read it.**
Not on the application document, and this is the whole point: both parties may read that document,
and a SHA-256 of six digits falls to a million guesses — so the tenant could recover the landlord's
code and sign as them. The explicit closure at the end of `firestore.rules` denies every undeclared
path, and a rules test pins that so nobody declares it higher up by accident. The code itself is
salted and hashed; it is never stored or logged in the clear.

Five attempts, ten minutes, and a wrong code **costs an attempt** — a counter nothing decrements is
not a limit. A code issued for one file does not work after the file changes, and asking for a new
one replaces the challenge, which resets the counter with it.

**A channel that cannot deliver is not offered.** `availableSignatureChannels()` decides, and it
lives beside `deliver` so the screen and the sending cannot drift. Email always works — with no
`RESEND_API_KEY` the code goes to the server log, which is how the flow is exercised locally.
WhatsApp appears only once `WHATSAPP_OTP_TEMPLATE` names a template **approved by Meta in the
AUTHENTICATION category**: a business-initiated message outside the 24-hour window cannot be free
text, so without it the option answered "no pudimos enviar el código" — and a control that fails is
worse than one that is absent. With a single channel there is no radio group either: a question with
one answer is not a question.

**SMS was considered and rejected**, and not for effort: it needs a new provider with a per-message
cost, its deliverability in Colombia is worse than WhatsApp's, and an SMS one-time code is *weaker* —
SIM swap is the standard attack against exactly this. It would trade an administrative gate for a
frailer channel with an invoice.

**The signature is also drawn, and both parties have to draw it.** On top of the code, each party
draws with the mouse or a finger, and the stroke is stamped onto the page at the box the landlord
marked while looking at the rendered PDF. It is **required of both**, tenant included: what signs is
still the code, and the drawing is what makes the PDF they keep read as a signed contract instead of
a document they have to explain. `strokeRequired(contract, party)` is the rule — true exactly when
the stroke has somewhere to go, a PDF with a box marked for that party — and `confirmSignature`
enforces it, so a client that posts a code with no stroke is refused before the code is even
compared. **The pad is visible from the first step**, beside the clause and the "mándame el código"
button, and not inside the step that asks for the code: it lived there while it was optional, which
meant somebody opening the stage saw no canvas anywhere and the mandatory half of the errand was
hidden behind the next click — reported, exactly, as "no veo la opción para dibujar la firma". One
instance, not one per step: two canvases would share the same `stroke` and the second would come up
blank with the sign button already enabled. Four things make that work without breaking anything the
code established:

- **Coordinates are normalised 0..1**, never pixels. The landlord marks on a preview rendered at
  whatever width their screen gave it; the stamping happens server-side against the real page box.
  The spot's origin is the **top-left**, as the DOM sees it, and `pdf-lib` measures from the bottom
  — that conversion happens once, in `stamp.ts`.
- **The stamped PDF is derived and carries its own hash.** Stamping changes the bytes, so hashing it
  as "the signed document" would invalidate the very signatures it displays. The original's hash
  stays the anchor.
- **Marking the boxes is now a gate, and it used to be the opposite.** While the drawing was
  optional a contract with no spots was signable and the stroke simply had nowhere to go; with both
  parties required to draw, nobody signs until the landlord has marked where. `contractBlocker`
  answers `no_spots` until then and the panel does not offer the form — offering it would be
  offering a control that the server will refuse. The two signatures are checked *before* the boxes,
  which is what keeps a contract signed under the old rule signed.
- **A canvas cannot be operated with a keyboard, and the answer is a keyboard path, not an
  exemption.** This was the reason the drawing stayed optional for a long time, and it was a real
  reason: making it a gate with nothing else on offer shuts out anybody who cannot draw, on the one
  screen where that means they cannot rent. So the pad has **"Usar mi nombre como firma"**, which
  draws the signer's name — from their profile, never typed in, so the stroke and the name on record
  cannot disagree — into the same canvas and produces the same PNG through the same `onChange`. It
  is not a lesser path: same stamping, same audit trail. A driver presses it with `press("Enter")`
  precisely so nobody can quietly turn the requirement back into an exclusion.
- **A contract that is not a PDF is the one case where the stroke is not required**, because there
  is no page to stamp. No new upload can be an image, so this only ever applies to one stored
  before that rule.

Two costs worth knowing. `pdfjs-dist` is **420 KB in its own chunk**, behind `next/dynamic` with no
SSR, referenced by no `app/` entry — only the landlord, only on this stage, ever downloads it.
And every string that reaches a PDF page goes through `drawableText` first: `pdf.save()` throws on a
character WinAnsi cannot encode — an emoji in a property title is enough — and it throws from the
line that writes the file, not from the one with the bad character.

**`first_payment` is built, and this product does not move the money.** The landlord writes where to
receive the canon — **Nequi, Daviplata, a Bre-B key, Bancolombia, Davivienda or another bank** — the
tenant transfers from their own bank and uploads the proof, and the landlord confirms it arrived.
Handling the money would make this a payment institution, with the licence and the custody that
implies, and none of it would make the rent arrive any better than the transfer they already know
how to make. What the stage keeps is what gets lost in a chat thread: where to pay, and the proof.

Four rules there, each of which cost a decision:

- **The account details never leave in a notification.** An email carrying somebody's account number
  is the shape of every payment scam there is, and ours would arrive from a domain the tenant
  trusts. The bell says there is a way to pay now; the *where* is read on the page, behind the
  session. `payoutSummary` says so in its own doc, because it is the function somebody would reach
  for when writing that email.
- **The holder is its own field**, never read from the profile: the account may be a spouse's, an
  agency's or a company's, and a tenant who transfers to a name that does not match the screen is a
  tenant who thinks they have been scammed. The panel tells them to check it.
- **Their identity document is asked only for a bank transfer**, and this is the one asymmetry in
  `payoutShape`. Nequi and Daviplata are paid to a phone number and their app shows the recipient's
  name before the transfer is confirmed; a Bre-B key resolves through the directory the banks share.
  Nobody types the recipient's document in any of the three, so asking for it collected an identity
  number nothing on the other side would ever use — and the cheapest way not to leak a piece of
  personal data is not to hold it. Registering an account in a Colombian bank does ask for it, so
  there it stays. `holderDocument` is the field, empty for the three; the *name* stays required
  everywhere, because that is what the tenant checks before pressing send.
- **The amount the tenant declares is typed with thousands separators**, through the same
  `AmountField` the listing's rent uses: `1800000` and `18000000` are told apart by counting zeros,
  and a zero too many here declares ten times the canon in the very field the landlord compares
  against their bank. What leaves the component is raw digits — the separators are presentation, and
  `Number("1.800.000")` is `NaN`. The monthly canon in `/arriendos` uses it too.
- **A Bre-B key is validated loosely, on purpose.** It has five shapes — an `@alias`, a phone, an
  email, a document number, a merchant code — and the only real check is against the directory the
  banks share, which this product does not query. Rejecting a key that works is worse than accepting
  one that does not: the second fails in their own bank, where it is visible. Same reasoning as the
  registry number on a listing.
- **A verdict belongs to the receipt it judged.** The same idea as a signature bound to a document
  hash: a rejection older than the receipt on screen stops counting by itself, so uploading a
  corrected receipt does not leave "rechazado" standing with nothing to fix. `verdictApplies` is one
  comparison and it is unit-tested by weakening it.

**Confirming *is* what closes the process**, and this is the one place where something moves without
the landlord moving it — because it is the same decision, not an extra one. It used to unblock a
"Continuar a Arriendo en curso" that the landlord then pressed, a step that recorded nothing the
confirmation had not, and until it was pressed the tenant had paid, the landlord had confirmed and
the page with the months on it did not exist. `recordReceiptVerdict` now writes the verdict, stamps
`completedAt`, opens the tenancy with `startLease` and rings the bell once, in that order: the
tenancy is idempotent through its own id and never throws, so a tenancy that failed to open is a
screen the next attempt fixes, while a rolled-back confirmation is not. After that the stage takes
no more writes — `partyOn` refuses a second receipt on a finished process, because the next month is
already waiting on the other page.

**The record is read from the document; only the link comes from the signed URL.** The same rule
`features/lease` and the contract panel already pay for, and this panel was breaking it: the file
name, the amount, the verdict *and the landlord's confirm buttons* all hung off the object carrying
the signed URL. That is now load-bearing rather than cosmetic — confirming is what ends the process
— so an environment that cannot sign (a deleted file, Cloud Storage down, no service account) used
to leave both parties on a screen with the money paid and no way to finish it.

The amount shown is `monthlyCost`, **labelled as the one from the application**. The contract governs
the canon and this product does not read it, so presenting a figure as authoritative would be
inventing one; the tenant states what they actually transferred and the landlord confirms.

**A signed contract stops offering what no longer does anything.** "Dónde firma cada parte" and the
note field both disappear once both signatures are in: the stamped PDF is generated exactly once, as
the second signature lands, so moving a box afterwards would save coordinates no document ever reads
again, and the note travels inside the upload's `FormData`, so with nothing left to upload it is a
field you can type into that nothing saves. Both are the "Continuar" that does not continue, in
miniature. What was written stays readable — the note beside the file, where each party signed drawn
into the contract itself — because hiding a control is not the same as hiding a record.

**The record is read from the document; only the link comes from the signed URL.** The same rule
`features/lease` already paid for, and this panel was breaking it: everything — the file name, the
signature log, "cambiar"/"quitar", the whole signing form — hung off the object carrying the signed
URL, so a signature that could not be produced (a deleted file, Cloud Storage down, an environment
with no service account) left the screen saying "sube el contrato" with the contract already
uploaded and one party already signed. What is lost when a URL cannot be signed is being able to
*open* the file, and nothing else. Same for the stamped PDF. This is also what makes the stage
drivable at all in the emulated suite, which has no service account and therefore no signed URLs:
before it, `tests/e2e/contract.mjs` died seven assertions in, so everything about the signature
itself was unverified in a browser.

**A finished process reads as finished, and the last stage is not finished by being last.**
`stageState` used to give whichever stage came last no `current` state at all, on the grounds that
reaching it *was* finishing — true while the last stage was `active`, which asked for nothing.
`first_payment` asks for the money, so the same rule would mark a process as over the moment it
arrived at the step with all of its work still ahead. Both now take `completedAt`: the last stage is
"En curso" until the canon is confirmed and "Listo" the instant it is. The badge over the timeline
says the same thing — `stageProgressLabel` answers **"Proceso completado"** instead of "Paso 7 de 7",
which is true right up until it is misleading. The card on `/inicio` reads it too, where it becomes
"Arriendo en curso · Proceso completado": that is what somebody needs at a glance, that this one is
not asking them for anything. `processStageLabel` and `processDescription` are the single place that
decides it, so the home card and the list cannot end up saying different things. That last card is
also where the **link to the tenancy** lives — the same footer slot that carries "Continuar a …" on
every other stage, because both answer "what takes me out of here", and once the process is done the
answer is another page.

`UNBUILT_STAGES` is now **empty**, and the constant is kept rather than deleted: `isUnbuilt` is what
says out loud that something happens off the platform, and the next stage added will need it.

- **Both sides read the same screen**, so the stage copy exists twice: `STAGE_DESCRIPTIONS` for
  the tenant, `STAGE_DESCRIPTIONS_LANDLORD` for the landlord. The sentence that tells the tenant
  to wait for a call is the sentence that tells the landlord to make it.
- **A rejection is final; a withdrawal is not.** Once a landlord says no, the listing stops
  offering the form — the first version offered it and refused on submit, which read like a
  broken button. Someone who withdrew *can* apply again: they stopped it themselves, and locking
  them out for changing their mind would punish them for using the button we gave them.
- **Closing keeps the stage.** "Rechazada en la entrevista" and "rechazada al recibirla" are
  different things to have happened. The landlord may reject at any stage with an optional
  reason the tenant reads; the tenant may withdraw. Neither can do the other's action.
- **The client never writes an application.** The stage machine cannot be expressed in
  `firestore.rules`, so every mutation is a Server Action and the rules deny all writes.
- **What signup asked for is shown here.** Filling in a name at signup and never seeing it
  again reads as data that got lost — the data was being used all along (the greeting, the
  applicant's name, every email) and simply had no screen. `AccountFields` is the same block on
  both forms, so the two cannot drift; `updateProfile` never touches the email (it comes from
  the verified session), the role (a custom claim) or `termsAcceptedAt` (which would become a
  lie if it moved every time a name is corrected).
- **The dossier is stored twice on purpose**: in `tenantProfiles/{uid}`, so the next application
  starts filled in, and as a **snapshot inside the application**, so the landlord sees what was
  declared to them and a later edit cannot rewrite it. `tenantProfiles` is readable by its owner
  alone — not by a landlord with an open application — and is never listable.

## The tenancy (`features/lease`)

`/contratos` is the negotiation that **ends** in a signed contract. This is the year that follows
it, and the question it answers is not "¿vamos a hacer esto?" but "¿está pagado este mes?". It is a
separate domain because it has a separate lifetime: seven stages happen once, twelve canons happen
twelve times.

`leases/{leaseId}` with **`leaseId == applicationId`** — one process produces one tenancy, so a
second identifier would be a second thing that can disagree with the first (the same reasoning as
`propertySlugs/{slug}`, whose document id *is* the slug). It could not live on the application
document either: `LiveApplication` subscribes to that one, so a canon paid in month seven would wake
both parties and re-render a seven-stage page that has not changed since March.

**The tenancy opens the moment the landlord confirms the first canon**, in `recordReceiptVerdict` —
the same write that stamps `completedAt`. It used to hang off a stage of its own, `active`, which the
landlord advanced to *after* confirming and which recorded nothing the confirmation had not.
`startLease()` never throws and is idempotent through `create()`: the confirmation is already
written, and a tenancy that failed to open is a screen the next attempt fixes, while a rolled-back
confirmation is not. It notifies `lease_started`, not `canon_confirmed`: the two are one fact now, and
the news that matters is that there is a page with the months on it — which is where that
notification lands, unlike the one it replaced. (`canon_confirmed` stays in the union, unsent: there
are notifications with that type stored, and a type the switch does not cover is a bell with an empty
body.)

**The first canon is the first month**, and now literally the same act: the confirmation that ends
the process is the write this runs after, so `startLease` carries the receipt *and* the verdict
verbatim onto `periods/{first}`.
Without that the tenant would open this screen and be asked to pay a month they had just paid, and
the only record of having paid it would be on the other page. The payout comes across for the same
reason: asking again on day one is asking for something the process already has.

**The calendar is derived, the months are documents.** `leaseSchedule()` computes every month from
`startDate` and `months`; `leases/{id}/periods/{YYYY-MM}` exists only once something happened in that
month. Writing twelve documents up front would need a second job to write the next twelve, and a gap
in that job is a month nobody can pay. **The period id IS the month**, which is what makes a monthly
charge idempotent rather than a thing to remember. `amount` and `dueDate` are stored on the document
anyway: a month that has been paid keeps the figure it was paid against.

**The aggregate is computed from the periods, never kept as counters.** Six to twelve documents are
one query, and a counter is a second source of truth — the day a verdict is corrected by hand, the
counter and the documents disagree and there is no way to tell which is lying.

**There is no `ended` state, and that is the honest answer rather than a missing feature.** *Ley 820
de 2003* renews a residential lease for an equal term unless a party gives notice in the form and
within the time the law sets out — so "the months are up" is not "it ended", and a product that
showed a tenancy as finished on its anniversary would be telling both parties something the law says
is false. `leaseTermState()` answers `upcoming` / `running` / `renewed`, and the schedule **grows by
a whole term** the day after one runs out, so the module keeps working past the end date instead of
silently stopping. Ending one on purpose is **not built**: the notice, its deadline, who may give it
and what it costs need a lawyer's reading before they are written in code, because getting it wrong
ends somebody's housing or somebody's income.

**This product does not move the money here either**, exactly as at the first canon: the landlord
says where, the tenant transfers from their own bank and uploads the proof, the landlord confirms it
arrived. Whether the money landed is something only the person whose account it is can say, and no
screenshot substitutes for it — a transfer can be reversed, mistyped or sent to the wrong key and
still photograph well. **The account details never leave in a notification**: an email carrying
somebody's account number is the shape of every payment scam there is, and ours would arrive from a
domain the tenant trusts. The bell says the account changed; the account is read on the page.

`Payout`, `PaymentReceipt`, `ReceiptVerdict`, `payoutShape`, `receiptFileProblem` and `payoutSchema`
are **reused from `@/features/application/client`, not copied**. They are literally the same thing,
and two copies of a ninety-line discriminated union are two things that can drift — the first to
drift would be the field the landlord confirms against. If a third domain needs them they belong in
`shared/`; with two, a cross-module import of a public entry is the boundary working as designed.

**The month that needs something comes out of the list and sits above it**, with the one cyan button
on the page. `focusMonth()` picks it, and it reads the same list from each side: for the tenant the
oldest **overdue** month wins (the debt to clear is the one that has been sitting longest), for the
landlord a receipt **waiting for an answer** does, because that is what they came here to do. The
rest of the months are the record: rows that fold open, with their controls in `brand`, because a
tenant three months behind still has to be able to pay the other two.

Two rules carried over from the first canon, because they were right there. A **verdict belongs to
the receipt it judged** — `verdictApplies()` — so uploading a corrected receipt does not leave
"rechazado" standing with nothing to fix. And **the record is read from the document, the link from
the signed URL**: signing can fail (a deleted file, Cloud Storage down, an environment with no
service account) and the first version of the panel hung the whole block off the signature, so a
failure took the filename, the amount, the date *and the verdict* off the screen with it. What is
lost when a URL cannot be signed is being able to open the file, and nothing else.

**Both queries in `listLeasesFor` need a composite index**, and this is the one gap the whole
verification bar has: **the emulator the drivers run against does not enforce composite indexes at
all.** A missing one passes `pnpm verify`, `pnpm build`, `pnpm test:rules` and all thirty-five
drivers, and then answers `9 FAILED_PRECONDITION` on production — which is exactly what happened the
first time `/arriendos` was opened there. So: **a new `where(...).orderBy(...)` means a new entry in
`firestore.indexes.json` and a `firebase deploy --only firestore:indexes`, in the same change.**
`features/lease/data/lease-indexes.test.ts` pins the pair so a query added without its index fails in
`pnpm test` instead of on somebody's screen; it is worth copying that guard for the next collection.

**The whole tenancy card opens the tenancy**, not just its title — four words at the top is a hit
area people miss more often than they find on a phone. It is the title link stretched over the card
(`after:absolute after:inset-0`) rather than an `<a>` wrapped around everything, because the card
also holds the link to the process and an anchor inside an anchor is invalid HTML the browser
repairs by dropping one. That second link sits above the overlay with `relative z-10`. One
consequence for the drivers: a `locator.click()` on anything inside the card is now correctly
refused as intercepted, so the way to assert it is a real `mouse.click()` at that point.

**Every month carries `data-month` and `data-state`.** They are how a driver asks the product what
state a month ended in instead of recomputing it: an assertion that restates the rule is a second
copy of the rule, and the copy nobody looks at is this one.

**Incidents are built**: `leases/{leaseId}/incidents/{incidentId}`, the sibling of `periods` the
agreed shape always had. **Only the tenant reports one; both parties manage it.** An incident is what
the person living there finds, so a landlord "reporting" one about a property they do not occupy would
be a note about their own tenant with no way for the tenant to answer.

The five states are `reported → in_progress → awaiting_confirmation → resolved`, plus `withdrawn`,
and **`awaiting_confirmation` is the one that makes the domain honest — it is the canon's shape
again.** The landlord says "ya lo arreglé" and that does *not* close it: whether the shower works is
something only the person showering can say, exactly as whether the money landed is something only
the person whose account it is can say. A repair the landlord can mark finished by themselves is a
repair that gets marked finished without being finished. So **only the tenant resolves**, only the
tenant withdraws their own report, and once the landlord has said it is fixed they have no button
left — just the message box, because there is nothing to do but wait.

`withdrawn` and `resolved` are both the tenant closing it and they are kept apart for the reason
"rechazada en la entrevista" and "rechazada al recibirla" are: different things happened. A withdrawn
one is not reopened — they report again. A **resolved** one the tenant *can* reopen, because a leak
that comes back is the same leak and filing it again would throw away the record of the first repair.

**The state is derived from the thread, never stored beside it** — `incidentState()` reads the last
update that moved it. Same choice `leaseSummary` makes over the periods and for the same reason: a
stored status is a second source of truth, and the day a write lands twice the field and the thread
disagree with no way to tell which is lying. The thread is inline on the document (capped by
`MAX_INCIDENT_UPDATES`), so deriving it costs nothing and a list of incidents stays one query.

**There is deliberately no "this is not my responsibility" transition, and no cost split.** Who pays
under *Ley 820* — the landlord owes the repairs the property needs to stay habitable, the tenant owes
the damage they caused — is what decides who pays for a boiler, and a product that computed it would
be telling both parties something it does not know. A landlord who thinks a broken window is the
tenant's doing writes that, in a message the tenant reads; there is no button that makes it true. The
thread keeps the disagreement instead of adjudicating it.

**A button's label depends on where the incident is coming from, not only where it is going.** Three
different things move one to `in_progress` — taking it on, a repair that did not work, and a leak
returning months later — and labelling all three "Está en arreglo" (which the first version did) gave
a resolved incident a button claiming somebody was already fixing it. `transitionLabel(from, to)`.

**`updates` is optional in the domain types and nowhere else.** Every incident reported before the
thread existed has no such key and those documents are in the database now; the converter defaults it,
and `incidentState`/`allAttachments` tolerate its absence anyway, because a pure function that is only
total because its one caller is careful is a function waiting for a second caller. Skipping that cost a
`Cannot read properties of undefined (reading 'length')` that took out the whole list.

**Images *and* video, and the video is the point.** A photo answers "is it broken?"; a video answers
"it only leaks when the tap runs" and "listen to this noise", which is the half of a repair argument a
still frame cannot carry. `video/quicktime` is accepted because an iPhone records `.mov` by default —
leaving it out would reject the file most Colombian tenants would actually produce. Two limits, not
one: 8 MB for a photo, **50 MB for a video** (`attachmentLimit` is a function of the type, because a
40 MB image and a 40 MB video are the same number and two different answers).

**The files do not go through the Server Action, and that is forced.** A Server Action's request body
is capped at **1 MB** by Next and `next.config.ts` sets no `bodySizeLimit`, so the browser uploads
straight to Cloud Storage with the web SDK — the route the listing photos and the identity documents
already take — and the action records what landed. Raising the limit to fit a video would raise it for
*every* action in the product. Three consequences worth keeping:

- The path is `incidents/{uid}/…`, **keyed by uid and not by tenancy**, because Storage rules cannot
  read Firestore: "is this person a party to lease X?" is a question they cannot ask. What they check
  is that the path names the uploader; which tenancy it belongs to is recorded in Firestore, where the
  question *can* be asked. The landlord cannot read the object at all and opens it through a URL the
  server signs — same as an identity document.
- The action therefore carries the real gate: party to *this* tenancy **and** its tenant, every path
  inside the caller's own folder, and **every object confirmed to exist in the bucket** with the type
  and size it claims. That last one is what a schema cannot do — without it a client writes a report
  carrying five attachments that were never uploaded, and the landlord opens five broken previews.
  The bucket's own metadata is what gets stored, so the numbers on screen are never the client's word.
- **Files are held in the browser and uploaded on submit**, not on pick. `incidents/**` denies
  `delete` to every client — the landlord reads this record, and a tenant who could delete the file
  would leave the report pointing at nothing — so a file uploaded on pick and then removed from the
  form would sit in the bucket for ever with nothing referring to it.

The notification carries the **title or the note, never the description**: a description is what the
tenant wrote about their home with the door broken, and an email is forwarded, quoted and left open on
a laptop. There is **a type per move** rather than one `incident_updated`, because the copy is the
point — "dicen que ya está arreglado" is a task the tenant has to act on, while "hay un mensaje nuevo"
is news, and a notification that does not say which of the two it is gets ignored. All six are lease
notifications, so they land on `/arriendos/<id>#incidente-<id>`. Everything in the section is `brand`,
never `accent` — the one cyan action on that page is the month that has to be paid, and a tenancy with
rent due and a broken boiler still has one first thing to do.

**`toNotification` was dropping the anchor, and had been since the anchors existed.** The converter
names every field it copies, so `period` — and then `incident` — never reached the bell: the same
notification landed on September in an email and at the top of a twelve-month page in the app. The
emails were fine, which is why nobody noticed: `renderNotificationEmail` reads the `NotifyInput` on
the way out, not the stored document on the way back in. A field added to the document needs a line
in that converter.

## The tenancy has three tabs

`/arriendos/<id>` is **Información · Pagos · Incidentes** — the term and the summary, where the canon
goes plus every month, and the reports. Three subjects, three panels.

**Información is listed first and Pagos is the one that opens.** The question this page exists to
answer is "¿está pagado este mes?", and the month that needs something is what somebody came for;
opening on a summary would put a reference card in front of the only action on the screen.

**`LeaseTabs` is a Client Component for one reason: the anchors.** Every notification about a month
links to `#mes-2026-09` and every one about a report to `#incidente-<id>`, and Radix unmounts the
panel that is not showing — so a link whose target is not mounted scrolls nowhere and fails silently,
which is the worst kind of regression because the email looks fine and the click looks like nothing
happened. The hash picks the tab, in the browser, because **a fragment is never sent to the server**
and no Server Component can read it. The mapping is derived from `periodAnchor("")` and
`incidentAnchor("")`, never from literals. The tab is deliberately *not* written into the URL on
click: the hash is a contract with links that already exist, and a `?tab=` every click rewrote would
be a second source of truth beside it.

Two React details that are not optional there. The `setState` that applies the hash is scheduled with
`requestAnimationFrame`, not called in the effect body — the compiler flags the second, and a frame
later is also what the scroll needs, since the tab has to be mounted first. And the scroll is its own
effect keyed on the tab, so it only fires when the panel holding the anchor is actually there.

The panels are passed in as **already-created JSX**, not components: an element crosses the RSC
boundary, a function does not.

**`pnpm e2e` has `leaseTab(page, name)` in `tests/e2e/lib.mjs`** because this is now how that screen
is navigated — it waits for the rail to hydrate before clicking (Radix will not switch on a click it
has no handler for yet, and Playwright will not retry a click on an element that was already
actionable) and then waits for the active tab, not for the click. Splitting this page cost `rental`
three assertions that read the summary out of `document.body.innerText`.

**Not built, and deliberately so for now**: who pays for a repair (above), the daily reminder cron
that would tell the tenant a canon is due, the IPC raise at renewal, and the closing described
above. A landlord recording "me pagó en efectivo" without a tenant
receipt is not built either — the flow is symmetric with the first canon on purpose. `/arriendos`
also does **not** mark the property `rented`, which the process does not do on finishing either.

## Notifications and email (`features/notification`)

Every movement of a process tells the person who did **not** cause it, twice: the bell in the
top bar, and an email. Both use the same copy, derived from the notification's `type` rather
than stored with it, so fixing a confusing sentence fixes the ones already sent.

The email carries what the bell cannot: an **absolute link straight to the stage**,
`/contratos/<id>#etapa-<stage>`. The timeline gives every stage that id, so the email lands on
the step it is about instead of at the top of a page with seven of them.

**Email goes out through Resend**, over its REST API — no SDK, because sending is a `POST` with
five fields. The `from` domain is derived from `RESEND_EMAIL_DOMAIN` rather than written by hand,
because Resend answers **403** when it does not match a verified domain and nothing errors until a
real email fails to leave. Without a key nothing breaks: the email is logged and the action carries
on, which is what lets the flow be exercised locally without mailing anyone.

**Resend is a standalone account, not a Vercel Marketplace resource.** `RESEND_API_KEY` and
`RESEND_EMAIL_DOMAIN` are set by hand in the project's Vercel environment (Development, Preview and
Production) and in `.env.local`; `vercel integration list` finds no resource for it. Moving it to the
Marketplace was considered and **rejected**: the env vars it would inject are already there, so the
only gain is unified billing — and `vercel integration add` provisions a *new* Resend account whose
API key does not carry this domain's verification. Production email would answer 403 and, as above,
fail silently until the SPF/DKIM records were pointed at the new account. That is a DNS change with
live rental processes waiting on notifications, traded for one invoice.

**The plan matters, and it is the daily cap that bites.** Resend's free tier is 3,000 a month but
**100 a day**; Pro at $20 removes the daily limit. A rental that reaches its tenancy walks seven stages
and each movement notifies the other party, plus two reminders per confirmed interview — of the order
of ten to fifteen emails per completed rental. A hundred a day is therefore seven to ten *processes
moving*, platform-wide, which arrives sooner than it sounds. **Driver runs must not spend that
quota**: see `tests/e2e/README.md` — the dev server is started with `RESEND_API_KEY=` empty, and the
day that was forgotten the free tier was exhausted by the test suite, not by users.

The links are absolute and built from **the request's own origin** (`shared/lib/site-url.ts`),
so an email produced on localhost links to localhost and one produced in production links to
production, without anyone remembering to set a variable — a preview links to itself. The `Host`
header is written by the caller, so it is checked against the hosts this product answers on:
without that, anyone reaching the server could have it email *its own users* a button pointing
at a domain they chose, from the domain those users trust. `NEXT_PUBLIC_SITE_URL` overrides it
all when something outside the request needs to decide, like a tunnel.

It is sent inside **`after()`**, so the person who clicked is not waiting on three network calls
for somebody else to find out. Only a **429** is retried: it is the one response that refused the
request without sending anything, so repeating it cannot duplicate an email — which is also why
no idempotency key is needed.

- **A rejected file occupies no slot.** `acceptable()` drops it before counting, because three
payslips with one rejected read as "Completo" with the upload disabled — so replacing it, the
only thing left to do, became the one thing the screen would not allow. On the tenant's side the
whole line turns red and says what to do; the verdict beside the thumbnail is just the word.

**Each row owns its own pending state**, in the review panel as in the uploader. One boolean
from `useTransition` froze every button in the panel while a single verdict saved, which for five
documents is five waits with the list unusable.

**A rejected document is told; an approved one is not.** The tenant has to act on a rejection
  and the reason is the only thing that says how; one approval out of five is a status change
  nobody needs interrupting for, and the last one moves the stage, which announces itself.
- **`notify()` never throws.** It runs after the work that matters is already written, and a
  failed notification must not undo an application or show an error about work that succeeded.
- **`listNotifications()` never throws either.** It is read by the layout that wraps every
  screen behind a session — the first version took the whole product down when its composite
  index was still building.
- `notifications` are readable only by their recipient, and a `list` is denied unless it is
  bounded *and* filtered: rules evaluate `list` per candidate document, and `request.query`
  exposes only `limit`, `offset` and `orderBy` — there is no way to inspect a query's filters.
- Marking as read is a Server Action scoped to the session's uid. `readAt` is the one field a
  client could plausibly own, and it still does not.

`miarriendodirecto.com` is already verified in that Resend account (SPF/DKIM), and it is the
same domain the links point at — a message about a rental arriving from another domain reads as
phishing, correctly.

### The bell rings, and it announces an arrival three ways

A grey icon with a four-pixel sticker on it is a notification system people discover the next day.
So something arriving **sounds**, **swings the bell once**, and **says so in a `role="status"` live
region**. Three channels because each one fails on its own: the sound is blocked until the first
gesture and can be switched off, the swing is off under `prefers-reduced-motion`, and neither is any
use to somebody listening to the page. What never fails is the count, which is why it is on the
button's accessible name and not only in the badge.

**The gate is identity, not "the snapshot changed".** `domain/arrivals.ts` — `firstSnapshot` /
`nextSnapshot` — rings only for a document id that was not there before, and rings **once** for a
batch. That is not fussiness: opening the panel writes `readAt` on every unread notification through
a Server Action, so the Admin SDK's write comes back on the bell's own subscription with
`hasPendingWrites` false and nothing new in it. A bell that rang on any change would chime at
somebody for having read their own notifications. The unit test breaks if the rule is weakened to a
count comparison, and `tests/e2e/notifications.mjs` drives the same case in a browser.

**The sound is synthesised, not a file.** Two sine notes a fifth apart (A5 → E6) with a fast attack
and an exponential decay: no asset in `public/`, no request, and no decode before the first one can
play — which matters, because the moment a notification arrives is the moment there is no time to
fetch anything. `PEAK_GAIN` is 0.09 on purpose; this is news, not an alarm, and it may arrive while
somebody is on a call.

**The autoplay policy is the whole difficulty, and it is honoured rather than worked around.** A
browser will not let a page make noise before the person has interacted with it: an `AudioContext`
created outside a gesture starts `suspended`, and `resume()` does nothing. So `armChime()` waits for
the first click, tap or keypress anywhere in the document and creates the context **there**, and
`playChime()` refuses to schedule anything unless the context is already `running`. Scheduling into
a suspended one would be worse than silence — `currentTime` does not advance while suspended, so
every held-back note fires at once on the next resume, which is a chime for a notification from ten
minutes ago at the instant somebody clicks something unrelated. The cost is real and stated in the
module: a notification arriving before the person has touched the page at all is silent, and the
badge, the swing and the live region still say so.

**A noise with no reachable off switch gets silenced at the operating system**, and then the
reminder ten minutes before an interview arrives silenced too. So the toggle is in the panel's
header — where somebody is standing when the sound annoys them — it is remembered in
`localStorage` (a UI preference, not personal data, so this is not the rule that forbids that), and
it is read through **`useSyncExternalStore`**: `localStorage` is an external store, so copying it
into state from an effect is both a second source of truth and the thing the React compiler
refuses. `subscribeSoundPreference` also listens for `storage`, so muting it in one tab mutes it in
the others. Turning it **on** plays the chime: a sound setting whose effect you only discover hours
later is one nobody trusts. The ring path calls `readSoundEnabled()` at the moment it rings rather
than reading state, so there is no copy of the preference inside the subscription's closure to go
stale — that subscription is set up once and outlives every change to it.

**The strong state is brand purple with a cyan count, and it is not a cyan button.** Unread, the
bell is a filled `bg-brand-panel` control; read, an outlined one with a purple icon. The old version
was `text-muted-foreground` in both, which is the colour this design system uses for text that does
not matter, on the one control whose whole job is to say that something does. It is not `accent`
because of the one-cyan-per-view rule: the bell is chrome, on every screen, so a cyan bell would
compete with all of them. A twenty-pixel cyan badge on a purple control is a signal; a cyan button
is a call to action. The badge is `text-accent-foreground` — white on `#00E5FF` does not pass AA —
and the old `bg-destructive` red is gone, because news is not an error.

The swing lives in `app/globals.css` (`--animate-bell-ring` plus the `@keyframes`), not in the
component: a loose `@keyframes` inside a React file is exactly the CSS nobody finds on the day it has
to change. Its `prefers-reduced-motion` override is deliberately **outside any `@layer`**, because
unlayered CSS beats Tailwind's layered utilities and that settles the specificity without a fight.
It replays by using the ring counter as the icon's `key`: remounting restarts a CSS animation and
toggling a class does not.

**The sound is driven by counting oscillators, not by listening.** `tests/e2e/notifications.mjs`
patches `AudioContext.prototype.createOscillator` through `addInitScript` and counts, which is the
only way to tell "it rang" from "the browser blocked it" — and it asserts the negative too: after
`readAt` is rewritten the count must not move, and a `0` there is proved to mean *silence* rather
than *blocked* by toggling the sound on immediately afterwards and watching the count jump. The
counter resets on every navigation, so each block takes its own baseline, and the arrival is driven
on a page that **never navigates**: what lands in the first snapshot is what was already on screen.

## Live updates

Both sides of a process are often on the same screen at once — one uploading, the other
approving — so the screen updates itself. `shared/lib/use-live-refresh.ts` subscribes to one
document with the web SDK and, when it changes, calls `router.refresh()`.

**The snapshot is a signal, not the data.** What is on screen comes from the server, and some of
it only the server can produce: a signed URL for a private file, a document collection the reader
is not allowed to query, an email address. Rendering from the snapshot would mean weakening those
rules or keeping two versions of every screen, so the subscription reads one field —
`updatedAt` — and the server render stays the single source of truth.

- The **process page** watches its application document, which is the one thing both parties may
  read and which every action here touches.
- The **bell** watches the caller's own notifications, which the rules already allow, and ignores
  its own first callback and its own pending writes.
- A tenant's documents live where a landlord cannot read them, so uploading calls
  `touchApplicationDocuments()` — one timestamp on the application — and that is what turns "a
  file arrived" into a live update on the other screen.
- The **tenancy page** watches its own `leases/{id}` document, not its months: a subscription per
  month would be twelve listeners for a page somebody has open for a minute, so a write inside a
  month nudges its parent's `updatedAt`. Same trick, one level down.
- Both hooks fail quietly: a denied or dropped subscription logs and stops updating. No live
  updates is a lesser problem than a broken screen.
- **`networkidle` no longer happens.** A Firestore subscription keeps a connection open, so any
  test or script waiting for the network to go quiet waits forever. Wait for `domcontentloaded`
  and then for the thing you actually mean.

## Client-safe module entries

A feature's `index.ts` re-exports its data layer, which is `server-only`. A Client Component
that imports it fails the build — the guard working as intended — so a module whose UI needs its
own domain also exposes **`client.ts`**: the pure half. `@/features/<domain>/client` is a public
entry, allowed by eslint and dependency-cruiser alongside the index; anything deeper is still a
violation.

## Sections not built yet
The menu shows Facturación and Ajustes **disabled**, with a "Pronto"
badge, instead of linking to a 404. To activate one: create the route and add its `href` to
the `NAV` array in `shared/shell/app-nav.tsx` — the one list both surfaces render, so the
sidebar and the drawer cannot disagree about what the product contains. **Arriendos was the
last one activated**, and that is exactly what the disabled entry was for: a menu that stopped
at "Contratos" said the year after a signature did not exist.

**The menu has two shapes and one content.** From `lg` up it is a fixed sidebar, always
visible: a wide screen has the room, and hiding the sections behind a click there costs one on
every navigation and buys nothing. It starts narrow (icon over label) and the arrow widens it
to the full labels; the choice is remembered in the `sidebar` cookie, **read on the server** in
`AppShell` so the width is right on the first paint instead of jumping open after hydration.
Below `lg` it is a drawer behind the hamburger, always expanded, because a permanent menu on a
phone would leave nothing for the property form.

Collapsed there is no room for the "Pronto" badge, so a disabled entry falls back to the
tooltip. A hover-only explanation is a poor one — that is why it is the fallback and not the
rule.

There is **no "Publicar" entry in the menu**: publishing is something you do to your
properties, not a separate place. The action lives on `/mis-inmuebles`, next to the list it
adds to, and the drawer keeps "Mis inmuebles" marked as the current section while the form is
open (`activeOn`).

The support card is real: WhatsApp and email, from `shared/lib/support-contact.ts`
(`SUPPORT_WHATSAPP_E164`, `SUPPORT_EMAIL`) so the number and the address change in one place.
WhatsApp goes first because it is where this conversation actually happens here; the `wa.me`
draft is short enough to send unedited, and both the draft and the mail subject are
percent-encoded or the first accent truncates the parameter. The catalog
card is a real link now that `/inmuebles` exists. The support card deliberately **carries no photo of a person** — a stock
image presented as "our team" would claim something false.

**The email action is not the same action on every device**, and the deciding question is the
pointer, not the width. `mailto:` only opens something when the operating system has a mail
client registered, and somebody who reads their mail on gmail.com in a browser has never
registered one — the click opens nothing and reads as a broken button. So `pointer: coarse` (a
finger) gets "Enviar un correo" with `mailto:`, and `pointer: fine` (a mouse) gets "Copiar
correo", which works on every desktop there is. A width breakpoint would get a phone held in
landscape wrong. Both buttons are rendered and one is hidden in **CSS**, not chosen in
JavaScript: the media query is answered before hydration, so nothing flashes, and `display:
none` also drops the hidden one out of the accessibility tree — a screen reader is offered
exactly one email action. The clipboard can still refuse (insecure origin, withheld
permission), and then the address itself appears under the button instead of a silent failure.

The buttons live in `shared/shell/support-actions.tsx` and are rendered by **both** the card on
`/inicio` and the `/soporte` page, so the two surfaces cannot drift. Only the copy button is a
Client Component; everything else there is a plain link.

## Loading states, and the 404 they cost

Every screen behind a session reads Firestore before it can render, so a click used to look like
a click that did nothing. `app/(app)/loading.tsx` answers instantly with a skeleton in the shape
of the page - the menu and the bell stay interactive, because they live in the layout - and
`app/(app)/contratos/[id]/loading.tsx` does the same in the shape of the process page.

**A `loading.tsx` covers a segment and everything under it, and a boundary above a route turns
its `notFound()` into a `200` with the not-found page streamed inside.** The headers are already
flushed by the time the page says "this does not exist". That is why:

- The **public** pages have none. A boundary over `/inmuebles` would also sit over
  `/inmuebles/<slug>`, and a soft 404 on the one page search engines index is a real cost. The
  catalog streams from a `<Suspense>` **inside** its own page instead, so the heading appears at
  once and only the part waiting on Firestore is replaced by a skeleton. A missing property still
  answers a true 404, and there is a driver assertion pinned on it.
- The **private** ones keep theirs. `/contratos/<id>` now answers `200` to a stranger with the
  same not-found page a made-up id gets, which is what the privacy property was ever about: the
  two are indistinguishable. These pages are `noindex`, so the status costs nothing.

`NavItem` also shows a spinner in place of its icon while its own navigation is in flight
(`useLinkStatus`). With a warm prefetch and a route-level fallback it never appears, and that is
correct - the skeleton is the better signal. It is there for the cold case, where the navigation
really is blocked on the network.

## Verification commands
```bash
pnpm verify        # arch → typecheck → lint → test, cheapest first, stops at the first failure (14s)
pnpm verify:all    # the above + build + test:rules — the whole bar (32s)
```

**`pnpm verify` runs after every change, with no decision about whether it applies**: `arch` is 1s
and `typecheck` is 2s, so deciding costs more than running. It includes the **whole** unit suite
rather than the files you touched, because its job is to tell you what your change broke elsewhere.

Only three checks are worth a decision, keyed on `git diff --name-only`:

```bash
pnpm build         # 9s — anything in app/, next.config.ts, proxy.ts, a 'use client' boundary, or
                   #      a new import of shared/firebase/admin.ts. The only check that catches a
                   #      server-only module reaching the browser.
pnpm test:rules    # 9s — firestore.rules, storage.rules, firestore.indexes.json, tests/rules/.
                   #      Mandatory when it applies. Needs JDK 21+. It does NOT check indexes:
                   #      the emulator ignores them, so a missing composite index is invisible to
                   #      every command here and only fails on production. A new
                   #      where(...).orderBy(...) needs its entry in firestore.indexes.json and
                   #      `firebase deploy --only firestore:indexes` in the same change.
pnpm e2e --since   # ~15s per driver — the browser level. Reads `git diff --name-only` and runs
                   #      only the drivers whose paths it touches (tests/e2e/manifest.mjs).
pnpm typegen       # 3s — only when a route moved or was renamed (see below).
```

**The e2e dev server has its own output directory**, `.next-e2e`, from `NEXT_DIST_DIR` in
`.env.e2e` (`distDir` in `next.config.ts`). That is not tidiness: `next dev` keeps its lock inside
`distDir`, so with both servers on `.next` the second to start refuses to boot — "you can access the
existing server at http://localhost:3000" — and every driver dies on `ERR_CONNECTION_REFUSED`, which
reads as a broken app rather than a busy port. It also stops `pnpm build` from pulling `.next` out
from under a running e2e server mid-run. Two consequences worth knowing: `.next-e2e/**` is in
eslint's `globalIgnores` (without it `pnpm verify` walks a second copy of every bundled dependency),
and `pnpm build` while the e2e server is up wants `NEXT_DIST_DIR=.next-build`.

**`pnpm e2e` is the level that catches what compiles and still does not work.** The soft 404 a
`loading.tsx` causes was found there and could not have been found anywhere else. It needs
`pnpm dev` running and the Firebase web key on the environment:

```bash
export $(grep NEXT_PUBLIC_FIREBASE_API_KEY .env.local | xargs)
```

Use `--since`, not the bare command: adding the skeletons selects 14 drivers of 32 and leaves out
`interview`, `guarantee`, `reminders` and `session`, which no `loading.tsx` can touch. Running all
32 for a change that cannot affect them is how a session spends seventeen minutes fixing its own
test harness. `tests/e2e/README.md` has the rest, including why they live in git now.

The number to watch is not how many commands ran, it is the **test count**: a green suite of 25
untouched files is green whether or not you tested what you just built. If a change added a
schema, a pure function or a state transition, `pnpm test`'s count must have gone up — and if it
did not, that belongs in the report by name.

After moving or renaming a route: `rm -rf .next && pnpm typegen`, or `tsc` fails on the
generated types with an error that has nothing to do with your change.

## Security Rules tests
`pnpm test:rules` boots the Firestore emulator and runs `tests/rules/` (86 cases, every rule
with a mandatory negative case). It needs **JDK 21+**, and **the script puts it on the PATH
itself** — `/opt/homebrew/opt/openjdk@21/bin` is prepended in `package.json`, because Homebrew's
`openjdk@21` is *keg-only*: it is not registered with `/usr/libexec/java_home`, so `java` resolves
to whatever older JDK is installed and `firebase-tools` refuses to boot. The prefix is a no-op
where that directory does not exist (Linux, CI), which is why `verify:all` runs anywhere.

No `export` is needed any more. If you install the JDK somewhere else, that path in
`package.json` is the one place to change.

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
