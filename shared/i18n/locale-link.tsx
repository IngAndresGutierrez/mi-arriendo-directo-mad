"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { localeHref } from "./locale";
import { useLocale } from "./locale-context";

type NextLinkProps = ComponentProps<typeof Link>;

/**
 * `<Link>`, in the language of the page it is on.
 *
 * **This is what stops a click from silently changing language.** The routes are Spanish words and
 * Spanish is the unprefixed locale, so a plain `<Link href={PROPERTIES_ROUTE}>` pressed on
 * `/en/inmuebles` navigates to `/inmuebles` — the Spanish catalogue. Nothing errors, nothing looks
 * broken; the reader just finds themselves back in Spanish, having pressed a link that looked like
 * it belonged to the page they were on. No type checker can see that, which is why it is a
 * component and not a convention: `shared/auth/routes.ts` keeps handing out canonical Spanish
 * paths, and exactly one place turns them into the current language.
 *
 * A drop-in replacement, on purpose — the migration from `next/link` is the import line and nothing
 * else. It passes everything through and rewrites only the `href`, and only when the href is an
 * internal absolute path: `localeHref` leaves a `mailto:`, a `tel:`, an absolute URL and a bare
 * `#etapa-guarantee` exactly as they were, so a call site does not have to know which kind it holds.
 *
 * It is also **idempotent**, which matters more than it sounds: a component that already localised
 * its href — or a route constant that someone hard-codes with a prefix one day — does not end up at
 * `/en/en/inmuebles`. `locale.test.ts` pins that.
 */
export function LocaleLink({ href, ...rest }: NextLinkProps) {
  const locale = useLocale();

  /*
   * A `UrlObject` is handled rather than passed through: `<Link href={{ pathname, query }}>` is a
   * legitimate shape, and leaving it alone would be a silent hole in exactly the guarantee above.
   */
  const localized =
    typeof href === "string"
      ? localeHref(locale, href)
      : typeof href?.pathname === "string"
        ? { ...href, pathname: localeHref(locale, href.pathname) }
        : href;

  return <Link href={localized} {...rest} />;
}
