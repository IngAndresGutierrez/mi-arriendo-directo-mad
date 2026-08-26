import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";
import { es, type Dictionary } from "./messages/es";
import { en } from "./messages/en";

export type { Dictionary };

/**
 * Every language, keyed by locale.
 *
 * A plain object and **not** a lazy `import()` per locale, which is what Next's own i18n guide
 * shows. That shape exists to keep translation files out of the client bundle, and it buys nothing
 * here: this product's copy is reached from Server Components, from Server Actions and from
 * `notify()` — which runs inside `after()` with no route and no root params at all — and a dynamic
 * `import()` cannot be awaited from a synchronous label map. The whole dictionary is a few tens of
 * kilobytes on the server, where it costs nothing.
 *
 * What it *would* cost is a Client Component importing this module directly: that pulls **both**
 * languages into the browser bundle. So client components are handed the slice they need as a prop
 * from their server parent — the project's existing rule ("pass data, let the child render it"),
 * which happens to be exactly what keeps this honest.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * The dictionary for a value that is not yet known to be a locale — a `params` segment, a stored
 * profile field, an `Accept-Language` guess.
 *
 * It falls back rather than throwing, and that direction is deliberate: this is called from the
 * root layout and from the email sender, and neither is a place where an unrecognised language
 * should take down the page or swallow the notification. Spanish is the product's own language, so
 * the fallback is never wrong, only occasionally not what was asked for.
 */
export function dictionaryForUnknown(value: unknown): Dictionary {
  return dictionaryFor(isLocale(value) ? value : DEFAULT_LOCALE);
}

/**
 * The namespaces that are **never** handed whole to a Client Component.
 *
 * **This is an opt-out list, and it used to be an opt-in one — that inversion is the fix.** The rule
 * is that a namespace crossing the RSC boundary may hold only plain strings: a function cannot cross,
 * React answers *"Functions cannot be passed directly to Client Components"*, and the page 500s.
 * `dictionary.test.ts` enforces it.
 *
 * With an allowlist (`CLIENT_SAFE`) the default was *unchecked*, so the guard covered a namespace
 * only if somebody remembered to register it — and the fourth outage in this codebase was exactly
 * that: `dossier` was added, passed to `DossierFields`, and never listed. Now every namespace is
 * checked unless it is named here, so forgetting produces a **red test**, not a broken page. Adding
 * a name to this list is a deliberate claim that nothing client-side ever receives it whole.
 *
 * The four that preceded it, all of which compiled cleanly: `language` carrying `switchTo`,
 * `property` carrying `found`, `auth` carrying `resetSentTo`, and `dossier` carrying `previewOf`.
 *
 * Two ways to keep a namespace plain when a value has to be substituted: resolve it on the server
 * and pass the finished string — `CatalogToolbar` takes `foundLabel` — or split it into the pieces
 * around the value, as `auth.resetSentToBefore` / `resetSentToAfter` do when the value is client
 * state.
 */
export const SERVER_ONLY_NAMESPACES = [
  "catalog",
  "email",
  "landing",
  "notify",
  "portal",
  "property",
  "propertySeo",
] as const;
