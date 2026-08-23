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
| `/inicio` | `HOME_ROUTE` | User portal: greeting, **the rentals in course** and shortcuts. Destination after signing in. The card lists the open processes with the stage each one is on — it used to read a `contracts` collection nothing writes, so it told somebody with three open processes that they had nothing. |
| `/recuperar` | `PASSWORD_RESET_ROUTE` | **Not implemented** (404). |
| `/inmuebles/publicar` | `PUBLISH_PROPERTY_ROUTE` | Where a landlord publishes. Needs a complete profile. |
| — | — | Publishing requires the **matrícula inmobiliaria**, and it is stored beside the street in `properties/{id}/private/location`, never in the public document: with that number anyone can pull the certificate and read the address off it, so publishing it would publish the address by the back door. Validated loosely — the circle is two or three digits and the separator is written every way — because the only real check is against the registry, which this product does not do. |
| `/mis-inmuebles` | `MY_PROPERTIES_ROUTE` | The landlord's own listings: edit, copy link, delete. |
| `/postularme/<slug>` | `applyToPropertyRoute(slug)` | Where a tenant applies. Needs a complete profile; redirects to the process if one is already open. |
| `/arriendos` | `RENTALS_ROUTE` | Every rental the user is part of, on either side: the open ones with their stage rail, the closed ones with why they closed. It is called "Arriendos" in the menu and titled "Gestión de arriendos". **`/contrato` and `/contrato/<id>` redirect here permanently** (301 in `next.config.ts`): every email already sent points at the old path, and the browser keeps the `#etapa-…` fragment across the redirect. |
| `/arriendos/<id>` | `applicationRoute(id)` | One process: its nine stages. A non-party gets 404, the same answer as a process that does not exist. |
| `/perfil-inquilino` | `TENANT_PROFILE_ROUTE` | "Mi perfil": the account details given at signup **and** the reusable tenant dossier, on one page with one save. |
| `/soporte` | `SUPPORT_ROUTE` | How to reach a person: WhatsApp and email, each saying what it is good for. No form and no ticket number — there is no queue behind one. **It is the one page that renders in either chrome** (`app/soporte/`, outside both route groups): the product's menu when there is a session, the public header when there is not. Needing help is not something you should have to sign in to do, and "Contacto" sits in the public header either way. |
| `/mis-inmuebles/<id>/editar` | `editPropertyRoute(id)` | Editing one. **Both publishing and saving an edit end on the list**, not on the listing: what a landlord does next is copy its link, publish another, or look at what they already have, and all three are there. |
| `/inmuebles/<slug>` | `propertyDetailRoute(slug)` | Public detail of one property. No session needed. |
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
| `shared/shell/app-sidebar.tsx` | `AppSidebar`: the menu always visible from `lg` up, narrow by default, widened with the arrow. |
| `shared/shell/sidebar-state.ts` | The cookie that remembers that width. Read on the server so the first paint is already right. |
| `shared/shell/app-drawer.tsx` | `AppDrawer`: below `lg`, the bar with the hamburger plus the same menu in a drawer. Owns the open state. |
| `shared/ui/nav-item.tsx` | `NavItem`: a menu entry. Without `href` it renders disabled with a "Pronto" badge. `activeOn` marks the section on routes that do not hang off its path; `shortLabel` is what the narrow rail shows instead of a name too long to sit under an icon. |
| `shared/ui/coming-soon-card.tsx` | `ComingSoonCard`: wraps mocked-up UI whose function does not exist yet. |

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

Nine stages, in `domain/application.ts`, and the landlord moves it **one stage at a time** —
nothing advances by itself, because each of these is a decision someone makes off the platform
and then records here. `submitted → tenant_data → background_check → interview → guarantee → approved →
contract_signature → first_payment → active`.

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
is not something to leave open on a guessable path. Note that minute-level crons need a Vercel
plan above Hobby, which caps them at one run a day.

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
a process is news, and news belongs in the bell and the inbox: a phone that buzzes for each of nine
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

**A finished stage keeps its panel**, folded shut and without its buttons. Looking up what was
uploaded three stages ago is a normal thing to want, and a process that hides what was agreed the
moment it moves on is a record nobody can audit. The buttons go because a control that no longer
changes anything is the same lie as a "Continuar" that does not continue — `readOnly` on each
panel, decided by the page, which is the only place that knows which stage the process is on.

**Every panel starts folded, and a change of stage folds them all.** The header carries the
state — "5 de 5 subidos", "2 de 4 consultadas" — so what a click reveals is the controls, not the
news; nine stages each unfolding on their own would be a page nobody can see the shape of.
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

**There is no deposit stage, and there must never be one.** Ley 820 de 2003 forbids cash
deposits on urban housing leases in Colombia. `guarantee` — a co-signer or an insurance policy —
is what stands in for it, and a test asserts the word never comes back.

Three of the nine are `UNBUILT_STAGES` - `guarantee`, `contract_signature`, `first_payment`:
visible, described, with no interface of their own yet.
They are shown rather than hidden because a tenant needs to know what is coming, and the screen
says out loud that those happen off the platform for now.

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

## Notifications and email (`features/notification`)

Every movement of a process tells the person who did **not** cause it, twice: the bell in the
top bar, and an email. Both use the same copy, derived from the notification's `type` rather
than stored with it, so fixing a confusing sentence fixes the ones already sent.

The email carries what the bell cannot: an **absolute link straight to the stage**,
`/arriendos/<id>#etapa-<stage>`. The timeline gives every stage that id, so the email lands on
the step it is about instead of at the top of a page with nine of them.

**Email goes out through Resend**, over its REST API — no SDK, because sending is a `POST` with
five fields. `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` come from the Vercel integration; the
`from` domain is derived from the second one rather than written by hand, because Resend answers
**403** when it does not match a verified domain and nothing errors until a real email fails to
leave. Without a key nothing breaks: the email is logged and the action carries on, which is
what lets the flow be exercised locally without mailing anyone.

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
sidebar and the drawer cannot disagree about what the product contains.

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
`app/(app)/arriendos/[id]/loading.tsx` does the same in the shape of the process page.

**A `loading.tsx` covers a segment and everything under it, and a boundary above a route turns
its `notFound()` into a `200` with the not-found page streamed inside.** The headers are already
flushed by the time the page says "this does not exist". That is why:

- The **public** pages have none. A boundary over `/inmuebles` would also sit over
  `/inmuebles/<slug>`, and a soft 404 on the one page search engines index is a real cost. The
  catalog streams from a `<Suspense>` **inside** its own page instead, so the heading appears at
  once and only the part waiting on Firestore is replaced by a skeleton. A missing property still
  answers a true 404, and there is a driver assertion pinned on it.
- The **private** ones keep theirs. `/arriendos/<id>` now answers `200` to a stranger with the
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
                   #      Mandatory when it applies. Needs JDK 21+.
pnpm typegen       # 3s — only when a route moved or was renamed (see below).
```

The number to watch is not how many commands ran, it is the **test count**: a green suite of 25
untouched files is green whether or not you tested what you just built. If a change added a
schema, a pure function or a state transition, `pnpm test`'s count must have gone up — and if it
did not, that belongs in the report by name.

After moving or renaming a route: `rm -rf .next && pnpm typegen`, or `tsc` fails on the
generated types with an error that has nothing to do with your change.

## Security Rules tests
`pnpm test:rules` boots the Firestore emulator and runs `tests/rules/` (75 cases, every rule
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
