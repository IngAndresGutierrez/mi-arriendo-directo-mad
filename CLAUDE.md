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

**Copy that a user reads now lives in `shared/i18n/messages/`, not in the component** — see "Two
languages" below for which surfaces have been moved and which are still Spanish literals. The rule
underneath has not changed: keys are English, values are the language's.

Three exceptions, and only these:
1. **URLs** (`/registro`, `/inicio`, `/registro/completar-perfil`): users see them. They stay Spanish
   in **both** languages; what English adds is the `/en` prefix in front of them.
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
- `shared/i18n/` — the two languages. `locale.ts` is pure and imported by `proxy.ts`, so nothing
  React-shaped may enter it; `messages/es.ts` **is** the `Dictionary` type and `en.ts` is annotated
  with it; `server.ts` reads the locale from `next/root-params`; `locale-link.tsx` is the `<Link>`
  every call site uses. **Never re-export `server.ts` from `index.ts`**: it imports
  `next/root-params`, which fails at build time inside a Client Component, and a barrel dragging it
  in would make the module unimportable from the client half of the product — the same split, for the
  same reason, as `shared/firebase/admin.ts` never appearing in a barrel.
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
app/[lang]/           routing only. (auth)/ and (app)/ are route groups: they do not change the URL
app/                  what has no language: robots.ts, sitemap.ts, api/**, the icons, globals.css
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
| `/` | `LANDING_ROUTE` | **The public landing**: what somebody typing the brand gets. What this product is, a search into the catalogue, the cities with supply, the process from both sides and the newest listings. It renders for a visitor and for somebody signed in — the header swaps "Iniciar sesión" for the account menu rather than redirecting, because bouncing a person out of a public page they asked for is not an improvement. |
| `/ingresar` | `LOGIN_ROUTE` | Login (email + password, Google). **It used to be `/`**, which meant the one URL reached by typing the brand answered with a password field: nothing about the product, and nothing to do for somebody without an account. Moving it also fixed an SEO contortion — see the `(auth)` note under SEO. |
| `/registro` | `SIGNUP_ROUTE` | Two-step signup: email → password. |
| `/registro/completar-perfil` | `COMPLETE_PROFILE_ROUTE` | Onboarding: there is a session but no profile yet. |
| `/inicio` | `HOME_ROUTE` | User portal: greeting, **the contracts in course** and shortcuts. Destination after signing in. The card lists the open processes with the stage each one is on — it used to read a `contracts` collection nothing writes, so it told somebody with three open processes that they had nothing. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | Ask for a reset email. **It was linked from the login form long before it existed**, answering 404 the whole time — the same failure the legal pages had, and one `pnpm build` cannot see, because a `<Link>` to a missing route compiles perfectly. |
| `/recuperar/confirmar` | `PASSWORD_RESET_CONFIRM_ROUTE` | Where the link lands: takes the `oobCode` and sets the new password. **Whether Firebase's email points here is a console setting** (Authentication → Templates → Action URL), not code — untouched, the flow still completes on Firebase's own hosted page. |
| `/inmuebles/publicar` | `PUBLISH_PROPERTY_ROUTE` | Where a landlord publishes. Needs a complete profile. |
| — | — | Publishing requires the **matrícula inmobiliaria**, and it is stored beside the street in `properties/{id}/private/location`, never in the public document: with that number anyone can pull the certificate and read the address off it, so publishing it would publish the address by the back door. Validated loosely — the circle is two or three digits and the separator is written every way — because the only real check is against the registry, which this product does not do. |
| `/mis-inmuebles` | `MY_PROPERTIES_ROUTE` | The landlord's own listings: edit, copy link, delete. |
| `/postularme/<slug>` | `applyToPropertyRoute(slug)` | Where a tenant applies. Needs a complete profile; redirects to the process if one is already open. |
| `/contratos` | `CONTRACTS_ROUTE` | Every process the user is part of, on either side: the open ones with their stage rail, the closed ones with why they closed. **It is called "Contratos" because that is what it produces** — everything up to the first canon is the negotiation that *ends* in a signed contract, and the tenancy that runs afterwards is a different thing with a different lifetime. **`/contrato` and `/contrato/<id>` redirect here permanently** (301 in `next.config.ts`): every email already sent points at the old path, and the browser keeps the `#etapa-…` fragment across the redirect. |
| `/contratos/<id>` | `applicationRoute(id)` | One process: its seven stages. A non-party gets 404, the same answer as a process that does not exist. |
| `/arriendos` | `RENTALS_ROUTE` | The tenancies in course, on either side. This is the **other half of the product**: `/contratos` is the negotiation that ends in a signed contract, and this is the year that follows it. The question it answers is not "¿vamos a hacer esto?" but "¿está pagado este mes?". The forward that used to live here was a **307 written in the page and never a 301 nor a rule in `next.config.ts`**, precisely so this page could replace it — a permanent redirect would have been cached against it, and a `next.config.ts` rule resolves before routing and would shadow the route. |
| `/arriendos/<id>` | `rentalRoute(id)` | One tenancy: the term, where the canon goes, every month of it, and the incidents the tenant has reported. **The id is the application's**: one process produces one tenancy, so `/contratos/<id>` and `/arriendos/<id>` are two halves of one story under one key. A non-party — or an id whose process has not finished yet, so no tenancy was opened — is **forwarded to `/contratos/<id>`**, which is both the privacy answer and what keeps every notification sent before the rename working: they all point at `/arriendos/<id>#etapa-…`. |
| `/perfil-inquilino` | `TENANT_PROFILE_ROUTE` | "Mi perfil": the account details given at signup **and** the reusable tenant dossier, on one page with one save. |
| `/terminos` | `TERMS_ROUTE` | Conditions of use. Mostly about what this product **is not**: not an agency, not a broker, does not sell insurance, does not move the money. |
| `/privacidad` | `PRIVACY_ROUTE` | The política de tratamiento. `#derechos` is the anchor the aviso de privacidad and the profile screen both link to. |
| `/cookies` | `COOKIES_ROUTE` | The **five** things this product stores in a browser, by name, and the switch that makes the analytics authorisation revocable. `locale` is the fifth — a cookie this product sets and did not declare is exactly what that page exists to prevent. |
| `/soporte` | `SUPPORT_ROUTE` | How to reach a person: WhatsApp and email, each saying what it is good for. No form and no ticket number — there is no queue behind one. **It is the one page that renders in either chrome** (`app/soporte/`, outside both route groups): the product's menu when there is a session, the public header when there is not. Needing help is not something you should have to sign in to do, and "Contacto" sits in the public header either way. |
| `/mis-inmuebles/<id>/editar` | `editPropertyRoute(id)` | Editing one. **Both publishing and saving an edit end on the list**, not on the listing: what a landlord does next is copy its link, publish another, or look at what they already have, and all three are there. |
| `/mis-inmuebles/<id>/aviso` | `propertyPosterRoute(id)` | The rental notice: the listing as an A4 sheet to print, with a QR, and a square to post, with the link as text instead. `.../aviso/pared` and `.../aviso/redes` are the PNGs. Offered only while the listing is `available` — see "The rental notice" below. |
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
- **The destination after signing in can never be `/`, `/ingresar`, `/registro` or `/recuperar`**,
  and `safeRedirect()` rejects all four plus any external URL (open redirect). Three of them would
  **loop**: the screen sees the live session and sends you straight back. `/` is in the set for a
  different reason and it is the one worth stating, because it survived the landing taking that URL:
  the landing renders perfectly well with a session, so it is not a loop — it is a worse destination.
  The point of signing in is to reach the portal, and landing back on the marketing page is being
  handed a brochure for a product you are already inside. Dropping it from the set the moment it
  stopped being the login would have quietly made `?next=/` valid.
- The login and signup layout is `shared/shell/auth-shell.tsx`. Its side panel uses the
  `panel-marca` token (purple in both themes), never `bg-primary`.
- The email from signup step 1 lives in component state, **never in the URL**.
- **A property's URL is its slug alone** — `/inmuebles/apartaestudio-en-los-alcazares-manizales`,
  with no id appended: these links get pasted into WhatsApp and Facebook groups, where a random
  code at the end reads as unsafe to click. Uniqueness comes from `propertySlugs/{slug}`, whose
  document id *is* the slug, so a page resolves with one `get` and two landlords cannot claim the
  same URL. Older shapes (`<slug>-<id>` and a bare `<id>`) are permanently redirected, so links
  already shared keep working.

**There are no links to routes that do not exist.** `/recuperar` was the last one and is built now;
`/terminos`, `/privacidad` and `/cookies`
exist now** — they had been linked from the signup and onboarding screens, and answering 404 for as
long as those links existed is not something `pnpm build` can catch: a `<Link>` to a route that is
not there compiles perfectly. `tests/e2e/legal.mjs` is what pins them.

**On a wide screen the catalog is a fixed frame and only the list scrolls.** From `lg` the public
chrome is `fixed inset-0` and `main` owns the overflow; the results column keeps its own
`overflow-y-auto` so the heading, the facets and the pager stay put — a filter you cannot see is
a filter you forget you applied. `h-svh` alone was not enough: the document still scrolled the
header out of view by its own height. Below `lg` the page scrolls as a page, because an inner
scroller on a phone fights the address bar and pull-to-refresh, and there the facets are behind a
button anyway. `CATALOG_PAGE_SIZE` is **6**.

## The landing (`app/(marketing)/`)

`/` is the public front door, and it took that URL **from the login**. The structure is adapted from
codomoliving.com — hero with a search, cities with counts, what makes the product what it is, the
process, real listings, a closing invitation — re-aimed at a two-sided marketplace.

**The photography did not come across, and nothing stands in for it.** That reference is built on
lifestyle photos of housing the company operates; this product owns no housing and no photographs of
any, and a stock apartment presented as ours would claim something false — the same call the support
card already makes by carrying no photo of a "team". What fills that role is **the catalogue itself**:
the city cards and the showcase are real published listings, read from Firestore. A landing that
describes a marketplace without showing anything in it asks to be taken on faith.

**Every claim on it is something the product actually does.** That threw out the three most tempting
cards: no "ahorra hasta un 30%" (this product does not know what an agency would have charged), no
"encuentra en 48 horas" (the process moves when two people move it) and no rating (nothing collects
them). It is the same discipline the listing's JSON-LD follows by refusing an `aggregateRating`.

**Both data-driven sections remove themselves when the catalogue is empty**, rather than rendering
"muy pronto" placeholders. An empty shop window with the lights on tells a first-time visitor the
product has no supply, on the screen where they are deciding whether to bother.

**The hero never waits on Firestore.** Its headline is the LCP of the most-fetched page on the site,
so the search card's city list streams behind a `<Suspense>` whose fallback is *the same form with no
cities* — what arrives late is extra options, never the control. A search submitted in that window
searches every city, which is a real answer. One `cache()`d read serves all three consumers, and it
**never throws**: a Firestore hiccup costs the listings, not the front door.

**The search is a native `<form method="get">` with native `<select>`s, and that is not sloppiness.**
The product's rule is that every form carries `method="post"`, because a form with no method submits
as a GET before hydration and a login doing that puts the password in the URL and the server logs.
Nothing here is personal data: it is a search, and the catalogue's whole state already lives in the
URL by design (`parseCatalogFilters` and `catalogQuery` are inverses). So a GET to `/inmuebles`
produces exactly the URL the catalogue reads **with no JavaScript at all** — which also rules out the
Radix `SelectField` the product's forms use, since that is a button that submits nothing.
`tests/e2e/landing.mjs` drives it with every bundle aborted, and that assertion was proved by
switching the form to `post` and watching it go red.

**One `accent` on the page**, the search, repeated at the foot — the same action within reach twice,
which is the rule the process page's two advance buttons established. Everything else is `brand` or
`outline`.

**An `outline` button on a brand panel needs an explicit `text-foreground`.** `outline` sets a
background but no colour, so on the closing panel the label inherited `text-brand-panel-foreground`
and rendered white-on-white — an empty pill. It was reported from the screen, because a colour
inherited from an ancestor is exactly what no type checker and no lint rule can see.

**`shared/auth/routes` is in `SELECTS_EVERY_DRIVER` now.** It was mapped nowhere, which is the
manifest's own documented mistake: every URL in the product comes out of that file, so changing a
constant's *value* does not break the file that defines it, it breaks every screen that uses it.
Moving the login proved it — 26 drivers entered through `/` to fill in the form, and no hand-written
list would have named them all. `LOGIN_PATH` in `tests/e2e/lib.mjs` is where that path lives now.

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
same — and **nothing in that group overrides it any more**. It used to: a route group does not change
the URL, so `(auth)/page.tsx` *was* `/`, the login and the site root at once, and it had to buy its
way back to `index: true` against its own group or the homepage of the domain would have been asking
not to be indexed. With the landing at the root and the login at `/ingresar`, the group's rule
finally applies to the whole group and a page whose entire content is a password field is plainly
`noindex`. Two pages used to carry `robots: { index: false }` of their own:
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

## The rental notice (`/mis-inmuebles/<id>/aviso`)

The Open Graph card solves what a *link* previews as. This solves the other half: what a landlord
hands to somebody who is not looking at a link. **A4 to print and tape to the doorway, and a
1080×1080 square for a WhatsApp status or a Facebook group** — and the two differ in how the link
reaches a person, which is the whole design. The sheet carries a QR code, because a camera is the
only route from paper into a listing. The square carries none, because it is looked at on the phone
that would have to scan it; there the link travels as text beside the image.

**Three things are deliberately not on it, and the first is the reason the feature is shaped this
way at all.** A poster is a *file*, and the point of the feature is that the file gets forwarded — so
whatever is on it is published in a way that cannot be withdrawn.

- **No street and no coordinate.** Same rule as the card, the JSON-LD and the map. A sheet taped to
  the building does not need the address — it is at it — and one posted to Instagram must not carry
  one.
- **No phone number.** The obvious thing to put on a "se arrienda" sign and the wrong thing here
  twice over: personal data on a file that circulates with no way to withdraw it, and a route around
  the product — the QR leads to the listing and from there to an application with a validated
  profile behind it, where a phone number leads to a WhatsApp thread with a stranger.
- **Not the landlord's own headline.** "HERMOSO APTO REMODELADO 😍" is neither specific nor
  comparable, exactly as in the `<title>`. What sells at two metres is the price, the neighbourhood
  and the size, in the same shape every time.

**A listing that is not `available` gets no notice**, and `posterBlocker` is the rule — checked on
the screen *and* in the image route, because a page guard protects a screen and not an endpoint.
Only an `available` listing has a public page, so a code printed from a draft opens a 404 for
everybody who scans it **and keeps working for its owner**, who therefore can never find out. It is
the failure the manage card already avoids by swapping "Copiar enlace" for "Publicar" on a draft,
one step further along: there the broken link is in a clipboard, here it is on a wall. The card
offers "Aviso" only while `posterBlocker` answers `null`; the screen explains the two reasons apart
(a draft is one button away, a rented listing is finished) rather than 404ing at its own owner.

**The URL in the code is `metadataOrigin()`, never `resolveSiteUrl()`.** This is the sharpest case
of the distinction in `shared/lib/site-url.ts`: a link in an email must reach the person reading it
now, and a link printed on paper must work in eight months, from a stranger's phone, long after the
preview deployment that generated it is gone. "Wherever this request came from" is the one answer
guaranteed to be wrong. `tests/e2e/poster.mjs` asserts the decoded code does **not** point at the
server that produced it. The locale prefix travels with it, and nothing else does — no campaign
parameter, because the line printed under the code is meant to be typed by somebody whose camera
will not focus.

**The square carries no QR code, and that is the correction the first version needed.** A square is
looked at *on the phone that would have to scan it*, and a phone cannot scan its own screen — so the
code was a quarter of the composition doing nothing. What travels on social is **text**:
`content.shareText`, the fact sheet plus the link, which the share sheet hands to the target app as
the caption and which the screen also offers as one button to copy. That is where a link actually
becomes tappable — a WhatsApp group, a Facebook post, a story's link sticker — because no network
makes a link inside an image tappable. The caption is also **printed on the screen**, not hidden
behind the button: the clipboard can refuse, and a landlord may want to change a word first.

`navigator.share({ files, text })` is best effort and is written down as such — WhatsApp takes the
text as the caption, others drop it silently — which is exactly why "Copiar el texto" is a control of
its own rather than a fallback. On Instagram and Facebook the caption is pasted by hand, and a
mechanism that only works where the share sheet cooperates fails quietly on the two networks this
format exists for. The square keeps the **address** printed large instead, for the reader who saw it
in a status with no caption attached.

`shareText` is `property.seoDescription` plus the URL — the sentence the Open Graph card already
uses, deliberately **unclamped**: 160 characters is a fact about what a search result shows, and a
caption in a WhatsApp group is not one. Reusing it means the paste preview and the caption above it
make the same claim.

**Everything above the closing band is one composition for both shapes.** The same five things in
the same order — headline, photo, price, where, facts — because two layouts would be two places for
that to drift, with the printed one being the copy nobody looks at again. What differs is proportion
(`LAYOUT`, a record of numbers in `features/property/ui/rental-poster.tsx`) and the closing band,
which differs because the link reaches a person in two different ways. That is a difference in kind,
not in proportion.

**A square is a fixed box, and A4 is not.** The sheet has slack the middle band absorbs, so a footer
one line taller than budgeted just pushes down; on the square it falls off the bottom edge, and what
falls off first is the wordmark. It did, at `photo: 470` — the numbers are 400 and a 26px address
now, the closing band is `flexShrink: 0`, and this was found by drawing it and looking. Nothing in
the bar can see a band that overflowed a PNG.

**The QR lives in `shared/qr/`, not in the property module**, and it answers in two steps on purpose.
`qrMatrix` produces the modules and `qrSvg` draws them, so a unit test can decode the first with an
independent reader (`jsqr`, a devDependency) and count the second. A single "give me a PNG" function
would be one opaque blob no assertion can look inside — and a QR that does not scan is the failure
nobody notices until somebody is standing in front of a wall with their phone out. Three details
that are not preferences:

- **`qrcode-generator`'s own `stringToBytes` truncates to Latin-1** (`charCodeAt(i) & 0xff`), turning
  an accented character into a different byte rather than into an error. It is replaced with
  `TextEncoder`, which is how the library is meant to be configured, and a test pins it.
- **`qrRenderSize` snaps the drawing down to a whole number of pixels per module.** At a size that
  is not a multiple of the module count the rasteriser rounds some rows up and some down, which
  merges neighbouring modules.
- **The code paints its own white ground, quiet zone included.** The panel behind it is brand purple,
  and a code with no ground of its own is a code drawn on purple, which no scanner reads. Error
  correction is `Q` (25%), one level for both formats: the printed one gets sun, tape and torn
  corners, and two levels would be two different codes for one listing.

**A satori tree is the one component in this repository that nothing can inspect** — it is laid out
into a PNG on the server and what comes back is pixels. So everything that could be *wrong* rather
than merely ugly lives in `features/property/domain/poster.ts` and is unit-tested there (the two
negatives above included), and `tests/e2e/poster.mjs` downloads the real PNG, draws it to a canvas
and **decodes the code out of its pixels**. That assertion exists at no other level of the bar.

**Printing is `window.print()` over a rule in `app/globals.css`, and the sheet is portalled to
`<body>`.** That is what makes the rule "hide my siblings" — one line — instead of a fight with the
cascade: hiding the page from inside it means either `visibility: hidden`, which still reserves the
layout and prints blank pages after the poster, or naming each wrapper of the app shell, which
breaks the day the shell changes. `Ctrl+P` anywhere on the screen prints the A4 sheet whatever
format is selected, because printing a square onto A4 is not something anybody wants.

**And `!important` inverts layer order — which is the opposite of the rule this file relies on two
blocks above, and it printed a blank page.** The portalled sheet used to carry the `hidden`
attribute, un-hidden by `display: block !important` under `@media print`. Tailwind's preflight
carries `[hidden] { display: none !important }` **inside a layer**, and for important declarations
the cascade reverses layer precedence: unlayered important *loses* to layered important. So the
sheet stayed `display: none`, and Chromium produced one correctly-sized, entirely empty A4 page. The
attribute is gone and `[data-print-sheet]` is hidden from the stylesheet instead, where nothing
competes and neither declaration needs `!important` at all. (The `prefers-reduced-motion` override
higher up in that file is still correct: it is a *normal* declaration, and there unlayered wins.)

**The driver asserts the PDF contains an image, not just one page** — and that distinction is the
whole lesson. Counting pages passes happily on a blank sheet: the broken PDF was 1.112 bytes, had a
perfect A4 `MediaBox` and nothing inside it. Both halves were proved by breaking them on purpose:
`visibility` instead of `display` comes back as two pages, and the `hidden` attribute comes back as
"una hoja en blanco".

**One cyan per view, and which action earns it depends on the format.** The wall sheet exists to be
printed, so `Imprimir` takes the accent. On the square it is `Compartir`, or — where the browser
cannot hand a file to a share sheet, which is most desktops — `Copiar el texto`, because there that
*is* the whole flow: download the square, paste the caption, post. The share button is not rendered
at all when `navigator.canShare({ files })` says no, rather than rendered and failing: a control that
fails is worse than one that is absent, the same rule the signature's WhatsApp channel follows.
`Descargar` is `brand` in every case.

**`shared/lib/embed-image.ts` is why the OG card and the notice cannot disagree about a broken
photo.** Handed a remote `<img src>`, satori fetches it during the layout pass and a 404 throws from
in there, taking the whole image with it — a missing photograph becomes a missing card. Fetching it
first turns that into a `null` each composition answers differently. It was extracted from the Open
Graph route rather than copied.

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

Eight stages, in `domain/application.ts`, and the landlord moves it **one stage at a time** —
nothing advances by itself, because each of these is a decision someone makes off the platform
and then records here. `submitted → visit → tenant_data → background_check → interview → guarantee →
contract_signature → first_payment`.

**Except the end, which is the one deliberate exception**: confirming the first canon *is* the
decision, so it ends the process and opens the tenancy in the same movement. There is no ninth
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

**`visit` is built, and it is second on purpose — the position *is* the argument.** The tenant goes
to see the property before anybody is asked for an identity document, for payslips or for permission
to search their judicial record, and before the landlord spends any of that on somebody who will
walk in and find the building faces a motorway. It sits as early as it can and still have an
application to hang off, and `application.test.ts` pins it there.

The shape is the interview's — the landlord proposes, the tenant confirms, proposing again
**replaces the whole arrangement** — with one deliberate difference and one new field:

- **The verdict is the tenant's**, and only theirs. Whether a flat is right is something only the
  person who walked through it can say, exactly as whether the money arrived is something only the
  person whose account it is can say and whether the shower works is something only the person
  showering can say. `recordVisitVerdict` refuses the landlord, and the panel offers them no such
  control. **"No me interesa" blocks the stage** — that is what makes this a step that filters
  rather than one that is merely recorded — but it does **not** close the process: ending it is a
  decision with a name on it, both parties already have their button, and somebody who saw the flat
  on a grey Tuesday can change their answer by Thursday. `visitBlocker` answers `not_interested`
  and the message names both ways out.
- **`meetingPoint` is the one field in the process that gives away the address**, and it is required:
  a visit is somebody crossing a city, and "el jueves a las 3" with no address is an appointment
  nobody can keep. What stops it undoing `properties/{id}/private/location` is that it is read on
  the page, behind the session, and **never leaves in a notification** — the bell says when, the
  address is on the page. Same rule as the payout account details, and `tests/e2e/visit.mjs` proves
  it by reading the bell's panel (not `document.body.innerText`, which contains the page behind it,
  where the address belongs). It was verified by leaking the point on purpose and watching it go red.
  It is the landlord's own sentence rather than the stored address, because "en la portería, pregunta
  por Alberto" is what actually gets somebody to the door — but the address they gave when publishing
  is offered as a button, since they typed it once already.
- **Two notification types for one field**, `visit_interested` / `visit_not_interested`, the lesson
  the incidents paid for: "le interesó" is a task and "no le interesó" is the end of the process,
  and one type carrying the result inside is a bell nobody can act on without opening the page.
  Unlike the interview's conclusion — which the landlord writes and then announces by advancing —
  this news travels *towards* the landlord, so it has to be notified or they wait on a page for
  something that already happened.

**No reminders.** The interview's cron (`dueReminder`, the day-before and ten-minutes-before sweep)
covers interviews only; a visit is exactly as forgettable and wiring it in needs a WhatsApp template
approved by Meta, which is not something this repository can create. Stated rather than half-built.

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

## Colaboradores (`features/collaboration`)

A landlord who lives in another city — or simply has a job — cannot be at a door every time an
applicant wants to see the apartment. So they delegate the **errand**: `collaborations/{id}` is an
edge, `landlord → collaborator`, scoped **per property and per capability**, and the whole design
follows from three things it deliberately is not.

**Not a role.** `role` is global and singular, and the same person is the landlord of their own
apartment and a collaborator on their cousin's — a fourth role would stop them publishing. The
product already refuses declared identity: nobody applies to become a landlord, they *become* one by
publishing, and `DEFAULT_USER_ROLE` is what everybody starts as. A collaborator is an account like
any other plus an edge. **No custom claim either**: the menu's "Encargos" entry is decided by one
bounded query in `ProductChrome`, because a claim set after the fact needs `PATCH /api/session` to
be re-minted and forgetting that shows up as a menu that is wrong until the person signs out.

**Not a party to the process**, and this is the load-bearing decision. A collaborator never reads
`applications/{id}`: that document is **indivisible** and carries the dossier — document number,
income, the reference's phone. `getApplicationFor` answers `null` to them and must keep doing so.
What they get is a **projection** built for the errand (`features/application/data/errand.ts`), on a
screen of their own. Handing them the process page with the interface hiding parts of it is how a
cédula leaks: eight stage panels, each with its own sensitive fields, each needing a flag, and the
one somebody forgets is the leak — the same shape as the metadata merge that silently dropped
`nofollow`. There is deliberately **no exported function in that module that reads without
authorizing**: `authorizeErrand` does both at once, so an unchecked read is not something a call
site can reach for. `tests/e2e/collaborators.mjs` asserts the absence over `page.content()` — the
HTML *and* the RSC payload — and it was verified by leaking the document number on purpose.

**Not a decision.** Delegating who opens a door is not delegating who gets the apartment. The
collaborator proposes the visit and nothing else: they cannot advance the process, reject the
application, record what the tenant thought of the flat, sign, touch the payout or confirm a canon.
Each of those follows from a rule already written down — above all Decreto 2364, which requires the
signature's creation data to belong exclusively to the signer.

**Per property**, not per portfolio and not per applicant. A landlord with a building hires one
person to show it to everybody, so per-applicant is friction on every application; portfolio-wide
hands over twelve private addresses at once.

**Acceptance is where the permission comes from.** `hasCapability` reads only `accepted`, so an
invitation grants nothing at all until answered — nobody is conscripted into seeing a stranger's
name and phone, the same way a proposed time is not an appointment until the tenant confirms it.
`canTransition` is what stops the case that matters: accepting a grant the landlord already revoked
would hand back an access nobody meant to give. `declined` and `revoked` stay apart for the reason
`withdrawn` and `resolved` do on an incident — different things happened.

**The invited person must already have an account**, and that is a stated limitation rather than an
oversight. A pending invitation keyed by an email needs a *claim* mechanism, and every version of
that has a security question in it: who may claim it, what happens when they change address, and
what stops a query by email from enumerating who was invited where. `inviteCollaborator` says the
whole errand instead — register *with that address*, then invite again. The cost is a small
disclosure (the landlord learns whether an address has an account) and it is accepted knowingly:
the alternative is a button that silently does nothing.

**The tenant is told who is coming.** `Visit.shownBy` is a record, not a permission, and
`visitHostLine` is the one formatter for it — it says *"en nombre del propietario"* rather than
naming the landlord, because what the tenant needs is the relationship. The notification is its own
type, `visit_proposed_by_collaborator`, because the copy is the point: they are meeting a stranger
somewhere, and "Carlos propone el jueves" without saying who Carlos is reads like a wrong number.
The **meeting point still never leaves in a notification** — that rule does not weaken because
somebody else arranged the visit.

**Two screens.** `/colaboradores` is the landlord's roster; `/encargos` is the collaborator's front
door and it exists because without it the feature is unreachable — a collaborator is not a party to
anything, so `/inicio` greets them with an empty "Tus contratos en curso" and `/contratos` with
nothing at all. The invite form **clears itself on success**, and that is not tidiness: the habeas
data declaration is about the address in the box beside it, so a tick carried over to the next
invitation is a permission granted about one person being reused for another.

**Habeas data.** The collaborator is a **new category of recipient** — not an encargado, since they
are not a provider — so `/privacidad` names them and says exactly what they receive and what they
do not. The policy is at **version 2** and `reconsentFrom` stays at **1**: the finalidad did not
change (managing the rental; showing the property is an act of that same process), what changed is
*who* executes it, which is an information duty. **That call deserves a lawyer's eye** and the
reasoning is written beside the constant. `ERASURE_PLAN` deletes grants in both directions — a
permission is not a two-party record, and one that outlives the account that granted it is exactly
what must not be left behind — while the name already written into a visit's `shownBy` stays.

**Not built, deliberately:** `handle_incidents`. It is the obvious second capability and
`COLLABORATOR_CAPABILITIES` has one value, because a capability the landlord can tick and nothing
enforces is a permission they believe they granted. Adding it is a value in that list plus the
checks that read it. The **interview is not delegable** either, and that is a product decision
rather than a gap: a collaborator can hold a meeting, but the interview is where the landlord judges
the person.

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

## The tenancy has four tabs

`/arriendos/<id>` is **Información · Pagos · Entrega · Incidentes** — the term and the summary, where
the canon goes plus every month, the acta de entrega, and the reports. Four subjects, four panels.

**Entrega joined last and it is a subject rather than a section of one of the others**: the term is
the agreement, the months are the money, an incident is something that broke *during* the tenancy,
and the acta is the state of the property at the two moments that bracket it. Filing it under
Información would bury a record with photographs inside a reference card. See "The acta de entrega"
below.

**Información is listed first and Pagos is the one that opens.** The question this page exists to
answer is "¿está pagado este mes?", and the month that needs something is what somebody came for;
opening on a summary would put a reference card in front of the only action on the screen.

**`LeaseTabs` is a Client Component for one reason: the anchors.** Every notification about a month
links to `#mes-2026-09` and every one about a report to `#incidente-<id>`, and Radix unmounts the
panel that is not showing — so a link whose target is not mounted scrolls nowhere and fails silently,
which is the worst kind of regression because the email looks fine and the click looks like nothing
happened. The hash picks the tab, in the browser, because **a fragment is never sent to the server**
and no Server Component can read it. The mapping is derived from `periodAnchor("")`,
`incidentAnchor("")` and `handoverAnchor("")`, never from literals. The tab is deliberately *not* written into the URL on
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

**Not built, and deliberately so for now**: who pays for a repair (above), the IPC raise at renewal,
and the closing described above. *(The canon-due reminder and the acta de entrega **are** built now —
see "Canon reminders" and "The acta de entrega" below.)* A landlord recording "me pagó en efectivo" without a tenant
receipt is not built either — the flow is symmetric with the first canon on purpose. `/arriendos`
also does **not** mark the property `rented`, which the process does not do on finishing either.

## Canon reminders (`features/lease`, `/api/cron/canon-reminders`)

**The one movement of a tenancy nobody causes.** Every other notification in `/arriendos` is
somebody doing something and the product telling the other party; a month falling due is the clock,
so a Vercel Cron wakes the server. It is the reminder `CLAUDE.md` listed as not built, and it is
what makes the tenancy half of the product worth having open month after month.

**Three types, not one.** `canon_due_soon` (3 days ahead), `canon_due_today`, `canon_overdue` (the
day *after*, never the same evening — a transfer made on the due date can land the next morning, and
telling somebody they are in arrears about money they already sent is the message that makes them
stop trusting every other one). One `canon_reminder` carrying the day count inside would be a bell
nobody can act on without opening the app, which is the rule the visits and the incidents already
paid for.

**The two early ones are the tenant's business alone; arrears reach both.** A bell that rings at a
landlord for the calendar is a bell muted before the month it matters. From the moment a month is
late it stops being a task for one person and becomes a fact about the tenancy — and finding that
out a month later from a bank statement is the failure `/arriendos` exists to prevent.

**`remindableMonths` is not `currentMonth`, and that was a real bug rather than a refinement.** The
month a tenancy is "in" is the month `today` falls in, so for a canon due on the **1st**, a sweep
looking only at the current month sees a due date three weeks past while the next month — the one
three days away — is not a candidate at all. "Vence pronto" could never fire for that tenancy, and
would fire normally for one due on the 28th: a delivery failure that looks like an infrastructure
problem for months. The window is expressed in **days from each due date**, and its test fails if
the lead time is dropped.

**One reminder per tenancy per tick, on the oldest month that still needs one** — `focusMonth`'s
rule from the tenant's side of the page, for the same reason. A tenancy three months behind would
otherwise land three emails at once on the person least able to absorb them; running hourly, the
next tick carries the next month.

**It does not nag.** Each reminder goes out **once**, recorded in `remindersSent` on the period
document, and `REMINDER_HORIZON_DAYS` (30) is where the sweep stops having anything useful to say —
a month sixty days late is a decision the two of them have to make, and a product still sending
"recuerda pagar" reads as a machine that has not noticed. A recurring weekly chase is a different
product decision with a different legal weight (Ley 2300 limits the *frequency* of collection
contact, not only its hours) and building it without answering that question would arrive as a
complaint rather than as a bug.

**`remindersSent` lives on the month, and the sweep opens the month to write it.** A period document
only exists once something has happened in that month — a reminder going out is something happening
in it — so the sweep `set`s with a merge, storing the schedule's `amount` and `dueDate`, which is
exactly what `PeriodDoc` keeps them for. It is written **before** anything is sent, like the
interview sweep: a crash between the write and the send costs one reminder, the other order costs
the same reminder every hour until the month is paid.

**Ley 2300 gates the whole sweep, and that is why the cron is hourly.** A message about money
somebody owes is collection contact whichever side of the due date it falls on, and the statute
restricts days and hours for **email** as well as for WhatsApp — `sendWhatsApp` already guards
itself, and the email half has no sender to hide the guard in. So `remindDueCanons` asks
`collectionContactBlocker` first and refuses outright, letting the next tick handle it: on a Sunday
or a public holiday every tick is refused and the reminder leaves Monday morning, which is correct
behaviour rather than a missed run. **A single daily tick is what this must not be** — one deploy
away from landing outside the window, and a holiday would skip the day entirely.

The bell goes quiet with it, and that is a deliberate simplification rather than a reading of the
law: a notification nobody wrote is one the next tick writes an hour later, and splitting the
channels here would put "may we contact this person" in two places.

**No WhatsApp, stated rather than half-built.** `notify()` sends one only when a phone is passed,
and a business-initiated WhatsApp outside the 24-hour window has to be a **Meta-approved template**.
There is one for the interview reminder and none for a canon, so passing a phone here would deliver
the interview's words about a rent payment. It needs `WHATSAPP_CANON_TEMPLATE` approved first.

**Category `reminders`, not `lease`** — the same call the interview reminders make: somebody who
turned off their tenancy emails because they are on top of it still wants the one that says the
canon is due on Thursday.

**`MAX_SCAN` is 400 and it is the same trade `CATALOG_MAX_SCAN` makes.** Firestore cannot answer
"which tenancies have a month falling due": the schedule is derived from `startDate` and `months`,
on purpose, so there is no field to index. It stops being the right shape in the low thousands of
tenancies, and what it wants then is **not a bigger number** — it is a `nextCanonReminderAt` cursor
on the lease, indexed. The set is unbounded for a second reason worth naming: **ending a tenancy is
not built**, so a lease from four years ago is still a document this sweep reads.

**`tests/e2e/canon-reminders.mjs` has two branches on purpose, and that is a real limitation.**
There is no honest way to move the clock — the route sits behind `CRON_SECRET`, and letting whoever
holds it pass an hour would be precisely the way to bypass Ley 2300 — so the driver asks the sweep
what it decided and asserts on that: window open, the full path; window closed, that **nothing** left
(which is the assertion the statute is about). Both are real; the second covers less and says so out
loud instead of pretending the run happened.

## The acta de entrega (`features/lease`, the Entrega tab)

**This is the document that decides who pays for the scratch on the door**, and in Colombia there is
nothing else standing in for it. Ley 820 forbids a cash deposit, so at the end of a tenancy neither
party is holding money the other has to argue back — what they have instead is whatever they wrote
down at the start. Today that is a WhatsApp thread of photos nobody can find, and the argument is
decided by whoever remembers harder.

Two per tenancy at `leases/{leaseId}/handovers/{kind}`, `checkin` and `checkout`, and **the document
id is the kind** — which is what makes two check-ins impossible, the same trick `periods/{YYYY-MM}`
uses on the month.

**The rule the whole thing rests on: an acceptance belongs to the version it accepted.** Every acta
carries a fingerprint of its contents and an acceptance records the fingerprint it was given for.
Change an area, add a photo, move "bien" to "con daños", and the fingerprint moves — so the
acceptance stops applying **by itself, with no cleanup**, and the acta is waiting on the tenant
again. That is `documentHash` on the contract signature and `verdictApplies` on a receipt for the
third time in this product, and it is the same reason each time: a record that can be changed after
it was agreed to is not evidence, it is a claim. `handover.test.ts` asserts it by editing an accepted
acta, and it goes red if `acceptanceApplies` stops comparing.

**The fingerprint is computed on the server and never accepted from the client.** That is the one
line the guarantee rests on, and it is why `firestore.rules` denies every client write on this
subcollection: a client that could send its own fingerprint could accept one version while the
acceptance stayed pinned to another. The pure half — `handoverFingerprint`, a canonical string — is
in the domain and unit-tested field by field, because a field left out of it is a field somebody can
change after the acta was accepted without the acceptance noticing. The sha256 the action wraps it
in is only there to keep the stored value short; this is change detection, not authentication.

**The landlord writes and the tenant answers, and the asymmetry is not arbitrary.** It is the
landlord's property being handed over and they are the party who has to be able to say what state it
was in; a record about the home somebody lives in that they cannot contradict is not a record but an
assertion. The tenant's protection is not drafting — it is that **an objection goes on the record
permanently** and the acta cannot reach `accepted` without them. `availableHandoverActions` returns a
list and both the screen and the action read it, the rule an errand's `availableActions` already
states: a control the server would refuse is a lie.

**Revising an accepted acta is allowed and costs the acceptance.** Forbidding the edit would be
worse: a landlord who spots a mistake in an agreed record and cannot fix it writes the correction
somewhere this product cannot see. The objection also **stays visible when it is stale**, saying so —
hiding it once the landlord revised would erase half of what the acta is for, which is the record
that the two of them disagreed and about what.

**It does not decide who pays.** Ley 820 puts habitability repairs on the landlord and tenant-caused
damage on the tenant, and which of those a cracked tile is depends on facts this product does not
have. The same call the incidents already make by keeping the disagreement instead of settling it.

**It is not a signature, and that is a decision rather than an oversight.** `acceptedAt` with an ip
and a user agent bound to a fingerprint is the evidence shape `acceptedClauseAt` and
`checksAuthorizedAt` already use. The full apparatus — a one-time code to a verified channel, a drawn
stroke, a stamped PDF — exists in `features/application` for the contract, which creates obligations.
An acta records a state. The pieces are there if a lawyer wants it upgraded.

**The check-out is gated on the check-in having been *submitted*, not accepted.** A checkout is a
comparison, so there has to be something to compare against; requiring acceptance would let a tenant
who never answers block the landlord from ever closing the tenancy, which is a hostage this product
must not create. The gate is stated on screen rather than by hiding the section — a landlord looking
for the devolución would otherwise conclude the product has none.

**Images only, one 8 MB limit, no video** — the opposite call to the incidents, and for a stated
reason. A video is the point of an incident (a leak that only leaks when the tap runs); the value of
an acta is that the checkout photo goes beside the check-in photo of the same wall, and two videos of
a wall compare worse than two pictures of it.

**`usePickedFiles` was extracted from `incident-list.tsx`, not copied.** What is in it is not
boilerplate: the `blob:` URLs are revoked **only on unmount** (the first version revoked the first
file's preview when a second was added, and no driver saw it because a driver picks both at once),
and the files are **held, not uploaded on pick**, because these buckets deny `delete` to every client.
The four things that differ per form — ceiling, judgement, folder, wording — are arguments.

**One registry per editor, in a ref.** The first version of the editor kept the area→uploader `Map`
at module scope, which is a bug with two names: the check-in and the check-out editors can be open on
the same page, so one acta's save would upload the other's photos. And the child registers in an
**effect**, never during render — the first version called it in the body, which happens to work and
is exactly what React's rules forbid.

**The condition chips needed a focus ring, and Playwright found it.** The radio is `sr-only` so the
whole chip is the control — accessible and keyboard-navigable, except that the focus indicator would
be drawn by an input that occupies no space. Somebody navigating by keyboard could change a room's
condition without seeing which one they were on. It surfaced because Playwright refuses to click a
hidden input, which is the same refusal a screen reader user would have experienced silently.

**Four tabs now, and `Entrega` is genuinely a fourth subject**: the term is the agreement, the months
are the money, an incident is something that broke *during* the tenancy, and the acta is the state of
the property at the two moments that bracket it. Its rail badge is a **dot, not a count** — there are
only ever two actas, so "1" beside "Entrega" is a number that informs nobody — and it carries its own
`sr-only` text, because a colour is not a message to somebody who cannot see it.

**Una regla probada no es una regla desplegada, y esto costó una subida rota en producción.** Las
fotos del acta necesitan `handovers/{userId}/**` en `storage.rules`; el emulador carga el fichero
local, así que `pnpm test:rules` y los 51 drivers pasaron en verde con la regla **sin desplegar** y
lo primero que dijo lo contrario fue "No tienes permiso para subir este archivo" en la pantalla de
una persona. Es la misma forma exacta que el hueco de los índices compuestos: la barra entera
comprueba que la regla es correcta y ninguna comprobación mira si está en el proyecto.

**Una regla nueva —de Firestore o de Storage— es `firebase deploy --only firestore:rules,storage` en
el mismo cambio.** Storage es la mitad que se olvida, porque `firestore.rules` sale nombrado en todas
partes y la de Storage solo cuando algo sube un archivo.

**`tests/e2e/handover.mjs` covers what nothing else can**: that the photos reach the bucket (the
upload is done by the browser's web SDK, which neither `build` nor a unit test touches), that editing
after acceptance drops the acceptance, that each party sees only its own controls, and that the bell
lands on `#entrega-checkin`. **The photos do not render in the emulated suite** and that is the
design working: there is no service account, so no URL can be signed — and the record comes from the
document while only the link comes from the signature, so the areas, the conditions and the objection
all still render. It is the same property the contract panel already pays for.

## El recibo de pago y el paz y salvo (`features/lease`, `/api/arriendos/<id>/…`)

Los dos documentos que la tenencia produce sola. Ninguno se sube y ninguno se firma: los dos se
**derivan enteros de lo que el propietario ya confirmó**, y esa es la decisión de la que cuelga todo
lo demás.

**El inquilino los puede emitir él mismo, y ese es el punto.** Un paz y salvo normalmente lo expide
el acreedor — lo que significa que también es un documento que el acreedor puede **retener**, y un
inquilino sin nada que mostrarle al siguiente propietario no tiene defensa contra eso. Aquí cada mes
que lista es una confirmación que el propietario ya hizo, así que el certificado no afirma nada
nuevo: repite lo que él ya dijo, y se lo puede decir a quien pregunte.

**Por eso la redacción está en el código y no en una plantilla.** Ninguno de los dos dice *el
propietario certifica*; dicen **según el registro de esta plataforma, el propietario confirmó haber
recibido** — que es cierto, comprobable contra la pantalla que las dos partes leen, y no una
afirmación que este producto esté en posición de hacer en nombre de nadie.

**El recibo es una obligación, no una cortesía.** Ley 820 de 2003 pone en el arrendador dar al
arrendatario un comprobante escrito con la fecha, el valor y el periodo que cubre el pago; en la
práctica eso es un "listo, recibido" por WhatsApp que no sobrevive a un desacuerdo. **La página
enuncia el fondo y no cita ningún artículo**: el numeral merece la lectura de un abogado antes de
que este producto lo imprima.

**Solo un mes confirmado tiene recibo.** Un recibo certifica que el dinero **llegó**, y eso solo lo
puede decir la persona cuya cuenta es — un mes con el comprobante subido y sin veredicto se ve
pagado desde el lado del inquilino y no lo está. `receiptBlocker` lo niega en el endpoint y no solo
en la pantalla: un guardia de página protege una pantalla, no una URL que alguien teclea.

**El paz y salvo se niega con tres motivos distintos**, no con un "no": mora es plata que transferir,
`in_review` es un propietario a quien perseguir, y una tenencia sin nada confirmado no tiene qué
certificar. Un mes **que todavía no vence no lo bloquea** — dice *al día a la fecha* y nunca *el
contrato terminó*, porque bajo Ley 820 el arriendo se prorroga quiera alguien o no, y afirmar lo
segundo sería decir algo que la ley niega. `leaseTermState` se niega igual un nivel más arriba.

**Nada se guarda.** Los dos se generan al pedirlos, así que una copia almacenada sería una segunda
fuente de verdad que un veredicto corregido dejaría vieja — la misma razón por la que `leaseSummary`
cuenta los periodos en vez de mantener contadores. Cuesta una lectura de Firestore y una página de
texto.

**"Referencia" y nunca "número".** Un recibo numerado insinúa numeración DIAN, que es otro régimen
con su propia autorización y sus propias consecuencias por equivocarse. Se deriva del id y del
periodo, así que el mismo mes da siempre la misma y no hay contador que mantener — y toma los
**últimos** seis caracteres del id, porque los ids legibles llevan prefijo y cortando por delante
todas las tenencias de una corrida compartirían referencia.

**Ni la cuenta de pago ni la calle.** La primera por la regla que ya siguen los avisos: un documento
que circula con el número de cuenta de alguien dentro es la forma de toda estafa de pagos. La segunda
porque `features/lease` no puede leerla —vive en `properties/{id}/private/location`— y esa restricción
resulta ser la respuesta correcta de todas formas: un paz y salvo se le enseña a un desconocido.

**`shared/pdf/text.ts` salió de `features/application`** cuando llegó el segundo consumidor. "Lo que
una fuente estándar de PDF puede dibujar" no es un hecho sobre una postulación, y la alternativa era
que `features/lease` entrara en las interioridades de otro módulo, que es justo lo que eslint impide.

**Tres defectos que solo se vieron leyendo el papel**, y ninguna comprobación de la barra podía:

- **Escribí el español sin tildes "por si acaso"**, que es exactamente la superstición que
  `drawableText` existe para no necesitar: WinAnsi **sí** codifica los acentos del español y
  `shared/pdf/text.test.ts` lo fija contra `pdf-lib`. Lo que no codifica es un emoji, y de eso se
  ocupa la función.
- **Dos formatos de fecha, uno debajo del otro**: "4 de mayo de 2026" y "5 de **may** de 2026", por
  mezclar `formatLongDate` con `formatBogotaDateTime`. El mes abreviado se lee como un fallo en un
  papel que alguien archiva.
- **La referencia cortaba por el principio del id**, así que todas las tenencias de una corrida
  compartían los seis caracteres.

**`tests/e2e/certificates.mjs` mira dentro del PDF, y esa es la única aserción que sirve.** `pdf-lib`
produce un archivo perfectamente válido y **completamente vacío** si algo se dibuja fuera de la
página, así que comprobar el `content-type` y el tamaño pasa sobre una hoja en blanco. El driver
descomprime los flujos con `zlib` y **decodifica los literales hexadecimales** —`<6D6961…> Tj`, que
es como `pdf-lib` escribe una cadena— antes de buscar el valor, los nombres y la referencia. Sin ese
segundo paso el texto no aparece por ninguna parte.

Y `pdf.save()` **revienta desde la línea que escribe el fichero** con un emoji en el título del
inmueble: el driver siembra uno a propósito, y quitar `drawableText` deja la ruta en 500.

## Propietario verificado (`features/property`, `/verificaciones`)

**La respuesta a la única objeción que impide arrendar directo: "¿y si me estafan?"** La estafa es
siempre la misma forma — un inmueble que alguien no es suyo, una "reserva" o un primer mes, y un
teléfono que deja de contestar. La mitad ya la niega este producto por no mover la plata; la otra
mitad es que el inquilino no tiene forma de saber con quién habla.

**La insignia afirma exactamente una cosa**: una persona leyó el certificado de tradición y libertad
de la matrícula de ese inmueble y la cuenta que lo publica figura en él como propietaria. Nada sobre
el estado del inmueble, nada sobre el carácter de nadie y ninguna garantía sobre el arriendo. Una
insignia que dijera "Verificado" sin decir **qué** se verificó significa lo que cada lector quiera, y
el día que una de esas tenencias salga mal el producto responde por una promesa que nunca hizo en voz
alta — la misma disciplina con la que la landing se niega a poner "ahorra hasta un 30%".

Por eso, **en la ficha del inmueble la frase que la acota está a la vista y no detrás de un hover**.
Este producto ya escribió esa regla para la entrada deshabilitada del menú, y aquí pesa más: la frase
es la parte que impide que la insignia se estire. En una tarjeta del catálogo no hay sitio, así que
ahí la afirmación completa viaja como nombre accesible y el trabajo de la tarjeta es llevar a la
página donde está escrita.

**Es manual, y eso no es un parche.** La SNR no tiene API abierta para esto y el certificado es un
documento de pago que se saca de a uno; `domain/property.ts` ya lo dice de la matrícula: *"the only
real check is against the registry, which this product does not do"*. Así que lo lee una persona, y
la insignia dice "revisamos" y no "el sistema verificó".

**Dos mitades y cada una donde le toca.** La evidencia —el certificado, la nota del revisor— es lo
más sensible que este producto guarda sobre un inmueble: un certificado de tradición lleva la
dirección completa y la identidad del dueño, que es exactamente por lo que la matrícula es privada.
Vive en `properties/{id}/private/verification`, al lado de la dirección. El **resultado** es una sola
marca de tiempo en el documento público, y **solo la positiva**.

**Un rechazo no se publica nunca.** Queda entre el propietario y quien revisó: publicar "verificación
rechazada" sería una marca sobre una persona que este producto no puede justificar — un certificado
puede estar vencido, puede faltarle un copropietario, y nada de eso es un hallazgo sobre nadie. El
**motivo sí le llega al propietario**, porque "el certificado tiene cuatro meses" y "el certificado
nombra a otra persona" son dos cosas distintas que hacer después; un rechazo sin motivo es un muro, y
`verificationVerdictSchema` lo exige para rechazar y lo rechaza para aprobar.

**`ownershipVerifiedAt` está congelado en `firestore.rules`, y ahí está toda la garantía.** El dueño
**sí** puede editar su propio anuncio desde el cliente —para eso está esa rama de la regla— y el
documento no tiene `hasOnly` sobre sus claves: sin nombrar ese campo en `unchanged([...])`, quien
publica podría escribirse la insignia y publicar "Propietario verificado" sobre un inmueble que nadie
revisó. **La única afirmación que el lector no puede comprobar sería justo la que su interesado puede
falsificar.** Solo el Admin SDK la escribe, desde `decideVerification`.

**Cambiar la matrícula tumba la insignia sola.** Una aprobación dice que esta cuenta figura como
propietaria del inmueble detrás de *ese* número; cambiado el número, la frase habla de otro inmueble.
`updateProperty` retira el campo público y `verificationState` devuelve `stale` en cuanto los dos
números dejan de coincidir — la misma atadura que el `documentHash` de la firma y la huella del acta,
por tercera vez, y con la misma propiedad: no hay nada que limpiar a mano. La comparación es floja a
propósito (`sameRegistry`): `050-123456` y `50 123456` son el mismo inmueble, y perder la insignia por
un guion al reescribir la dirección sería absurdo.

**El panel del propietario vive en la pantalla de edición**, no en una propia: la matrícula que se
revisa se escribe en ese mismo formulario y editarla es lo que tumba la insignia, así que poner las
dos cosas a la vista es lo que hace que la consecuencia se entienda.

**`/verificaciones` es la única pantalla de administración del producto**, y está fuera de `(app)`
porque no es una sección del portal de nadie: `requireRole("admin")` la cierra entera, y ofrecerla en
el menú anunciaría un sitio al que dos de los tres roles no pueden entrar — el mismo motivo por el que
`/colaborador` vive fuera del portal. La cola se arma desde los anuncios publicados con un `get` por
expediente: un `collectionGroup` sobre `private` barrería todas las direcciones del producto para
encontrar unos pocos documentos. Deja de ser la forma correcta a unos cientos de anuncios, y lo que
querrá entonces es una marca en el documento público con su índice, no un número mayor.

### Dos trampas que costaron el driver

**El claim de rol se pone DESPUÉS del onboarding.** `openSession` completa el perfil, y completar el
perfil es lo que escribe el rol como custom claim — así que un `admin` puesto antes lo pisa el propio
registro. Y después hay que **volver a emitir la cookie** con un idToken recién firmado, porque el rol
viaja dentro de ella: es la trampa que `CLAUDE.md` ya documenta como *"after `setCustomUserClaims`,
re-mint the session cookie"*, pagada otra vez.

**Un test de reglas puede pasar por el motivo equivocado.** La primera versión del caso "el
propietario no puede escribirse la insignia" esparcía el documento entero en el `updateDoc`, lo que
cambiaba `createdAt` — así que la escritura se negaba por *otra* razón y el test seguía verde con el
campo desprotegido. Se descubrió quitando `ownershipVerifiedAt` de la lista congelada y viendo que no
pasaba nada. Es un `updateDoc` de un solo campo ahora.

**Y la cola de revisión es compartida.** El driver espera a que **su** fila desaparezca, no a que la
cola quede vacía: cualquier corrida anterior que muriera antes de su limpieza deja la suya esperando,
y "no hay solicitudes" sería una afirmación sobre el emulador y no sobre lo que el driver acaba de
hacer. Misma lección que `facets` con el catálogo.

**No verificado en navegador:** abrir el certificado desde la cola. El enlace lo firma el servidor y
la suite emulada no tiene cuenta de servicio, así que la fila muestra "no se pudo abrir ahora mismo"
— que es el diseño funcionando (el registro sale del documento, solo el enlace sale de la firma), pero
deja ese clic sin conducir.

## Recovering a password (`features/auth`)

Two screens: `/recuperar` asks for the address, `/recuperar/confirmar` takes the code and sets the
password. The email goes out **through Resend from this product's own verified domain**, not from
Firebase's default template — a message about getting back into your account arriving from
`noreply@<project>.firebaseapp.com` reads as phishing, which is the same reason the notification
emails are sent the way they are.

**The screen never says whether the account exists**, and that is the whole security design. It
answers *"si existe una cuenta con ese correo, te enviamos un enlace"* to every address — unknown,
throttled, Google-only, or a Resend failure — because anything more definite turns the form into an
account-enumeration oracle. It is the same rule `shared/auth/errors.ts` already enforces on the
login, where invalid credentials and unknown user deliberately share one message, and keeping it
there while giving it away here would have been pointless. `requestPasswordReset` returns the same
value on every branch and never throws, so timing and errors do not leak it either.
`tests/e2e/password-reset.mjs` asserts the two confirmations are **identical word for word** rather
than looking for a phrase — a property of two runs compared against each other, which no unit test
can express — and it was proved by making the form reveal the answer on purpose and watching it go
red.

**Three requests per address per fifteen minutes** (`resetThrottle`, pure and unit-tested). The
endpoint emails an address the caller chooses, which is two abuses at once: filling somebody's inbox,
and burning the Resend quota — **100 a day** on the free tier, already exhausted once by a driver run.
The window is fixed rather than sliding (a sliding one needs every timestamp, so the document grows
with the abuse it exists to stop) and **a refused attempt still counts**, or hammering it would let
the window lapse while the requests kept landing.

**The counter lives in `passwordResetRequests/{sha256(email)}` and no rule declares it** — the
explicit closure at the end of `firestore.rules` is what denies every client, exactly as with
`signatureChallenges`, and a rules test pins that so nobody declares it higher up by accident. The
document id is a **hash**: a doc id is not data you can hide (console, exports, log lines), so a
collection keyed by plaintext email would be a readable list of everyone who ever forgot their
password. Unsalted on purpose — a stable salt is one constant, which buys nothing against somebody
who has both it and a list of addresses; what it defends against is casual exposure.

**The code is verified before the form is shown, not on submit.** `oobCode` is single-use and lasts
an hour, and both ways of arriving with a dead one are ordinary — the link sat overnight, or it was
already used. Finding out *after* typing a password is the version that makes people give up.
`verifyPasswordResetCode` also returns the address, which is what lets the screen say whose account
is being changed. Every reason a code is bad shares **one message**: Firebase distinguishes expired
from already-used, and "ya se usó" tells whoever holds a leaked link that it worked for somebody.

**`signupSchema` is reused for the new password**, never a second schema — a reset screen that
accepted a weaker password than signup would be a way around the rules.

**The exchange happens in the browser.** `oobCode` is a credential, and handing it to a Server Action
would put it in the request log of every hop; the web SDK talks to Firebase directly. The initial
"no code in the URL" state is **derived at first render, not set in an effect** — the React compiler
refuses a synchronous `setState` in an effect body, the same rule `LeaseTabs` pays for with its
`requestAnimationFrame`.

**The driver reads the code from the Auth emulator**, not from the dev log: unlike the signature OTP
the link is in the body rather than the subject, so `sendEmail`'s log line does not carry it.
`GET /emulator/v1/projects/{id}/oobCodes` is what the emulator exposes for this. And the assertion
that matters is the last one — **signing in with the new password, and the old one no longer
working**: everything else can be right and still leave the account on the old password.

**`url` in `generatePasswordResetLink` is the *continue* URL, not where the emailed link points.**
Where the link points is the **action URL** in the Firebase console. This pointed at
`/recuperar/confirmar` and it was a real bug reported from the screen: the reset completed on
Firebase's page, Firebase forwarded to the confirm screen with no `oobCode`, and that screen — whose
whole job is to consume a code — answered *"este enlace está incompleto"* about a password that had
just been changed successfully. It is `LOGIN_ROUTE` now, and `password-reset.mjs` asserts the
continue URL is not the confirm screen; the assertion was proved by putting the bug back.

**And reaching `/recuperar/confirmar` with no code is not an error.** The likeliest way to get there
is having just finished on Firebase's page, so `missing` and `rejected` are separate states: a dead
link says so and offers a new one, a missing code says *"aquí no hay nada que cambiar"* and offers to
sign in.

**Firebase's own copy is in Spanish because `notification.defaultLocale` says so.** It was `"en"`,
which is what rendered *"Password changed — you can now sign in with your new password"* on Google's
hosted action page. It also drove Firebase's **email templates**, and those matter for the one email
this product does not send itself: `sendEmailVerification` at signup was going out in English.
Setting the locale to `es` fixed both at once and the templates flipped to Spanish on their own,
which is how you can tell nobody had customised them. It is one field in the Identity Platform
config (`admin/v2/projects/{id}/config`, `updateMask=notification.defaultLocale`), not a code change.

**`notification.sendEmail.callbackUri` is where Firebase's emailed links point, and it is one global
setting for every action type.** `EMAIL_ACTION_ROUTE` (`/cuenta/accion`) exists because of that: it
owns `resetPassword` and forwards every other mode to Google's handler with the query untouched.
Pointing the setting straight at `/recuperar/confirmar` — the obvious move — would have answered
"este enlace no sirve" to every new account confirming its address, because `sendEmailVerification`
runs at signup. **Deploy the route before flipping the setting**: until it is live, that URL is a
404, and a 404 on every reset link is worse than Google's page.

**A password reset revokes the refresh tokens, which kills every open `onSnapshot`.** The backend
answers `permission-denied`, and that is the session ending rather than a rule denying anything —
the identical failure `isSigningOut()` already covers for sign-out, which that flag cannot see here
because the session can die in another tab or on another device. `shared/auth/subscription-error.ts`
(`reportOrRecover`) is the general answer, shared by the bell and `useLiveRefresh`: on a
`permission-denied` it asks the credential to renew itself — a revoked one cannot — and on failure
refreshes the route so the server guard, which verifies with `checkRevoked`, sends the person to the
login instead of leaving them on a portal that stopped being theirs. Only `permission-denied` pays
for that network call; `failed-precondition` is a missing index and must still be reported as-is.

**And asking whether the credential is alive is not enough on its own.** The first version of
`reportOrRecover` did only that, and the bug came back from production in a new shape: reset the
password, sign in again, and the bell logs `permission-denied` while the new session is perfectly
healthy. A subscription is created **once** — the effect's deps are `[router]` — so the listener
that was denied belongs to the token that had just been revoked, while `credentialRevoked()` answers
about the new one and says everything is fine. It was the right question about the wrong credential.
So a healthy credential now **rebuilds the subscription once** before anything is reported, which
also fixes a second thing nobody had noticed: a denied bell used to stay dead until the page was
reloaded, because nothing ever tried again. The one-retry guard lives in each caller, not in the
helper — the helper cannot know how many times it has been called.

**The emulator cannot test that, and the driver says so instead of pretending.** Verified by hand:
after `accounts:resetPassword` the Auth emulator still accepts the previous idToken with a 200, so
the denial never happens locally. An assertion was written, confirmed to stay green with the fix
disabled, and removed — a test that cannot fail is worse than none, because it reads as coverage.
Same shape as the composite-index gap.

**Not built:** changing a password from inside an account (it should ask for the current one), and
`/recuperar` deliberately redirects a signed-in visitor to the portal rather than pretending to be
that flow — which is also why the driver requests the second reset from a sessionless context.

## Encargos y el colaborador (`features/collaboration`)

Un colaborador es una **figura esporádica**: alguien que muestra un apartamento el jueves y no
vuelve a aparecer en un mes. Todo el diseño sale de ahí.

**Entra con un código de un solo uso a su teléfono, nunca con contraseña** — y explícitamente no con
el número de teléfono como su propia contraseña, que fue lo primero que se pidió. Un número no es un
secreto: está en WhatsApp, en una tarjeta y en doce chats reenviados, así que eso habría dejado los
encargos —con direcciones, horas y nombres de terceros— legibles para cualquiera que lo supiera, que
además es dato personal bajo la Ley 1581. Lo que lo reemplaza no le cuesta nada de más: el código
llega por el mismo canal que el encargo y no hay nada que recordar entre un trabajo y el siguiente.
La mecánica es la de la firma del contrato a propósito —seis dígitos, cinco intentos, diez minutos,
salado y hasheado, nunca en claro—: una segunda implementación de OTP más débil en el mismo producto
sería la que alguien ataca.

**Es un usuario de Firebase de verdad**, creado desde el número, sin correo, sin contraseña y sin
perfil. No por capricho: las reglas hablan `request.auth.uid`, y una segunda noción de identidad al
lado obligaría a escribir cada regla dos veces. Lo que cambia no es el mecanismo sino la superficie —
vive entero fuera de `(app)`, en `/colaborador`, donde `requireCompleteProfile()` lo rebotaría para
siempre porque no tiene perfil que completar.

**Ahí murió el bloqueo `no_account`.** Invitar exigía que el colaborador ya tuviera cuenta, buscada
por correo: para un esporádico eso significaba registrarse, verificar una dirección y completar un
perfil antes de que le pudieran pedir abrir una puerta una vez. Ahora el propietario escribe nombre y
número y la cuenta se crea sola. `collaboratorPhones/{e164}` es la reserva que hace único y
resoluble el número en un solo `get`, igual que `propertySlugs/{slug}` con la URL de un anuncio.

**El nombre, el teléfono, el título y la zona van copiados en el encargo**, no leídos del documento
del colaborador ni del inmueble. Es la instantánea del dossier dentro de una postulación otra vez: el
propietario no puede leer `collaborators/{uid}` —ese documento es del colaborador y de nadie más— y
un anuncio editado o borrado después no puede vaciar un encargo ya hecho.

**El estado se deriva de las marcas de tiempo, no se guarda.** `errandState` lee `cancelledAt →
completedAt → declinedAt → acceptedAt`, y **el orden es toda la regla**: cancelar gana sobre todo
porque el propietario que lo llama atrás lo termina pase lo que pase, y terminar gana sobre aceptar
porque terminar implica haberlo tomado. Un `status` guardado sería una segunda fuente de verdad, y el
día que una escritura entre dos veces el campo y la historia se contradicen sin manera de saber cuál
miente — la misma decisión que toma `incidentState()`.

**`availableActions` es una lista, y la usan la pantalla y la acción.** Ese es el motivo de que
devuelva una lista en vez de que cada lado decida: un control que el servidor rechazaría es una
mentira, y dos copias de "¿cuándo se puede aceptar esto?" son dos cosas que se separan. **Rechazar
desaparece una vez aceptado**: echarse atrás de algo confirmado es una conversación, no un botón — el
propietario dejó de buscar a otra persona por esa confirmación.

**Los dos canales, no uno con el otro de respaldo.** SMS y WhatsApp salen a la vez por Twilio: quien
tiene WhatsApp silenciado recibe el SMS, y a quien la operadora le come el SMS le llega el WhatsApp.
`errandMessage` es una sola función porque un SMS y un WhatsApp que describen el mismo encargo
distinto es el error que nadie ve —nadie recibe los dos y los compara— y lleva **qué, dónde y
cuándo, nunca quién es el inquilino**: un mensaje se lee en la pantalla bloqueada.

**Dos senders de WhatsApp conviven a propósito.** `send-whatsapp.ts` es Meta y lo usan los
recordatorios de entrevista y el código de firma, posiblemente contra plantillas ya aprobadas allí;
`send-whatsapp-twilio.ts` es el de esta cuenta. Cambiarle el proveedor a los otros por debajo es un
cambio aparte con su propia forma de fallar en silencio. **Y una regla que no depende del proveedor**:
fuera de la ventana de 24 horas que abre el mensaje de la persona, WhatsApp solo entrega **plantillas
aprobadas** — es regla de WhatsApp, no de Twilio. Sin `TWILIO_WHATSAPP_TEMPLATE_SID` se manda texto
libre, que sirve para el sandbox y no para producción, y el módulo lo dice en el log en vez de
aparentar que funcionó.

**Los dos índices compuestos están en `firestore.indexes.json` y `errand-indexes.test.ts` los fija.**
Es copia deliberada del guardia del arriendo, porque el emulador **no aplica índices**: uno que falte
pasa `pnpm verify`, `pnpm build`, `pnpm test:rules` y todos los drivers, y lo primero que dice lo
contrario es un `9 FAILED_PRECONDITION` en producción.

**El propietario ve y gestiona lo que repartió, en `/encargos` dentro del portal.** Esa mitad faltó
en la primera versión: `listErrandsForLandlord` existía y ninguna pantalla la usaba, así que un
encargo aceptado y uno ignorado se veían igual desde ese lado. La tarjeta lleva el motivo de un
rechazo **en la lista, no detrás de un clic** —es con lo que se decide qué hacer ahora— y el teléfono
del colaborador como `tel:`, porque cuando algo se tuerce lo que se hace es llamar.

**"Encargos" es la única entrada condicional del menú, y la condición es tener inmuebles
publicados** (`hasProperties`: un documento con `select()`). Encargar es una acción *sobre* un
inmueble, así que quien no tiene ninguno no tiene nada que delegar y a un inquilino le sobra del
todo. **No es un custom claim** a propósito — un claim puesto después es un claim que la cookie de
sesión no lleva, haría falta `PATCH /api/session`, y olvidarlo se ve como un menú que sigue mal hasta
cerrar sesión; además no sobreviviría a publicar el primer inmueble, que es justo cuando la entrada
tiene que aparecer. El driver comprueba **las dos caras**: sin inmuebles no está, con uno sí. Por
separado, la primera pasaría con la entrada borrada y la segunda con la entrada siempre visible.

**Las tres transiciones avisan al propietario**, y esto también faltaba: escribían la marca de
tiempo y no notificaban a nadie. Son tres tipos (`errand_accepted`, `errand_declined`,
`errand_completed`) y no un `errand_updated` con el resultado dentro, por la razón de siempre: la
copia es el punto. "Confirmó que va" es una preocupación menos, "no puede" es una tarea urgente y "ya
lo hizo" es un cierre. **El motivo del rechazo viaja dentro del aviso**, no solo en la pantalla — es
lo único con lo que el propietario decide qué hacer, y obligarle a abrir la app para leerlo convierte
el aviso en un recado. Viajan por `collaboration` y no por `applicationId`, como los cuatro tipos que
ya existían sin proceso detrás.

**El modelo viejo se retiró entero**, y esto es lo que ya no existe: `/encargos` y `/encargos/<id>`,
`/colaboradores`, las entradas "Encargos" y "Colaboradores" del menú, la colección `collaborations`
con sus capacidades e invitaciones, `inviteCollaborator` / `acceptCollaboration` /
`declineCollaboration` / `revokeCollaboration`, `CollaboratorRoster`, `InvitationCard`, la proyección
`VisitErrand` con su `ErrandPanel`, y el driver `collaborators.mjs`.

Se fue porque **exigía que el colaborador estuviera registrado**: para alguien a quien le pides abrir
una puerta una vez al mes, eso era registrarse, verificar un correo y completar un perfil antes de
servir de algo. `inviteCollaborator` lo decía en voz alta con el bloqueo `no_account`.

Tres consecuencias que valen la pena tener escritas:

- **`proposeVisit` perdió su segunda entrada.** Un colaborador llegaba a proponer el día de la visita
  a través de un encargo que le daba `show_property` sobre el inmueble; ahora no es parte del proceso
  y no puede moverlo. Mostrar sigue siendo delegable —es un encargo de tipo `showing`— pero el
  encargo es un trabajo con su propio aceptar/rechazar/terminar, no un asiento en el proceso.
- **Los cuatro tipos de notificación `collaborator_*` siguen en la unión, sin emisor.** Es la misma
  decisión que `canon_confirmed`: hay notificaciones guardadas con esos tipos, y un tipo que el
  `switch` no cubre es una campana con el cuerpo vacío. Lo que cambió es a dónde llevan, porque las
  dos pantallas que apuntaban ya no existen y una campana que abre un 404 es peor que una que abre
  el inicio.
- **La regla de `collaborations` no se reemplazó por una más laxa: se borró.** Sin `match`, la
  clausura explícita del final deniega la colección entera, que es más estricto que lo que había.
  `deleteAccount` la sigue barriendo, así que una solicitud de supresión se honra sobre datos que
  este producto ya no usa.

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
- **Signing out denies every open subscription, and that is not a bug to fix in the rules.**
  `signOutUser()` revokes the refresh tokens through `DELETE /api/session` **before** `signOut(auth)`
  drops the SDK's credential, and that order is deliberate: the cookie is the authoritative session,
  so it dies first — reversed, a failed `DELETE` after a successful `signOut(auth)` would leave the
  server thinking the person was still signed in and the next load would rebuild the client session
  from a cookie nobody cleared. The cost is a window in which every attached `onSnapshot` — the bell,
  the process page, the tenancy page — is answered `permission-denied` by a backend that has just
  been told the token is void. `isSigningOut()` (`shared/auth/client.ts`) is what both error handlers
  check so it is not reported. A module-level flag and **not** `onAuthStateChanged`, because the
  ordering is the whole problem: `auth.currentUser` is still set at the moment of the denial, so
  asking the SDK cannot tell this apart from a real denial. It is cleared when a session is next
  established, or a genuine denial after signing back in would be swallowed for the tab's lifetime.
  The cost of not doing this was measured: the log sent a diagnosis through the deployed ruleset, the
  composite indexes and the shape of seventy production documents before landing on "somebody pressed
  Cerrar sesión". `tests/e2e/signout.mjs` pins it, and it had to be **taught to fail first** — it
  signed out from `/registro/completar-perfil`, which uses `requireUser()` and carries no bell, so
  there was no subscription to deny; and its `finally` printed console problems without ever throwing.
- **`networkidle` no longer happens.** A Firestore subscription keeps a connection open, so any
  test or script waiting for the network to go quiet waits forever. Wait for `domcontentloaded`
  and then for the thing you actually mean.

## Client-safe module entries

A feature's `index.ts` re-exports its data layer, which is `server-only`. A Client Component
that imports it fails the build — the guard working as intended — so a module whose UI needs its
own domain also exposes **`client.ts`**: the pure half. `@/features/<domain>/client` is a public
entry, allowed by eslint and dependency-cruiser alongside the index; anything deeper is still a
violation.

## Ajustes (`/ajustes`)

Three tabs — **Perfil · Notificaciones · Seguridad** — and the interesting part is the two the
reference design asked for that are **not** here.

**Perfil is not a second `/perfil-inquilino`, and the split is by who has each thing.** The tenant
dossier — document number, income, the reference — is filled in by somebody applying, and a landlord
can walk the whole product without ever having one. The account details are what *both* have,
because they are what the platform shows one party to the other, so that is what lives here. Both
screens are the same `AccountFields` over the same `updateProfile` against the same `users/{uid}`:
correcting a phone in either shows up in the other because there are not two copies, there is one
document with two doors. `updateProfile` revalidates both paths.

**No avatar.** The reference's "haz clic en el avatar para subir una foto" is a capability this
product does not have — no bucket path, no rules, and nowhere it would be shown — so the card
renders initials and says nothing about clicking. A circle that invites a click and does nothing is
the "Continuar" that does not continue.

### The notification preferences, and the one thing they cannot switch off

`users/{uid}/settings/notifications`, four categories × two channels, and **the bell is not one of
them**. What `notify()` writes to `notifications/{id}` is the record *inside* the product — what the
process page reads, what wakes the other party's live subscription, what is still there three days
later. A preference that could skip it would not silence a notification, it would delete a fact, and
leave the two parties looking at different pages of the same negotiation. So what is switchable is
what *leaves*: the email and the WhatsApp. The screen says so in a sentence above the table, because
otherwise somebody hunts for that switch before concluding the screen is unfinished.

The categories are `process` / `lease` / `reminders` / `errands`, and `categoryOf` is a **complete
`Record<NotificationType, …>` rather than a `switch` with a `default`**: a type added to
`NOTIFICATION_TYPES` without deciding what it is about now fails `pnpm typecheck`, instead of
silently answering "process" for ever. `reminders` is its own category because of what it asks —
somebody who turned off their process emails because they are already on top of it still wants the
one that arrives ten minutes before a call.

**WhatsApp is only offered where `notify()` actually sends it**, which today is the interview
reminders alone (passing a phone is what says "this one also goes out over WhatsApp"; the errand
messages go out through Twilio from their own module, not through here). In the other three rows the
cell is a `—`, not a switch that is off: a control that does nothing is worse than one that is
absent — the same rule the signature's WhatsApp channel already follows.

**`allowsChannel` fails towards delivering.** `readNotificationPreferences` answers `null` when it
could not read, which is *not* the same as an absent document (that one is a known decision: nobody
has touched the screen, so everything is on). Leaving somebody without the email that says their
document was rejected because Firestore had a bad second is a worse failure than sending one they
had switched off — and the bell is written either way, before the preference is even read.

**No client writes that document, and the reason is integrity rather than privacy.** It is what
`notify()` consults before sending, so a client that could write it would not be silencing their own
notifications — they would be silencing **their counterparty's**, who would then find out about a
rejected document only by opening the app. `saveNotificationPreferences` writes under its own
session's uid and takes no uid in the body; the rules deny every client write and a rules test pins
it in both directions.

**The whole table is sent on every change**, not the switch that moved: "Desactivar todo" is then one
write instead of eight, and two tabs open on the same account cannot leave half a decision behind.
It saves itself with no button — a switch with a "Guardar" beside it is a switch half the people
leave unsaved — which is why the header carries a `role="status"` saying it was saved.

### Seguridad

What is real: which providers the account has (`providerData`), whether the email is verified, the
last sign-in, changing the password, and signing out everywhere.

**There is deliberately no list of active sessions.** Firebase exposes none — there is no way to know
what devices hold a session — so the reference's "Dispositivo actual · Activo" row would be a list of
one that really only says "you", wearing the appearance of an inventory nobody keeps. What is true
and useful is the **last sign-in**: one you do not recognise is precisely why somebody opens this
tab, and the button that cuts everything is right below it. A driver assertion pins the absence.

**"Cerrar sesión en todos los dispositivos" is `signOutUser()`**, unchanged: that path already calls
`DELETE /api/session`, which revokes the refresh tokens before clearing the cookie, and revoking is
per account. **It therefore closes this one too, which is honest rather than a side effect** —
Firebase offers no "revoke the others and keep mine", and somebody pressing this usually believes
another person got in, where the right outcome is that no session is left standing.

**Changing the password re-signs in; it does not refresh the cookie.** `PATCH /api/session` was the
obvious reach and it is exactly wrong: it verifies the **old** cookie with `checkRevoked` before
minting the new one, and that cookie is the one the password change just revoked. Chicken and egg,
and it surfaced as "no pudimos completar la operación" over a password that had in fact changed. So
`changePassword` reauthenticates (Firebase requires it, and it is what stops somebody who found an
open session from taking the account), calls `updatePassword`, and then calls **`signInWithEmail`
with the new password** — fresh credentials from scratch, the cookie sealed by the same path every
sign-in uses, and proof that the new password works. Its result has three outcomes, not two:
`reauth` and `failed` changed nothing, while `resignIn` means **the password did change** and only
the session could not be rebuilt — reporting that as a failure would send somebody back to try again
with a current password that no longer exists.

**The wrong-current-password message is not `authErrorMessage`'s.** There, `wrong-password` shares a
message with `user-not-found` so the login cannot enumerate accounts; here there is no account to
guess — it is yours, you are already inside — and "correo o contraseña incorrectos" on a form with no
email field says nothing. It is `"Esa no es tu contraseña actual."`, on the field.

### The two tabs the reference has and this does not

**Apariencia.** `@custom-variant dark` and the dark tokens exist, but **nothing adds `.dark`**, and
the reason is already written down: the purple logo is illegible reversed and there is no reversed
asset. A theme picker would switch on a dark mode no screen in the product has ever been reviewed
in. "Movimiento reducido" and "Modo compacto" are wired to nothing at all. Building it is a feature
of its own — the cookie read on the server, the class, a reversed mark, and a pass over every screen
— not a tab.

**Idioma is built now, and it is two settings rather than one.** See "Two languages" below. What
lives in Ajustes → Perfil is **"Idioma de los correos"**, and only that: the language of the *screen*
is decided by the URL and switched from the header, where somebody actually looks for it. They are
separate because they answer different questions — reading the catalogue in English on a borrowed
laptop is not asking for your rent reminders in English — and the field's `hint` says so, because two
language controls with nothing explaining the difference is the kind of thing somebody sets twice and
still finds broken.

**Not built either:** uploading a profile photo, and a per-notification-type preference (four
categories is what somebody actually decides; forty-six switches is a spreadsheet).

## Two languages, and the prefix only English pays for

The product speaks **es-CO and en**. Spanish is the language it was written in and English is the
addition, and that asymmetry is the whole design: `/inmuebles` is the Spanish catalogue and
`/en/inmuebles` is the English one. Everything below follows from it.

**Spanish keeps the URLs it already published.** Every link this product has ever sent is an
unprefixed Spanish path — a notification email pointing at `/contratos/<id>#etapa-guarantee`, a
listing pasted into a WhatsApp group, the two permanent redirects in `next.config.ts` — so a scheme
where the default locale carries a prefix invalidates all of them at once. The prefix is what English
costs. The route *words* stay Spanish inside it (`/en/inmuebles`, not `/en/properties`): translating
segments would mean a second `propertySlugs` reservation and two URLs per listing that can drift.

**`app/[lang]/` is the root, and `app/layout.tsx` had to go.** `next/root-params` only exposes a
getter for a dynamic segment sitting *above* the root layout, so with the old file in place `lang`
would have been an ordinary route param — readable through `params` in the page that declares it and
nowhere else — and all ~200 components needing the language would have taken it as a prop. Moving the
root layout under `[lang]` is the single structural decision the rest rests on. What did **not** move:
`app/robots.ts`, `app/sitemap.ts`, `app/api/**`, the icons and `globals.css`. None of them has a
language, a crawler fetches the first two by fixed name, and a Route Handler cannot read a root param
anyway (Next says a future release).

**`proxy.ts` decides what a URL means before anything renders**, and its three branches are the logic:

| Request | Answer | Why |
| --- | --- | --- |
| `/es/...` | **301** to the unprefixed path | `[lang]` matches the literal string `es`, so without this two URLs render one page and each accumulates links |
| `/en/...` | pass through | already explicit |
| anything else | **rewrite** to `/es/...` | the URL the visitor sees stays `/inmuebles` while the route that renders is `/es/inmuebles` |

**An unprefixed path is Spanish, always, with no `Accept-Language` sniffing** — and that is the
decision worth defending, because Next's own guide shows the opposite. These URLs exist to be pasted
into group chats; if the server redirected by browser language, one shared link would open in
different languages for each person, and the Spanish page would never be served to an
English-configured browser, Googlebot included. The path is authoritative and the only thing that
changes language is asking for it. **The one exception is the bare root**, the only URL with no
shared-link expectation: there a remembered choice wins, and failing that `Accept-Language` gets one
**307** — temporary, because the answer depends on who is asking.

**The dictionary is two TypeScript files, and `es.ts` is the type.** `Dictionary = typeof es`, and
`en.ts` is annotated with it, so a key added and not translated fails `pnpm typecheck` rather than
rendering Spanish to an English reader or `undefined` to anybody. Same device as `categoryOf`'s
complete `Record`. **No `as const`** — with it the type would carry the literal Spanish strings and
`en` could only satisfy it by repeating them. Parameterised copy is a **function**, never a template
with placeholders: `${count} inmuebles` needs a plural rule and the number does not sit in the same
place in both languages.

**And that has one hard consequence: a dictionary slice crossing to a Client Component must be plain
data.** A function cannot be handed from a Server Component to a Client Component — React answers
*"Functions cannot be passed directly to Client Components"*, the same boundary a lucide icon hits.
**This has now 500'd the product four separate times**: the language switcher was given `language`
(which held `switchTo`), the catalogue's facets were given `property` (which holds `found`,
`seoTitle` and more), the login form was given `auth` (which held `resetSentTo`), and the dossier
fields were given `dossier` (which held `previewOf`). Every one of them compiled — `pnpm build` cannot see it, and neither can a type: passing a *variable* with extra
function-valued properties satisfies a narrowed type, and the functions still travel at runtime.

So the guard is a test, and it is the only form of this rule that can fail. **It is an opt-out list,
and it started as an opt-in one — the inversion is itself a lesson.** `dictionary.test.ts` walks
*every* namespace asserting each leaf is a string, except the ones named in
`SERVER_ONLY_NAMESPACES`. With an allowlist the default was *unchecked*, so a namespace only had a
guard if somebody remembered to register it — and the **fourth** outage was exactly that: `dossier`
was added, handed to `DossierFields`, and never listed. Forgetting now produces a red test instead
of a broken page, and adding a name to that list is a deliberate claim that nothing client-side ever
receives it whole.

Two ways to keep a namespace client-safe when a value has to be substituted:

- **Resolve it on the server and pass the finished string.** `CatalogToolbar` takes
  `foundLabel: string`, not `total` plus a formatter.
- **Split it into the plain pieces around the value**, when the value is client state and the server
  cannot know it: `auth.resetSentToBefore` / `resetSentToAfter` wrap an email the browser holds.

A namespace not in that list may hold functions freely; it simply may not cross in one piece.

**`LocaleLink` sits in front of every `<Link>`**, because the routes are Spanish words and Spanish is
unprefixed — so a plain `<Link href={PROPERTIES_ROUTE}>` pressed on `/en/inmuebles` navigates to the
*Spanish* catalogue. Nothing errors and nothing looks broken; the reader just finds themselves back in
Spanish having pressed a link belonging to the page they were reading. No type checker can see it. The
42 files that imported `next/link` now import `{ LocaleLink as Link }`, so all 84 call sites are
unchanged and the Spanish behaviour is byte-identical. It is idempotent and leaves alone anything that
is not an internal absolute path (`mailto:`, `tel:`, a bare `#etapa-…`).

**`safeRedirect` compares without the prefix.** The four rejected paths existed only as Spanish
literals, so `?next=/en/ingresar` walked straight through the loop guard. Every reason those four are
rejected is language-independent.

**SEO: the canonical is self-referencing per language, with both versions in `hreflang`.** Pointing the
English canonical at the Spanish URL would ask for the English page to be dropped from the index — the
opposite of publishing it. A cluster is only believed when **every** version names every version,
itself included; one that names only the other is discarded whole, which is the most silent failure in
this change. `x-default` is Spanish. `app/sitemap.ts` submits **one row per language** with the
cluster on each, and `app/robots.ts` repeats its `Disallow` list through `localeHref` for both — a
list of Spanish literals said nothing at all about `/en/contratos`.

Two things that had to be restated per page because **metadata merges per field**: `og:locale`, and
the catalogue's `<title>`. `catalogMetaTitle` took no locale, so `/en/inmuebles` shipped
`<title>Inmuebles en arriendo en Colombia</title>` — a Spanish title on the one English page that
exists to be found, invisible to `typecheck`, `lint`, `build` and every driver. It was caught reading
the `<head>` the server actually sends, and `inLanguage` in the catalogue's JSON-LD had the same bug.
Both take a required `locale` with **no default**, because a default is precisely how a caller
silently renders the wrong language.

**`users/{uid}.locale` is what an email is written in**, and it is a stored field because there is
nowhere else to read it from: `notify()` runs inside `after()` with no request, no `Accept-Language`
and no prefix, and it also runs from the cron sweeps. It is **the recipient's** language, never the
request's — whoever moved the process is the *other* party. Onboarding seeds it from the language the
form was filled in (the strongest free signal: they just read every label and both consent sentences
in it), Ajustes → Perfil changes it, and `localeFor` turns every absence — an account older than the
field, an untouched setting, a failed read — into Spanish. That is `allowsChannel`'s "fail towards
delivering", one field over.

**What is translated and what is deliberately not:**

| | |
| --- | --- |
| Done | **the whole public half**; **auth and the product shell** (sign-in, sign-up, password recovery, the account-security panel, the sidebar, the drawer, the account menu, the support card); **the publish/edit form** with its photo uploader and map picker, and the landlord's listing card; **every portal page's headings and empty states** (`/inicio`, `/mis-inmuebles`, `/contratos`, `/arriendos`, `/ajustes`, `/encargos`, `/perfil-inquilino`); and **the tenant dossier** — its fields, the document checklist, and the document/occupation vocabulary.<br>And: the landing, the catalogue (heading, facets, sort, toolbar, cards, pager), a listing's detail page and its price card, the public header and footer, the cookie banner's sentence. Plus the SEO of both indexed pages — `<title>`, description, `hreflang`, `og:locale`, JSON-LD `inLanguage`, the alt text of the generated Open Graph card — the notification email's chrome (button, fallback link, footer, `<html lang>`), and the language selector |
| **Spanish only, on purpose** | the **three legal documents**. `/terminos`, `/privacidad` and `/cookies` are operative under Ley 1581 and Ley 1480 — the text is what the company is bound by, not a description of it — so a translation is a *second document* making the same promises in words no lawyer has read. `/en/terminos` exists, is in the sitemap and names its Spanish twin, and `LegalChrome` renders a `role="note"` saying the document is the Spanish original, with `lang="es"` on the wrapper so a screen reader does not read Colombian legal prose in an English voice |
| **Spanish still, not by design** | the **eight stage panels** (`features/application`, by far the largest), `/arriendos` and the incidents (`features/lease`), the errands (`features/collaboration`), **the forty-six per-type notification sentences** in `features/notification/domain/notification.ts`, and `GENDER_LABELS`. Plus **206 Zod validation messages** across sixteen `validations/` modules — a coherent sub-project of its own: a schema is a module constant, so making one locale-aware means turning it into a factory that takes the copy, and the call sites are the forms (client) and the actions (server). All of it is `noindex` and behind a session |

**The `locale` cookie is necessary, not optional**, in the sense `/cookies` uses: two characters of UI
preference, no personal data, and the product does not work as intended without it — the same category
as `sidebar`. It is written by `proxy.ts` from the path being served and **only when it changed**, because a
`Set-Cookie` on every response costs the CDN's ability to cache the landing and the catalogue. The
switcher cannot write it: it is a plain `<a>`.

**And the switcher is a plain `<a>` on purpose — the one hard navigation in the product.** Three things
have to change that a soft navigation would not reliably do: `<html lang>`, which is on the document;
the cookie, which only a real request reaches; and every string rendered by a Server Component above
it. It carries the **query**, because on the catalogue the query *is* the page. Its label is the
language being offered written **in itself** — "English" on a Spanish page — since naming it in the
current language is unreadable to exactly the person reaching for it, and a flag names a country.

**The `X_LABELS` constants are gone**, replaced by `propertyLabels(locale)` in
`features/property/domain/labels.ts` and `dossierLabels(locale)` in
`features/tenant-profile/domain/labels.ts` — six and five of them respectively, and the same shape
both times, each with a `labels.test.ts` asserting the result is function-free. The keys have not moved — they are still the stored English
values — and the records it returns are the same shape `PROPERTY_TYPE_LABELS` and friends were; only
the words went into `shared/i18n/messages`. Built from the unions, so a value added to
`PROPERTY_TYPES` with no word for it still fails `pnpm typecheck`.

**Everything that object returns is a plain string, and `labels.test.ts` asserts exactly that.**
`CatalogFilters` and `CatalogToolbar` are Client Components, so the whole thing crosses the RSC
boundary — and a function does not cross it. That mistake has now been made **twice**: first with
the language switcher, which was handed the `language` slice holding `switchTo(name)`, and again one
commit after the rule was written down, when these two were handed `Dictionary["property"]` — which
carries `found`, `bedroomsFact`, `seoTitle` and more. `pnpm build` compiled both; both 500'd every
page that rendered them. Anything parameterised is resolved on the server and passed finished, which
is why `CatalogToolbar` takes `foundLabel: string` and not `total` plus a formatter.

**And the client components take props rather than importing the dictionary**, which is the same
call as Leaflet in its own chunk: importing `shared/i18n/dictionary` from a `"use client"` file pulls
**both** languages into the browser bundle of the catalogue, the most-fetched page on the site.

**`no-restricted-imports` now forbids `next/link`** outside `shared/i18n/locale-link.tsx` and
`shared/ui/nav-item.tsx` (which needs `useLinkStatus`, the hook). Without it nothing stopped a new
file reintroducing the silent language-loss. **Its position in `eslint.config.mjs` is load-bearing**:
flat config does not merge two configs setting the same rule, the last match wins outright, so
placing it *after* the `data/`/`actions/` block silently disabled the cross-feature import guard for
every file under `data/`, `actions/`, `app/api/` and `shared/auth/`. `pnpm lint` stayed green. It was
found by planting a violating import and watching nothing happen, and it sits before that block now.

**Dates take the locale and keep Bogotá.** `Intl.DateTimeFormat(locale, { timeZone: "America/Bogota" })`
— when a flat is available is a fact about Colombia, not about where the reader is sitting. The
`es-CO` that was hard-coded in the property card left "24 de agosto de 2026" inside an English card.

**Translating must not reword the Spanish.** Moving a string into the dictionary is a *move*: the
Spanish value has to be the byte-for-byte original. Four drivers went red at once because the
migration quietly improved "Expandir menú" into "Ampliar el menú", "Enviarme el enlace" into "Enviar
el enlace" and "Saliendo…" into "Cerrando sesión…" — none of which was an improvement anybody asked
for, and each of which is an assertion somewhere. The check is one command: extract the Spanish
values from `messages/es.ts` and confirm each appears verbatim in `git show HEAD:<file>`; what is
left over is either genuinely new copy or a reword to undo.

**The switcher is a menu, and the root used to trap you in English.** `/` is the only path the proxy
redirects, and while a remembered cookie could win there, the switcher's Spanish target — which *is*
`/` — bounced straight back to `/en`. From the screen the control did nothing. The cookie now only
records that we have negotiated once; see `proxy.ts`. `tests/e2e/i18n.mjs` drives the round trip on
the root specifically, which is what the earlier round of drivers missed by exercising it on
`/inmuebles`.

**`shared/i18n/` and `proxy.ts` are in `SELECTS_EVERY_DRIVER`**, so any i18n change runs all 46
drivers. That is correct rather than excessive: every user-visible string, every URL prefix and every
page's `<html lang>` comes out of that module. `tests/e2e/i18n.mjs` is the driver.

**Not built:** a third language (`LOCALES` is the list; the switcher becomes a menu at three), the
legal documents in English, and translating the per-type notification copy.

## Sections not built yet
The menu shows **Facturación** disabled, with a "Pronto" badge, instead of linking to a 404. To
activate it: create the route and add its `href` to the `NAV` array in `shared/shell/app-nav.tsx` —
the one list both surfaces render, so the sidebar and the drawer cannot disagree about what the
product contains. **Ajustes was the last one activated** (see below), and Arriendos before it; that
is exactly what a disabled entry is for — a menu that stopped at "Contratos" said the year after a
signature did not exist.

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
                   #      AND it proves a rule is CORRECT, never that it is DEPLOYED: the emulator
                   #      loads the local file, so a new `match` passes every check here and answers
                   #      storage/unauthorized on production. It cost a broken upload once, on the
                   #      acta's photos. A rules change is
                   #      `firebase deploy --only firestore:rules,storage` in the same change —
                   #      Storage is the half that gets forgotten.
pnpm e2e --since   # ~15s per driver — the browser level. Reads `git diff --name-only` and runs
                   #      only the drivers whose paths it touches (tests/e2e/manifest.mjs).
pnpm typegen       # 3s — only when a route moved or was renamed (see below). Everything under
                   #      app/[lang]/ counts: PageProps<"/inmuebles"> is now
                   #      PageProps<"/[lang]/inmuebles">, and tsc fails on the generated types
                   #      with an error that looks unrelated to your change.
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
`pnpm test:rules` boots the Firestore emulator and runs `tests/rules/` (110 cases, every rule
with a mandatory negative case). It needs **JDK 21+**, and **the script puts it on the PATH
itself** — `/opt/homebrew/opt/openjdk@21/bin` is prepended in `package.json`, because Homebrew's
`openjdk@21` is *keg-only*: it is not registered with `/usr/libexec/java_home`, so `java` resolves
to whatever older JDK is installed and `firebase-tools` refuses to boot. The prefix is a no-op
where that directory does not exist (Linux, CI), which is why `verify:all` runs anywhere.

No `export` is needed any more. If you install the JDK somewhere else, that path in
`package.json` is the one place to change.

Every new or modified rule is tested here before `firebase deploy`. When you add a
collection, add its access-denied test too.

## Habeas data, cookies and the right to be deleted (`features/legal`)

Colombia's regime is **Ley Estatutaria 1581 de 2012** plus **Decreto 1074 de 2015** (which compiled
Decreto 1377 de 2013). The 2025 reform — PL 247/2025, accumulated with 214/2025 — **was archived**
("ARCHIVADO ARTÍCULO 190, LEY 5 DE 1992") after passing committee, so nothing here is written against
it. The **RNBD does not apply**: the threshold is 100.000 UVT of total assets (~$5.237M COP for 2026),
and it starts applying the day that is crossed.

Three documents, at `/terminos`, `/privacidad` and `/cookies`. They live **outside both route groups**
like `/soporte` and pick their chrome from the session (`app/legal-chrome.tsx`): reading a policy must
not require an account, because the person deciding whether to sign up is exactly the person who needs
to read it. They inherit the root layout's `index: true` and are in `app/sitemap.ts` — a policy nobody
can find is not published, and both Fincaraíz and Metrocuadrado index theirs.

**`shared/legal/` holds what four layers read**, and it is there rather than in `features/legal/`
because putting it in a feature produced a real cycle: `profile → legal → application → profile`. The
onboarding form needs the document versions and the erasure action needs to know about processes.
`controller.ts` is the Responsable's identity; `documents.ts` is the versions.

**The NIT is `null` and that is a gap, not a decision.** It is mandatory content of the policy (Ley
1581 art. 13 and 15) and of any e-commerce provider's public identification (Ley 1480 art. 50).
`controllerIdentityLines()` omits the line while it is absent, so nothing renders a dangling "NIT",
and `shared/legal/controller.ts` is the one line to change.

### Where authorisation is needed, and what each point does

- **`/registro` step 1** says what actually happens and links the document, rather than claiming an
  acceptance. It used to read "Al crear tu cuenta aceptas nuestros Términos…", which was wrong twice:
  Decreto 1074 art. 2.2.2.25.2.3 wants conduct from which consent can unequivocally be concluded, and
  reading a sentence is not conduct — and acceptance actually happens on the *next* screen.
- **There is no standing aviso-de-privacidad block on the collection screens**, and that was a
  deliberate call after one existed: the information duty of art. 2.2.2.25.3.2 is to make the policy's
  **existence and how to reach it** known, and the two consent checkboxes link it directly. A repeated
  paragraph above every form was noise saying what the checkbox beneath it already said. If a screen
  ever collects for a *new* purpose the documents do not cover, that is when it needs its own notice —
  and a new finalidad needs fresh authorisation anyway (art. 2.2.2.25.2.5).
- **Links that leave what you are in the middle of open in a new tab**, through
  `shared/ui/new-tab-link.tsx` (`NewTabLink`). The rule: a new tab when the page being left has state
  worth keeping and the destination is somewhere you go to *check* something before coming back. Two
  families qualify — the **legal documents**, clicked from a checkbox in a half-filled onboarding
  form, from a banner over something being read, from the footer under a search that took a minute to
  build; and the **`/inicio` shortcut into the public catalogue**, which is the other half of the
  product behind a different chrome, so somebody browsing listings has not finished with their
  processes. It is **not** for ordinary navigation: `/soporte` from the footer, a listing from the
  catalogue, a process from the list are where you were going, and a new tab there is clutter
  somebody has to close. A component rather than `target="_blank"` fifteen times, because that is
  the attribute that goes missing on the sixteenth. It began as `LegalLink` in `shared/legal/` and
  moved the moment the second family appeared — a product shortcut importing from the legal module
  would have been the wrong dependency for a rule that was never about legal documents.
  `tests/e2e/legal.mjs` asserts `target` and `noopener` on the footer's three and `tests/e2e/nav.mjs`
  on the shortcut; both were confirmed to go red with the attribute removed. They assert the
  attributes rather than clicking, or the test becomes one about Playwright's tab handling.
- **Onboarding asks twice, and the split is the point.** `acceptsTerms` and
  `authorizesDataTreatment` were one checkbox reading "Autorizo el tratamiento… y acepto los
  Términos". Accepting a contract and authorising data processing are different acts, the second has
  to be **express** (art. 9), and bundled together the record cannot say which one was answered. Both
  are still required: what vitiates an authorisation is the bundling, not the requirement.
- **`gender` is optional now**, and that is art. 6 rather than a preference. `domain/profile.ts`
  already called it sensitive data; art. 6 says nobody may be *obliged* to authorise sensitive data,
  so a required select was exactly that obligation. It was also part of the profile-completeness check
  in `data/profile.ts`, which meant declining to give it locked the account out of every screen.
  Absent is an **absent field**, never `null` and never `""` — and clearing it in the profile writes
  `FieldValue.delete()`, which is what makes emptying the select mean what the person meant.
- **The dossier's reference is a third party who never consented.** `referenceAuthorized` is a
  required declaration that the tenant has that person's permission (art. 2.2.2.25.2.7 anticipates
  data collected from someone other than the titular). It is **asked again on every save** — unlike
  the terms — because the tick is about the phone number in the field beside it, and that field is
  editable. `toStoredDossier` drops it and the action writes `referenceAuthorizedAt` instead: the
  timestamp is the record, like `waivedAt` and `checksAuthorizedAt`.
- **`background_check` was already right** and only gained `checksAuthorizedVersion`, for the reason
  `clauseVersion` sits beside `acceptedClauseAt`.
- **The cédula photos are personal data, not biometric.** The SIC's guide on photographs treats them
  as biometric only when processed with biometric tools, which this product does not do. The day face
  matching is added, that becomes a separate explicit authorisation.

### The consent record

`users/{uid}/consents/{consentId}`, append-only — the sibling of `users/{uid}/documents/{documentId}`.
It holds `kind`, `version`, `grantedAt`, `ip` and `userAgent`, because Decreto 1074 art. 2.2.2.25.2.4
puts the burden of **proving** the authorisation on us. The owner may `get` and `list` their own —
that *is* the derecho de acceso — and **no client writes**: a client that could forge its own proof of
consent would void the only evidence there is.

**The write lives in `completeProfile`, in the same batch as the profile.** Split into two actions, one
can succeed alone, and the half that survives is a document full of personal data with no record of
anybody having authorised it.

**No state is duplicated on `users/{uid}`.** `termsAcceptedAt` stays because every account created
before this has it and nothing else, and `withLegacyConsent` reads it as an authorisation to both
documents at version 1 — which is what it was, since one checkbox covered both. Same shape as
`normalizeStage()` mapping the old stage names. **No migration to run.**

`reconsentFrom` is **not** `version`, and conflating them is the mistake the field exists to prevent:
art. 2.2.2.25.2.5 requires a fresh authorisation when the **finalidad** changes, not when a sentence is
reworded. `consentIsCurrent` takes the document rather than reading the constants, for the reason
`validateBirthDate` takes its reference date — the interesting cases are the ones that are not true
today.

### Cookies

Two categories: necessary (`session`, `sidebar`, `cookie-consent`) and `analytics`. **There is no
advertising category**, because this product serves no ads and declaring a processing that does not
happen is how a policy becomes a liability.

**Firebase Analytics used to load unconditionally on every public page**, for visitors who had been
asked nothing. `ConsentGate` in the root layout renders it only with an authorisation. The decision is
read **in the browser**: reading `cookies()` in `app/layout.tsx` would opt the whole route tree into
dynamic rendering, catalogue and listing detail included. The consequence, stated rather than hidden:
the banner is not in the HTML a crawler receives, which is correct — a crawler cannot consent.

**Two real buttons on the banner**, and neither is `accent` (it renders over pages with their own cyan
CTA — the bell's reasoning). `/cookies` carries the switch that makes the authorisation revocable,
which is what turns the banner from an announcement into a consent.

**The snapshot must be reference-stable, and this cost the whole product.**
`useSyncExternalStore` compares with `Object.is`; `decodeCookieConsent` builds a fresh object every
call, so the store reported a change on every render — "Maximum update depth exceeded", and since
`ConsentGate` is in the **root layout**, every page died. It only appeared *after* a decision existed:
with no cookie the snapshot is `null`, which is stable, so a first visit looked perfect and every visit
afterwards did not. `chime.ts` reads its preference the same way and never had the bug because a
boolean is a primitive. `stableConsent()` memoises on the raw cookie string, and its test asserts with
`toBe` rather than `toEqual` — `toEqual` passes on exactly the state that broke.

**A Radix `Switch` is a `<button role="switch">`, so `<label for>` does not name it.** Both switches in
the product were announced as unnamed controls; they carry `aria-labelledby` now, not a duplicated
`aria-label`, so the announced name cannot drift from the visible words.

### Deleting an account

`deleteAccount` uses `requireUser()`, **not** `requireCompleteProfile()`: somebody who signed up and
never finished onboarding still has an account and is entitled to have it deleted.

**Supresión is not absolute** (art. 9; Decreto 1074 art. 2.2.2.25.2.11). `ERASURE_PLAN` is the
specification the action implements and the screen renders, and every retention carries its reason —
a test fails if one does not, because an exception to somebody's rights that nobody wrote a reason for
is one nobody can defend. Signed contracts, leases, periods, incidents and closed applications stay:
they belong to **two** people, and erasing one destroys the other's evidence. The dossier, the uploaded
files, the listings and the notifications go; `users/{uid}` becomes a tombstone with `deletedAt` and
`FieldValue.delete()` per field.

**The consent records stay too**, and this is the retention that looks wrong and is not: they are the
proof that the processing which produced those contracts was authorised. They hold a version, a date,
an ip and a user agent; they never held a name.

`erasureStatus` **fails closed**: `listLeasesFor` answers `{ ok: false }` while its index is building,
and reading that as zero tenancies would delete an account mid-lease. It reuses the two public list
functions rather than writing its own queries, so no second composite index has to be remembered.

**Not built, deliberately:** purging the application snapshots at five years (Estatuto Tributario art.
632) is documented in the policy and in the code, and no job does it.

### Ley 2300 de 2023

`sendWhatsApp` takes `purpose: "transactional" | "collection"`, **required and with no default**.
`collection` goes through `collectionContactBlocker` — Mon–Fri 07:00–19:00, Sat 08:00–15:00, never
Sundays or public holidays, in Bogotá time. The guard is in the sender, not at each call site: a guard
at the call site is one somebody can forget to write.

**Nothing sends with `collection` today**, and the interview reminders must not — they are an
appointment both parties agreed to, and the ten-minute one's whole value is arriving ten minutes
before a call. It exists because the canon-due cron `CLAUDE.md` lists as planned **is** collection, and
whoever writes it will not be able to send without answering the question.

The eighteen Colombian holidays are **computed, not tabulated**: six are relative to Easter and seven
are shifted to the following Monday by the Ley Emiliani (Ley 51 de 1983). A hard-coded list would be
right until the year it silently ran out, and a cron reading it would then send collection messages on
Jueves Santo. `contact-window.test.ts` pins the whole 2026 calendar.

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
