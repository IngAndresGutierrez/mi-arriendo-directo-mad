import type { ReactNode } from "react";
import Link from "next/link";

import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { Button } from "@/shared/ui/button";
import { TooltipProvider } from "@/shared/ui/tooltip";

/**
 * Chrome for the pages a tenant can reach without an account: the catalog and a property's
 * detail. Deliberately thin — a logo and a way in. The sidebar belongs to the product, and
 * showing it to someone with no session would promise sections they cannot open.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    // The price card renders a "coming soon" tooltip, and Radix needs its provider above it.
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href={LOGIN_ROUTE} aria-label="miarriendoDIRECTO.com, ir al inicio">
              <Logo width={170} preload />
            </Link>
            <Button asChild variant="outline" size="lg">
              <Link href={LOGIN_ROUTE}>Iniciar sesión</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </TooltipProvider>
  );
}
