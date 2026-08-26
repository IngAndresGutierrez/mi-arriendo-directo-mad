"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * The current locale, for the half of the product that cannot read a root param.
 *
 * It carries **the locale and nothing else** — a two-character string. The dictionary deliberately
 * does not travel in here: importing `shared/i18n/dictionary` from a Client Component pulls every
 * language into the browser bundle, and putting it in a context would do the same thing through the
 * RSC payload on every single page. Client components get the slice they need as a prop from their
 * server parent, which is the rule this project already follows for everything else that crosses
 * that boundary.
 *
 * What the locale alone is enough for is the thing every client component needs: `LocaleLink`,
 * so a click inside an English page stays in English.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/**
 * The locale of the page this component is rendering in.
 *
 * Defaults to Spanish rather than throwing when there is no provider: the provider is in the root
 * layout, so its absence means a test or a Storybook-style harness rendering a component on its
 * own, and a link that points at the Spanish page is a better outcome there than a crash.
 */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
