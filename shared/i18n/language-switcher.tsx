"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";

import { LOCALES, LOCALE_NAMES, localeHref } from "./locale";
import { useLocale } from "./locale-context";

/**
 * The control that changes language: a menu listing every language, with the current one ticked.
 *
 * **It was a toggle first, and the toggle was wrong for a reason worth writing down.** With two
 * locales, "the other one" is a single link — fewer clicks, no open state, no portal. What it could
 * not do is *say what it is*: a button reading "English" on a Spanish page is ambiguous between "you
 * are reading English" and "switch to English", and it never shows that Spanish is an option at all.
 * A menu answers both by listing the choices and ticking the one in force, which is also why the
 * account menu beside it is a menu. It was reported from the screen as "no se puede elegir".
 *
 * **Every item is a plain `<a>`, which makes this the one hard navigation in the product.** Three
 * things have to change that a soft navigation would not reliably do: `<html lang>`, which lives on
 * the document; the `locale` cookie, which `proxy.ts` writes from the path and which only a real
 * request reaches; and every string rendered by a Server Component above this one. A `<Link>` here
 * would sometimes leave a page half-translated in a way that reads like a caching bug, so one full
 * page load — on an action taken once — is paid on purpose.
 *
 * Each language is named **in itself**: "English" on a Spanish page, "Español" on an English one.
 * Naming them in the current language ("Inglés") is unreadable to exactly the person reaching for
 * the control, and a flag names a country rather than a language.
 */
export function LanguageSwitcher({
  ariaLabel,
  className,
}: {
  /**
   * The trigger's accessible name — "Idioma" / "Language" — resolved by the server.
   *
   * **A finished string and not the `language` dictionary slice**, and that distinction cost a 500
   * on every page in the product once. Parameterised copy in the dictionary is a *function*, and a
   * function cannot be handed from a Server Component to a Client Component: React answers
   * "Functions cannot be passed directly to Client Components". `pnpm build` compiles it happily.
   */
  readonly ariaLabel: string;
  readonly className?: string;
}) {
  const current = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /*
   * `usePathname()` is the URL the visitor sees, not the route that rendered it — `/inmuebles`, even
   * though `proxy.ts` rewrote it to `/es/inmuebles`. That is what makes this right without the
   * switcher having to know the rewrite exists, and `localeHref` strips whatever prefix is there
   * before applying the target's, so it works from either side.
   *
   * The query comes along because on the catalogue it *is* the page: the URL holds every filter, and
   * a language switch that silently cleared them would throw away the search somebody just built.
   */
  const query = searchParams.toString();
  const hrefFor = (locale: (typeof LOCALES)[number]) =>
    `${localeHref(locale, pathname)}${query ? `?${query}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" className={className} aria-label={ariaLabel}>
          <GlobeIcon className="size-4" aria-hidden="true" />
          {/*
            The current language on the trigger, so the control says what is in force without being
            opened. The full name from `sm` up and the bare code on a phone, where the header is
            competing for room with the way into the product; `aria-label` carries the name either
            way, so the short form never leaves a screen reader with two letters.
          */}
          <span className="hidden sm:inline">{LOCALE_NAMES[current]}</span>
          <span aria-hidden="true" className="uppercase sm:hidden">
            {current}
          </span>
          <ChevronDownIcon className="size-4 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} asChild>
            {/*
              `lang` on the anchor so the name is pronounced in its own language, and `aria-current`
              rather than only a tick: the check is a glyph a screen reader does not announce.
            */}
            <a
              href={hrefFor(locale)}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className="flex items-center justify-between gap-3"
            >
              {LOCALE_NAMES[locale]}
              {locale === current && <CheckIcon className="size-4" aria-hidden="true" />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
