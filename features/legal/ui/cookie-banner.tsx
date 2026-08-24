"use client";

import { COOKIES_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { Button } from "@/shared/ui/button";

/**
 * The one time this product asks about cookies.
 *
 * **Two real buttons.** A banner whose only control accepts is not collecting an authorisation,
 * it is announcing one — and Ley 1581 requires consent to be free. "Solo las necesarias" is a
 * first-class answer sitting beside "Aceptar", not a link in the small print.
 *
 * **Neither button is `accent`.** This renders over every page in the product, including ones with
 * their own cyan CTA, and two cyan buttons on a screen is none — the same rule that keeps the
 * notification bell in `brand`. So "Aceptar" is `brand` and "Solo las necesarias" is `outline`:
 * clearly the two controls, clearly not competing with whatever the page is actually for.
 *
 * It says what the optional category *is* rather than "usamos cookies para mejorar tu
 * experiencia", which describes nothing and is what everybody writes.
 */
export function CookieBanner({
  onAcceptAll,
  onRejectOptional,
}: {
  readonly onAcceptAll: () => void;
  readonly onRejectOptional: () => void;
}) {
  return (
    <div
      /*
       * `region` with a name rather than `dialog`: it does not trap focus and must not. A modal
       * over the catalogue would make the cookie question a toll gate on a public page, and
       * somebody who just wants to read a listing should be able to.
       */
      role="region"
      aria-label="Uso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Usamos cookies necesarias para mantener tu sesión y recordar cómo dejaste el menú. Con tu
          permiso usamos también cookies de <strong className="font-medium">analítica</strong>, que
          nos dicen qué páginas se usan. Puedes cambiar de opinión cuando quieras en{" "}
          <NewTabLink href={COOKIES_ROUTE} className="underline underline-offset-2 hover:text-foreground">
            Cookies
          </NewTabLink>
          .
        </p>

        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="xl" onClick={onRejectOptional}>
            Solo las necesarias
          </Button>
          <Button type="button" variant="brand" size="xl" onClick={onAcceptAll}>
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
