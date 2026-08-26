import { LOCALES, LOCALE_NAMES } from "./locale";

/**
 * The languages, as `SelectField` wants them.
 *
 * Derived from `LOCALES` rather than written out, so adding a third locale does not leave a form
 * silently offering two. Each language is named **in itself** — the same rule the switcher follows
 * and for the same reason: "Inglés" is unreadable to whoever is reaching for English.
 *
 * It is a module of its own and not part of `locale.ts` because that file is imported by `proxy.ts`,
 * which runs before every request in the product: a shape that exists purely for a form has no
 * business being in it.
 */
export const LOCALE_OPTIONS = LOCALES.map((locale) => ({
  value: locale,
  label: LOCALE_NAMES[locale],
}));
