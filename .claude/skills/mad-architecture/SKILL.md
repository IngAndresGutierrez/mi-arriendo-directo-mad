---
name: mad-architecture
description: Folder structure, module boundaries and structural refactors of miarriendodirecto.com. Use it before creating a new folder, whenever you are unsure where a file goes, when an import crosses from one domain to another, and for any bulk file move or rename ("this doesn't scale", "let's reorganize", "move everything into features/").
---

# MAD Architecture — where each file goes, and how it moves without breaking anything

This skill has **two modes**, deliberately inseparable:

- **Contract mode** (§1–§4): the target shape and the boundaries. `mad-feature` consults it on
  every new feature. It is the single source of truth for "where does this go".
- **Migration mode** (§5–§8): how to get the repo from where it is to that shape, in
  verifiable slices. A structural refactor with no protocol produces a 200-file commit nobody
  can review and nobody dares revert.

If you do the refactor and do not leave the boundary **enforced** (§3), the structure drifts
again within three features. Moving folders is the easy part, and the part that does not last.

---

## 1. The target shape

The split is **vertical, by domain**, not horizontal by technical layer. The symptom of a
horizontal split (`lib/domain/`, `lib/validations/`, `lib/data/` side by side) is that adding
`application` means touching five folders, and deleting it means remembering five places.

```
app/                      ROUTING ONLY. Thin page/layout/route: session, data, composition
  (auth)/                 route group — does not change the URL
  (app)/                  route group of the authenticated product
  api/<x>/route.ts

features/<domain>/        profile, property, application, contract, payment…
  domain/                 pure types and rules (XInput / XDoc / X), no Firebase, no React
  validations/            the domain's Zod schemas
  data/                   server reads with the Admin SDK, serialized to POJOs
  actions/                "use server": mutations
  ui/                     the domain's components (Server by default)
  *.test.ts               unit tests colocated with what they cover
  index.ts                the module's PUBLIC API — the only thing importable from outside

shared/                   cross-cutting, owned by no domain
  ui/                     shadcn primitives and visual compositions. ZERO logic, ZERO data
  form/                   pre-wired fields (label + error + ARIA): TextField, PhoneField…
  shell/                  the app chrome: sidebar, auth-shell, sign-out button
  brand/                  logo
  auth/                   session, guards, routes, Firebase Auth errors, auth client
  firebase/               app, auth, db, storage, admin, analytics
  format/                 money, dates, greetings — pure
  phone/                  country catalog and E.164 rules
  lib/                    utils (cn)

tests/rules/              security rules — they test firestore.rules, not a feature
```

Two criteria for deciding whether something is `features/` or `shared/`:

- **Two domains use it → `shared/`.** Login and onboarding both use `SubmitButton`: it is
  shared. Leave it inside `features/auth/ui/` and `features/profile` has to import `auth`'s
  internals — the boundary collapses on day one.
- **Name the domain, not the screen.** `features/contract`, not `features/home`. A screen
  composes domains; a domain does not belong to a screen.

A single-file module may sit loose at the root of `shared/` (`shared/analytics.tsx`); creating
a folder for one file only adds noise. Not in `features/`: there the layers are fixed.

`index.ts` is not a convenience barrel: it is the list of what the rest of the repo may use.
If something is not in it, it is internal and can change without searching the whole repo.

---

## 2. The boundaries

| Zone | May import | Never |
| --- | --- | --- |
| `app/**` | `@/features/<x>` (the index), `@/shared/**` | a feature's internals (`@/features/x/data/…`) |
| `features/<a>/**` | its own files by **relative path**, `@/shared/**`, and `@/features/<b>` (index) | `@/app/**`, another feature's internals |
| `features/*/domain` | nothing from the project except `@/shared/format` | Firebase, React, `next/*` |
| `shared/ui/**` | `@/shared/lib`, `@/shared/ui` | `@/features/**`, `@/app/**`, `@/shared/firebase/**`, data |
| `shared/form/**` | `@/shared/{ui,lib,phone,format}` | `@/features/**`, `@/shared/firebase/**` |
| `shared/**` | `@/shared/**` | `@/features/**`, `@/app/**` |
| `shared/firebase/admin` | — | any file that is not `*/data/*`, `*/actions/*`, `app/api/*` or `shared/auth/*` |

Why each one matters:

- **A feature cannot reach another's internals**, or `index.ts` is decorative and any internal
  refactor breaks a neighbour. When two domains genuinely need each other, the composition
  happens in `app/`, the only place that knows them all.
- **`shared/` does not import `features/`** because that arrow is a cycle, and a cycle turns
  "I delete this feature" into "the build no longer compiles".
- **`domain/` does not import Firebase** because it is the only thing testable in milliseconds
  without an emulator. It is where the rent calculation lives, not the `getDoc`.
- **`admin` is fenced in** because `import "server-only"` warns you once you have already
  written the import in a client component; the lint rule warns you before.

---

## 3. Enforced boundaries (this is the part that lasts)

### `tsconfig.json` — kill the wildcard

```jsonc
"paths": {
  "@/app/*": ["./app/*"],
  "@/features/*": ["./features/*"],
  "@/shared/*": ["./shared/*"]
}
```

With `"@/*": ["./*"]` every file can reach every file and none of the rules below can even be
expressed. In a refactor it goes in two steps: **add** the three aliases in the first slice
(they coexist with the wildcard) and **delete the wildcard in the last one**, once
`grep -rn '@/lib/\|@/components/' app features shared tests` returns nothing. Deleting it
earlier breaks every import you have not moved yet.

### `eslint.config.mjs` — the rule that saves you most often

Inside a feature you import by **relative path**; `@/features/…` is reserved for crossing
module boundaries, which makes "deep import" a synonym for "boundary violation":

```js
const CROSS_FEATURE = {
  group: ["@/features/*/*", "@/features/*/**"],
  message: "Import the module's public API (@/features/<domain>), not its internals.",
};
const NO_ADMIN = {
  group: ["@/shared/firebase/admin"],
  message: "The Admin SDK is only used in data/, actions/, app/api/ and shared/auth/.",
};
const NO_UPWARD = {
  group: ["@/features/**", "@/app/**"],
  message: "shared/ is cross-cutting: it cannot depend on a feature or on a route.",
};

// …after nextVitals and nextTs, and in this order (the last match wins):
{ rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE, NO_ADMIN] }] } },
{ files: ["shared/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE, NO_ADMIN, NO_UPWARD] }] } },
{ files: ["**/data/**", "**/actions/**", "app/api/**", "shared/auth/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE] }] } },
```

`no-restricted-imports` is **one single rule**: in flat config the last matching object
replaces it entirely, it does not merge. That is why each override repeats the full list that
does apply. A Server Action file called `actions.ts` (Next's own convention for a route's
mutations) counts as the mutation layer too, so the admin zone lists it.

### `pnpm arch` — what lint cannot see

`no-restricted-imports` sees neither cycles nor "who imports whom" in general. Add
`dependency-cruiser` as a devDependency with rules for cycles, `shared → features`,
`domain → firebase` and orphans. It joins the verification bar next to `typecheck`. Pin
v16 while the toolchain runs Node 20: v18 requires Node 22+.

### `components.json` — or `shadcn add` recreates `components/`

The shadcn aliases must point at the new shape, or the next `shadcn add` writes into
`components/ui/` and a second copy of the primitives appears:

```jsonc
"aliases": { "components": "@/shared", "ui": "@/shared/ui", "lib": "@/shared/lib", "utils": "@/shared/lib/utils", "hooks": "@/shared/hooks" }
```

### `vitest.config.ts` — colocated tests have to be included

If `include` is `["tests/**/*.test.ts"]`, a test inside `features/` **does not run and nobody
notices**. Widen it to `["features/**/*.test.ts", "shared/**/*.test.ts", "tests/**/*.test.ts"]`,
point `pnpm test` at the colocated ones (`vitest run features shared`) and leave
`pnpm test:rules` as it is. Check that the test count after the refactor is **equal or higher**
than before; if it dropped, a file fell outside the `include`.

---

## 4. Contract mode: where a new file goes

In order; the first yes wins:

1. Is it a route, a layout or a route handler? → `app/`. And nothing else: the logic goes down
   into a feature.
2. Is it a visual primitive with no domain (`Button`, `TextField`)? → `shared/ui/`.
3. Will two domains use it? → `shared/<area>/`.
4. Does it name a business domain? → `features/<domain>/<layer>/`.
5. If you cannot name the domain, you do not yet know what you are building. Go back to §2 of
   `mad-feature` (the inventory) before creating the file.

A new file inside a feature **is not exported from `index.ts` by default**. It is added only
when someone outside genuinely needs it.

---

## 5. Migration mode: the protocol

This is not optional. A structural refactor that skips the protocol turns into an afternoon of
`tsc` shouting about generated routes that no longer exist.

1. **Leave the tree clean before starting.** `git status` with nothing pending. A half-finished
   behaviour change mixed into a 50-file move produces a diff nobody can review and a revert
   nobody can perform.
2. **Write the move map first**, in a file, before touching anything: source → destination for
   every file, plus the import graph (`grep -rn 'from "@/' app components lib tests`). The map
   is what gets reviewed; the `git mv`s are mechanical.
3. **Scaffolding before moving** (§3): paths, lint zones, `components.json`, `vitest`. That way
   the first slice is already validated against the new boundary.
4. **One vertical slice per commit.** One domain, or one layer of `shared/`, complete. Never a
   big bang. Never two domains in the same commit.
5. **`git mv`, not copy-and-delete**: it preserves the history and the file's `git log --follow`.
6. **Rewrite the imports from the map, not by hand.** One `sed` per move rule over the matching
   files. By hand you always forget the same one: a test's import.
7. **Zero behaviour changes in a move commit.** If you spot a bug along the way, or a component
   that should be split, write it down and do it in a separate commit afterwards. A structural
   refactor where you also "took the chance to fix something" loses its one valuable property:
   that if something breaks, you know the move caused it.
8. **Update the documentation in the same PR**: the route and component tables in `CLAUDE.md`,
   and `mad-feature`. Documentation pointing at `components/auth/…` when the file already lives
   in `features/auth/ui/…` is worse than no documentation: the next agent creates the file again
   in the old place.

---

## 6. Invariants a folder refactor may NOT touch

A file move must be **zero risk** for whatever is already in production. If the diff touches
any of these, it stopped being a refactor:

- **Firestore collection names** (`users`, `contracts`) and **custom claims** (`role`). They
  live in the deployed rules and in the existing documents. Renaming them is a data migration
  with its own script, its own rules deploy and its own commit — never a side effect of a move.
- **`firestore.rules`, `storage.rules`, `firestore.indexes.json`.** Not moved, not edited.
- **The URLs.** A route group (`app/(auth)/`) does not change the URL; renaming a segment
  folder does. The constants in `routes.ts` change their import, never their value.
- **Each module's public surface**: if `index.ts` re-exports under the same name, the rest of
  the repo does not notice the move. Renaming and moving at once doubles the risk.

---

## 7. Verification, per slice (not at the end)

After **every** commit of the refactor, not once at the end:

```bash
rm -rf .next          # the generated route types point at the old structure
pnpm typegen          # next typegen — regenerates them in seconds, no full build
pnpm typecheck
pnpm lint             # boundary violations show up here
pnpm arch             # cycles and forbidden arrows
pnpm test             # and compare the COUNT with the pre-refactor one
pnpm build
```

And once the last slice is done, drive the app (the `run` skill): login, signup, onboarding and
`/inicio`. A refactor can leave `tsc` green and still break the app at runtime in three ways the
compiler cannot see: a `"use client"` left in the wrong file when a component was split, an
`import "server-only"` that now reaches a client tree, and a route whose URL changed without
anyone noticing.

---

## 8. Traps specific to this refactor

- **`rm -rf .next` after moving or renaming routes.** It is already in §8 of `mad-feature` and
  it is the first one to bite: `tsc` fails with an error unrelated to your change. And deleting
  it **without regenerating** fails just the same: `PageProps` and `LayoutProps` are generated
  types, so the order is `rm -rf .next` → `pnpm typegen` → `pnpm typecheck`.
- **`shadcn add` recreates `components/ui/`** if you did not update `components.json` (§3). The
  symptom is two different `Button`s and a `cn` imported from two places.
- **vitest's `include`** stops covering the colocated tests and the suite goes green with half
  of them. Compare counts.
- **`tests/rules/` does not move into a feature.** It tests the rules, which are a global file.
- **vitest's alias** (`resolve.alias`) keeps its own copy of the paths: change `tsconfig.json`
  and not `vitest.config.ts` and `pnpm typecheck` passes while `pnpm test` cannot resolve.
- **Route groups do not change the URL**, but `app/(auth)/page.tsx` and `app/(app)/page.tsx` do
  collide: two groups cannot resolve the same route.
- **A client form importing from `data/`** drags `firebase-admin` into the bundle. If
  `pnpm build` suddenly grows after a slice, this is why.
- **Do not move `app/globals.css`.** `components.json` references it and the import in
  `layout.tsx` is relative.
