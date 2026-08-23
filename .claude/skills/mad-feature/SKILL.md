---
name: mad-feature
description: Build a complete miarriendodirecto.com feature from a mockup, image, sketch or description. Use it when the user asks for a new screen, flow or feature, or shares a reference design. It orchestrates the project's other skills, the MAD UI design system and the verification bar.
---

# MAD Feature — from an image to a verified feature

You are the senior developer of **miarriendodirecto.com** (Colombian PropTech: renting
directly between landlord and tenant, with profile validation, contracts and payments).

This skill is the **orchestrator**. It does not repeat what is documented elsewhere: it tells
you what to load, in what order to work, and when you are actually done.

---

## 0. Repository facts (do not assume them, they are verified)

| Thing | Reality |
| --- | --- |
| Structure | **No `src/`**. It is `app/` (routing only), `features/<domain>/`, `shared/` and `tests/rules/`. `mad-architecture` defines it. |
| Framework | Next.js **16.3.2**, App Router, Turbopack, React 19.2 |
| Styling | Tailwind CSS **v4** — CSS-first, `@theme` in `app/globals.css`, **no `tailwind.config.js`** |
| UI | shadcn/ui, `radix-nova` style (Radix primitives, lucide icons). `shared/ui/*` |
| Firebase | modular SDK **v12** (client) + `firebase-admin` **v14** (server) |
| Forms | Zod **v4** + react-hook-form v7 + `@hookform/resolvers` v5 |
| Package manager | **pnpm** |
| Routes | All in Spanish. Constants in `shared/auth/routes.ts` |
| Language | Everything in English except URLs, user-facing copy and proper nouns (see `CLAUDE.md`) |

Two frequent corrections about this stack:

- The `radix-nova` registry **does not expose `form`**. `shadcn add @shadcn/form` does
  nothing. Build forms with `Label` + `Input` + react-hook-form and wire the ARIA by hand.
- **Never run `shadcn init` again**: it overwrites `components.json` and `app/globals.css`, and
  takes the MAD UI tokens with it. Only `shadcn add`.

---

## 1. Skills you must load (explicit delegation)

Do not rewrite from memory what these skills already solve. Load them **before** writing code
in the matching area:

| Load | When |
| --- | --- |
`nextjs-app-router` | any file in `app/`, Server Actions, caching, `proxy.ts` |
`typescript-strict` | domain models, Firestore converters, any new type |
`zod-react-hook-form` | every form and every validation schema |
`shadcn-tailwind` | every visual component, tokens, `globals.css` |
`firebase-modular` | client SDK: auth, realtime, Storage |
`firebase-admin-sdk` | server: session, claims, privileged writes |
`firestore-security-rules` | a new collection, or "who can read this?" |
**`mad-architecture`** | where each file goes, module boundaries, moving or renaming folders |
**`frontend-design`** | visual hierarchy, typography, composition, density, rhythm |
**`vercel-react-best-practices`** | performance: waterfalls, bundle, re-renders, RSC |

### How to use `frontend-design` without breaking the brand

That skill is written for inventing a visual identity from scratch — it will ask you to pick a
palette and typography with your own judgement and "take an aesthetic risk". **Here the palette
and the typography are already decided and not up for negotiation.** Use it only for what is
genuinely your call:

- ✅ Hierarchy and type scale, spacing, density, vertical rhythm, composition, how information
  is grouped, what deserves emphasis, what the empty state looks like.
- ❌ New colors, new fonts, "aesthetic risks" on the identity, gradients or shadows that do not
  come from the tokens.

If the design needs a color that does not exist as a token, **add it to `app/globals.css`** with
a semantic name and map it in `@theme inline`; never write it loose in a component.

### How to use `vercel-react-best-practices`

It is 70 rules ordered by priority. Do not apply them all blindly: on a new screen what matters
is mostly the `async-` (waterfalls), `bundle-` and `server-` categories, and of those, four
almost always apply:

- `async-parallel` — `Promise.all` for independent Firestore reads.
- `server-serialization` — pass the minimum from Server to Client Component.
- `server-auth-actions` — authenticate every Server Action as if it were a public endpoint.
- `bundle-dynamic-imports` — `next/dynamic` for heavy things (maps, charts, PDF viewers).

The `rerender-` and `js-` ones apply when there is a measured problem, not preventively.

---

## 2. Read the whole image before writing anything

A mockup shows **one** state: the happy one, with perfect data and short text. Most of a real
feature's code is what the image does not show. Before coding, write the inventory:

1. **Data**: which fields appear, which collection they come from, which are sensitive.
2. **Actions**: every button and link — where it goes, what it writes, who is allowed.
3. **States the image never brings**:
   - loading (skeleton, not a full-screen spinner)
   - empty (first use: what text and what action it offers)
   - error (network, permissions, validation)
   - no permission to see this
   - long text (a 140-character title, a compound name, `text-balance`/`truncate`)
   - amounts at zero, negative or enormous
   - mobile (390px) and reading at 200% zoom
4. **Copy**: Colombian Spanish. Amounts with
   `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
5. **What the design promises but cannot deliver** — say it before building. Real examples: a
   "6-digit code" needs an email provider; a language switcher implies full i18n; a link to
   `/terminos` needs that page to exist.

If the reference design carries another product's brand (colors, logo, typography), **the
identity is replaced by MAD UI**; what you copy is the structure and the composition.

---

## 3. Build order: contracts first

Building from the UI inwards produces the unmaintainable version: types invented so the JSX
compiles, duplicated validation, `any` to get past a compiler error. Work the other way:

1. **Domain and types** (`features/<domain>/domain/`) — the data's three shapes: `XInput` (what
   the user submits), `XDoc` (what lives in Firestore, with `Timestamp`), `X` (what the UI
   consumes, serializable). Discriminated unions for states; branded types for ids and amounts.
2. **Validation** (`features/<domain>/validations/`) — one Zod schema per use case. It is the
   only entry point for external data. Derive the types from the schema: `z.output<typeof schema>`.
3. **Rules** (`firestore.rules`, `storage.rules`) — before writing a single new document. With
   its access-denied test.
4. **Data access** (`features/<domain>/data/`) — server reads with the Admin SDK, serialized to
   POJOs. One module per aggregate, not loose queries inside components.
5. **Mutations** (Server Actions) — invariable order: **authenticate → validate with Zod →
   authorize against the real data → business invariants → write → invalidate cache**.
6. **UI** (`app/`, `features/<domain>/ui/`, `shared/`) — Server Components by default;
   `"use client"` on the lowest leaf of the tree.
7. **Verification** (section 6).

### Where each file goes

The folder structure and the module boundaries **are defined by `mad-architecture`**, not by
this skill: one single source of truth, and that one is current. Load it before creating the
feature's first folder. In short: `app/` only routes, the domain lives in
`features/<domain>/{domain,validations,data,actions,ui}` and is exposed through its `index.ts`,
and cross-cutting code sits in `shared/{ui,form,shell,auth,firebase,format,phone,lib}`.

The two mistakes that skill saves you from on a new feature: putting a component that another
domain will also use inside `features/x/ui/` (forcing it to import someone else's internals),
and naming the module after the screen instead of after the domain.

## 4. Naming conventions

This drifted once and the whole codebase had to be refactored. Do not repeat it:

- **Everything in English**: variables, functions, types, components, props, files, comments,
  JSDoc, test names, Firestore collections and fields, custom claims and their values.
  `signInWithEmail`, `isBusy`, `SubmitButton`, `redirectTo`, `users`, `role: "tenant"`.
- **Three exceptions only**: the URLs (`/registro`, `/inicio`), the copy the user reads
  (es-CO), and proper nouns or user content (`Bogotá D.C.`, an address, a property title).
- Keys in English, labels in Spanish: `{ female: "Femenino" }`, `{ active: "Vigente" }`.
- Files in `kebab-case`, components in `PascalCase`, module constants in `SCREAMING_SNAKE_CASE`.

## 5. Non-negotiable engineering rules

- **No secrets on the client.** Only `NEXT_PUBLIC_FIREBASE_*`. `shared/firebase/admin.ts`
  starts with `import "server-only"`.
- **No `any`, no `as` over external data, no `@ts-ignore`.** External input is `unknown` + Zod.
- **No loose hex values in components.** Semantic tokens, or a new token in `globals.css`.
- **No literal route strings.** Constants from `shared/auth/routes.ts`.
- **No `TODO`s, no markers, no functions returning fake data.** If something cannot be
  finished, say so in your reply; do not leave it faked in the code.
- **No dangling links.** If you add a `<Link href="/x">`, either create `/x` or report it
  explicitly as pending.
- **Personal data**: never in `searchParams`, never in `localStorage`, never in logs, never in
  a `"use cache"` shared between users. An email in the URL stays in the browser history and in
  the server logs: carry it in component state.
- **Serialize at the boundary**: `Timestamp` and `DocumentReference` do not cross to the client.
- **Accessibility**: a real `<label>` for every field, `aria-invalid` + `aria-describedby` on
  errors, visible focus on every control, state never communicated by color alone, `aria-label`
  on icon-only buttons.

---

## 6. Testing: three levels, and what belongs in each

Write the test that can fail for the right reason. A test that always passes is worse than no
test at all.

**a) Unit — colocated with the code (`features/**`, `shared/**`), `pnpm test`**
Zod schemas and pure logic: normalization, money calculations, state machines, helpers like
`safeRedirect`. For each schema, at least one valid case and one invalid case per non-trivial
rule (national id format, Colombian mobile, integer positive rent, consent).

**b) Security rules — `tests/rules/`, `pnpm test:rules`** (needs JDK 21+)
**Mandatory for every new collection.** Every rule needs its negative case: a third party who
cannot read, someone who cannot self-approve, a field that cannot change. `assertFails` only
passes on `PERMISSION_DENIED`, so an error of another kind will not give you a false green. If
you doubt the suite would catch something, **weaken the rule on purpose and confirm the test
fails** before trusting it.

**c) The real flow in a browser — `tests/e2e/`, `pnpm e2e`**
Boot the app and **drive it**; compiling is not verifying. Use the `run` skill.

**The drivers live in `tests/e2e/` and are in git.** They used to be written fresh into the
session scratchpad, and it cost exactly what you would expect: 57 files in `/tmp`, no shared
helper, `settled()` copy-pasted into every one, and three separate sweeping rewrites of all of
them the day a `loading.tsx` landed — none of it reviewable, because none of it was in a diff.
Two of those copies had silently stopped watching the console at all.

So: `playwright` is a `devDependency` now, every driver imports its helpers from
`tests/e2e/lib.mjs`, and **a change in how the app answers a navigation is one edit in that
file**. Write a new driver as a file in `tests/e2e/`, never in the scratchpad. Throwaway probes
— bisecting a layout, printing an LCP, taking one screenshot — still belong in the scratchpad,
and they stay there: if it has no `throw`, it is not a test.

```bash
pnpm emulators            # terminal 1 — auth, firestore, storage on demo-mad-e2e
pnpm dev:e2e              # terminal 2 — the app pointed at them, on :3100
pnpm e2e:env --since      # only the drivers the working tree touches — start here
pnpm e2e:env loading catalog
pnpm e2e --list           # what would run, without running it (writes nothing)
pnpm e2e:env              # all of them, before reporting a feature done
```

**`e2e:env`, not `e2e`.** The drivers publish listings, create accounts and upload files, and there
is one Firebase project for everything — so pointed at the deployed config they do all of that *in
production*. They did: 306 fake listings in the public catalogue and 644 auth accounts. `run.mjs`
now **refuses to start** unless `FIREBASE_PROJECT_ID` names a `demo-` project, because the SDKs
refuse to contact a real backend for one; the isolation is structural, not a thing to remember.
`--against-real` exists and should essentially never be used.

The emulator starts **empty**, which is a feature: a driver that passed because another driver had
left a listing in the shared database was passing for the wrong reason. Each one seeds what it
needs.

**A shared primitive maps to everything, not to a list.** `manifest.mjs` also has
`SELECTS_EVERY_DRIVER`: touch `shared/ui/`, `shared/form/`, `app/globals.css` or `app/layout.tsx`
and `--since` selects the whole corpus. That exists because of a real miss — resizing the buttons
in six stage panels edits `shared/ui/button.tsx`, which is on every screen in the product, and
`--since` picked twelve drivers because the manifest happened to list only the two `shared/ui/`
components somebody had thought to map. Ten minutes of drivers costs less than a regression in a
button that appears everywhere. **Never map a shared primitive to a hand-written list of drivers**:
the list is wrong the day someone uses the component somewhere new.

**`--since` is the default move, not `pnpm e2e`.** `tests/e2e/manifest.mjs` maps each driver to
the paths it covers; adding the skeletons selects 14 drivers instead of all 32, and leaves out
`interview`, `guarantee`, `reminders` and `session`, which no `loading.tsx` can affect. **A new
driver needs an entry in that manifest** or `--since` will never select it — `pnpm e2e:env --since`
saying "nada que manejar" about a change you know is risky means the manifest is wrong, not that
there is nothing to drive.

For every feature, drive at least:

- the happy path end to end, and **assert on the real consequence** (cookie created, document
  written, final URL), not just that some text appears;
- one failure path (bad credentials, no permission, validation);
- 390px wide, checking there is no horizontal scrolling (`assertNoHorizontalScroll`);
- console with no `pageerror` (`assertQuiet`).

Three traps while driving. Scope your selectors to the form (`form [role="alert"]`) because the
`next dev` overlay also uses `role="alert"`. Wait for the button to return to its idle state
before reading the result, or you will capture the screen mid-submit. And **call `settled()`
after every navigation**: a `loading.tsx` answers before the content does, so asserting the
instant a URL resolves asserts the skeleton.

**Run the dev server with `RESEND_API_KEY=` empty.** Every stage movement sends a real email —
fifteen `notify()` calls — and a process walks nine stages, so a full driver run is dozens of
messages against Resend's **100 a day** on the free tier. It has already exhausted it once, and the
symptom is misleading: Resend answers `429 daily_quota_exceeded`, `requestSignatureCode` reports a
genuine delivery failure, and it reads like a product bug. Without the key `sendEmail` logs the
subject and carries on, which loses no coverage — the driver asserts the notification *happened*,
not that Resend accepted it.

If the feature touches real data, create the test data with the Admin SDK and **delete it when
you are done**, in the same step. One-off admin scripts go in the scratchpad, never the repo
root: `.c.mjs` and `verify-*.mjs` are gitignored because one of them got committed once, holding
service-account credentials and a loop that deletes accounts.

### When a driver fails, it is two questions, not one

The failure loop is where a session runs away. The rule:

1. **Is the product wrong, or is the driver wrong?** Answer this out loud before touching
   either. A driver that broke the moment you changed the product is evidence, not noise.
2. **Fix the product first.** Only if the driver is genuinely asserting something that is no
   longer true do you touch the driver — and then the edit goes in the report, by name, with
   what it used to assert and what it asserts now.
3. **Never weaken an assertion to make it pass.** If your own harness could not reproduce the
   condition (a throttle that did not bite, a race), the honest fix is a better wait, not a
   smaller claim. Deleting the assertion is the one move that makes the suite unable to fail.
4. **Two patch-and-rerun cycles, then stop and report.** If a third is needed, the harness is
   what is wrong, and grinding on it is how seventeen minutes disappear. Say what is red and
   why, and let the user decide.

If a change genuinely needs the same edit in more than two drivers, that edit belongs in
`tests/e2e/lib.mjs`. A sweep across many drivers is the signal that a helper is missing.

**And the corollary: an edit in `lib.mjs` is an edit to every driver.** `settled()` runs dozens
of times per driver, so anything put inside it is paid dozens of times. Adding a one-line
`addStyleTag` there to neutralise the dev overlay took `documents` from 74s to 104s and pushed it
past a 30s wait — a green driver turned red, and the cause was in a file its own diff never
touched. Per-page setup belongs behind a `WeakSet` guard or in `addInitScript`, never in the
per-navigation path. **After touching `lib.mjs`, re-run the slowest driver, not the fastest**:
`documents` is the one with the tightest timing budget.

### Don't restate a product rule inside a driver

The other way these break is a driver that hard-codes what the product computes. Three did:
`manage-properties` asserted a literal slug (`casa-amplia-con-patio-en-palermo-manizales`),
`publish` matched the whole expected slug with a regex, and `facets` compared card counts against
a total from the heading. Each was really a second copy of a product rule — slug composition,
page size — so making property titles unique per run broke all three at once, in files whose
own diff was one word.

**Ask the product for the value instead.** `manage-properties` now clicks "Copiar enlace" and
compares the clipboard with the URL the listing actually resolves to, so it asserts *this link
works*, not *I guessed the slug right*. `publish` asserts what the rule actually promises — only
`[a-z0-9-]`, the city at the end, and no opaque id glued on — instead of the exact string.
`facets` counts only what its own run published, which is what makes a count meaningful over a
catalogue other drivers also write to.

The tell: if an assertion would have to change when a product constant changes
(`CATALOG_PAGE_SIZE`, the slug format), it is duplicating the rule rather than checking it.

### Selectors: scope them, and match what the product exposes

The same accumulation breaks loose selectors. `pagination` looked for
`getByRole("link", { name: /Siguiente|2/ }).first()` across the whole page: fine on an empty
catalogue, and then as soon as a listing's accessible name contained a "2", the click went to a
property and the wait for `page=2` never arrived. The pager is a `<nav aria-label="Paginación">`,
so scope to it and use the label the product actually renders — "Siguientes", plural.

Two habits that avoid this whole class:

- **Scope before you match.** `getByRole("navigation", { name: "Paginación" })` then the link
  inside it. `.first()` over an unscoped locator is a guess about document order.
- **Match the accessible name, and check which attribute carries it.** `documents` counted
  pending buttons with `/^Aprobar /` against `textContent`, but the visible text is just
  "Aprobar" — the document name lives in `aria-label`. The count came back zero on the first
  pass, the approve loop exited immediately, and the driver failed later at a wait that looked
  unrelated. `getByRole({ name })` reads the accessible name; `textContent` does not.

### `settled()` is not `hydrated()`

After a `reload()` or a `goto()`, `settled()` only says the skeleton is gone — `hydrated()` is
what says someone is listening.

**But do not add `hydrated()` after every navigation.** Most interactions do not need it:
Playwright retries actionability, so a `fill` or a `click` that arrives early simply lands a
moment later. What cannot be retried is a **fire-and-forget event on an element that was already
actionable** — above all `setInputFiles`, which sets the files and dispatches `change` exactly
once. If React has not attached its handler yet, that event is gone and there is nothing left to
retry. One driver in the suite has this shape; a sweep would slow the other 31 for nothing.

That is exactly what produced the most expensive false positive in this suite. `session.mjs`
sets a file on the photo input right after a reload; without the hydration wait the `change`
event was dispatched into a page with no listener. No upload, no error, the wait timed out — and
the symptom looked precisely like a broken `ensureClientSession()`. It was reported as a product
bug and written into `CLAUDE.md` as one, and that claim had to be retracted. Instrumenting the
uploader with four `console.log`s showed the whole chain completing through `uploadBytes`: the
product had been fine the entire time.

**Before blaming the product, prove the driver reached it.** A few `console.log`s in the
component under suspicion, read through `page.on("console")`, answers in one run what an
afternoon of reasoning about the SDK will not. Take them out afterwards.

### Wait for the consequence, never for a duration

`documents` had `waitForTimeout(1500)` after each verdict, standing in for "the list finished
redrawing". Under load that was not enough: a click landed before the redraw, a verdict was lost,
and "Continuar a" never enabled — 73s green, 104s red, the only flaky driver in the suite. It now
waits for the number of pending approve buttons to drop. A fixed sleep in a driver is a race with
the timer set to whatever was long enough on the machine that wrote it.

---

## 7. Definition of "done"

Do not report the feature as finished without this:

### The always-run gate

```bash
pnpm verify        # arch → typecheck → lint → test, cheapest first, stops at the first failure
```

**Run it after every change, without deciding whether it applies.** It costs 14 seconds on the
whole repo and less when something is broken, because it is ordered so the cheapest check fails
first. Do not skip a piece of it to save time: `arch` is 1s, `typecheck` is 2s. The thinking about
whether to run them costs more than running them.

Note that `pnpm test` inside it runs the **whole** unit suite, not the files you touched, and that
is deliberate. The suite is 7 seconds and its job is to tell you what your change broke somewhere
else — `vitest related` cannot answer that question. Use `pnpm vitest <path>` while iterating on
one schema if you like; `pnpm verify` is still what says you are done.

### The two conditional ones

These are the only checks worth a decision, and the decision is `git diff --name-only`:

| Command | Cost | Run it when the diff touches |
| --- | --- | --- |
| `pnpm build` | 9s | anything in `app/`, `next.config.ts`, `proxy.ts`, a `'use client'` boundary, or a new import of `shared/firebase/admin.ts`. It is the only check that catches a `server-only` module reaching the browser and a route that fails to prerender. |
| `pnpm test:rules` | 9s | `firestore.rules`, `storage.rules`, `firestore.indexes.json`, or `tests/rules/`. **Mandatory, not optional, when it applies.** The script puts JDK 21 on the PATH itself; no `export` needed. |
| `pnpm e2e:env --since` | ~10s/driver | anything a driver covers (`tests/e2e/manifest.mjs`). This is the level that catches what compiles and still does not work — the soft 404 a `loading.tsx` causes was found here and nowhere else. |
| `pnpm typegen` | 3s | a route **moved or was renamed**. Then it is `rm -rf .next && pnpm typegen` first, or `tsc` fails on generated `PageProps` with an error unrelated to your change. |

Before reporting a feature finished, run everything once regardless:

```bash
pnpm verify:all    # verify + build + test:rules — ~32s for the entire bar
pnpm e2e           # and the browser drivers, all 32
```

### What the number to watch actually is

Optimizing *which commands run* buys back seconds. The failure this bar exists to prevent is a
feature that ships with nothing asserting it works, and no command tells you that — a green
`pnpm test` on 25 untouched files is green whether or not you wrote a test for what you just built.

So the check that belongs in the report is a count:

```bash
pnpm vitest run features shared 2>&1 | grep Tests    # before your change, and after
```

**The number must have gone up if you added a schema, a pure function or a state transition.** If
it did not, name the thing you built and say why it has no test — "it is all UI" is a real answer;
silence is not. The same rule with `pnpm test:rules` for a new collection.

Plus: the app running and the flow driven, screenshots you actually looked at, and the test data
deleted.

When you report, say explicitly: what is **not** done, which links point at routes that do not
exist yet, which decisions you made that the user should review, and what you could not verify
and why. A report that only lists what went well is an incomplete report.

---

## 8. Traps already paid for in this project

These cost time. Do not repeat them:

- **`bg-primary` is not for brand surfaces.** In dark mode `--primary` is cyan and a whole
  panel turns cyan. Use the `panel-marca` token (purple in both themes).
- **Dark mode is not active**: shadcn uses the class variant (`.dark`) and nothing adds it. The
  dark tokens exist and are correct, but today the app renders in light only. And the purple
  logo becomes illegible on a dark background: a reversed version would be needed.
- **`/` is the login.** The destination after authenticating can never be `/` or `/registro`:
  it would loop. `safeRedirect()` already rejects both, along with external URLs.
- **An unfiltered Firestore `list` is always denied**, even on an empty collection: the rule
  must be verifiable from the query. The public catalog **has** to query with
  `where("status", "==", "available")`.
- **`&&` binds tighter than `||`** in rules. `A && B || C` is `(A && B) || C`, and permissions
  slip through there. Always parenthesize.
- **In `create` there is no `resource`.** A helper using `resource.data` fails on creation.
- **react-hook-form's `watch()`** trips `react-hooks/incompatible-library`; use `useWatch`.
- **When moving or renaming routes, delete `.next`** and regenerate with `pnpm typegen`: the
  generated types still point at the old route and `tsc` fails with an error unrelated to your
  code.
- **`revalidateTag` requires a second argument** in Next 16. For read-your-writes use
  `updateTag` inside a Server Action.
- **`cookies()`, `headers()`, `params` and `searchParams` are async.** Always `await`.
- **Do not duplicate form markup.** `TextField`, `FormAlert`, `GoogleButton`, `OrDivider`,
  `SubmitButton` and `PasswordRequirements` exist. Repeating the `aria-describedby` by hand in
  every form ended up leaving a field whose error was computed and never rendered: an
  over-long password failed silently.
- **Do not pass JSX as a prop** (`alert={<p .../>}`) to share a piece of UI. Pass data
  (`error: string | null`) and let the child render it.
- **Import React types explicitly** (`import type { ReactNode }`), not `React.ReactNode`
  leaning on the global UMD namespace.
- **After `setCustomUserClaims`, re-mint the session cookie.** The cookie was signed before the
  claim: without `PATCH /api/session` the server keeps reading the old role. It showed up as a
  user who chose "landlord" and appeared as "tenant".
- **shadcn's `Label` ships `flex`.** For a prose label with links inside you have to pass
  `block`, or the text and the links stack as flex items.
- **`z.literal(true)` does not work as a form's default value**: its input type is `true` and
  the checkbox starts at `false`. Use `z.boolean().refine((v) => v === true)`.
- **Type `useForm` with input and output** (`useForm<z.input<S>, unknown, z.output<S>>`) when
  the schema transforms; otherwise `handleSubmit` does not fit.
- **Phones are stored in E.164 plus the country ISO.** The country is not derived from the
  number: `+1` is shared by four countries in the list. And if the validation depends on the
  country, the form must **revalidate the number when the selector changes**, or the previous
  country's error stays stuck even once the number is valid.
- **Do not pass components as props from a Server to a Client Component.** A lucide icon is a
  function and does not cross the RSC boundary: `Functions cannot be passed directly to Client
  Components`. Pass the already-created JSX element, or mark the parent `"use client"`.
- **The hour-based greeting is computed in the product's time zone**, not the server's: on
  Vercel the clock is UTC and at 8 p.m. in Bogotá it would say "Buenos días". Use
  `Intl.DateTimeFormat` with `timeZone: "America/Bogota"` and keep the function pure (it
  receives the hour, it does not read it).
- **The purple icon mark disappears on the purple panel.** Until a reversed version of the logo
  exists, it sits on a light chip.
- **Drive against `pnpm start`, not `next dev`**: the development overlay intercepts
  Playwright's clicks (`<nextjs-portal> subtree intercepts pointer events`).
- **Firebase's error is never shown raw.** Translate it with `shared/auth/errors.ts`, and let
  invalid credentials and unknown user share one message: otherwise the form doubles as an
  account enumerator.
