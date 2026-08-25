import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { COLLABORATOR_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { LegalFooter } from "@/shared/shell/legal-footer";

export const metadata: Metadata = {
  /*
   * Not a search result. This whole area is one person's work list, reachable only with a code sent
   * to their phone — the same `noindex` the product's own screens carry, for the same reason.
   */
  robots: { index: false, follow: false },
};

/**
 * The collaborator's frame: the brand, their work, and nothing else.
 *
 * **Deliberately not `AppShell`.** That one carries the product's menu — Inicio, Inmuebles,
 * Contratos, Arriendos — and every one of those sections is a door this person cannot open. A
 * sporadic collaborator who is shown eight links to places that will bounce them has been handed a
 * worse screen than one with no menu at all, and the request was explicit: they see their errands
 * and nothing more.
 *
 * So there is no navigation here, only the mark. It is not a link either — there is nowhere else to
 * go, and a logo that navigates to the page you are already on is a control that does nothing.
 * `look and feel` is kept by using the same tokens, the same shell width and the same footer as
 * everywhere else, which is what makes it recognisably the same product rather than a copy of it.
 */
export default function CollaboratorLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href={COLLABORATOR_ROUTE} aria-label="miarriendoDIRECTO.com, tus encargos">
            <Logo width={160} preload />
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Encargos</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>

      <div className="mx-auto w-full max-w-3xl px-6">
        <LegalFooter />
      </div>
    </div>
  );
}
