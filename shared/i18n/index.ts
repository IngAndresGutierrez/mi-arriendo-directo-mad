/**
 * The public entry of the i18n module.
 *
 * `server.ts` is **not** re-exported here: it imports `next/root-params`, which fails at build time
 * inside a Client Component, and a barrel that dragged it in would make this module unimportable
 * from the client half of the product. Server code imports `@/shared/i18n/server` directly — the
 * same split, and for the same reason, as `shared/firebase/admin.ts` never appearing in a barrel.
 */
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_HTML_LANG,
  LOCALE_NAMES,
  LOCALE_OG,
  isLocale,
  localeHref,
  localeFor,
  negotiateLocale,
  splitLocale,
  type Locale,
} from "./locale";

export { dictionaryFor, dictionaryForUnknown, type Dictionary } from "./dictionary";
export { LocaleProvider, useLocale } from "./locale-context";
export { LocaleLink } from "./locale-link";
