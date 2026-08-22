import type { ReactNode } from "react";

import { AppDrawer } from "@/shared/shell/app-drawer";
import { AppSidebar } from "@/shared/shell/app-sidebar";
import { TooltipProvider } from "@/shared/ui/tooltip";

/**
 * The frame every product screen sits in: the menu — fixed from `lg`, a drawer below it — and
 * the content.
 *
 * It exists so the four screens stop repeating the same layout; one of them had already
 * drifted a container width apart from the others. Pages bring only what is theirs: their
 * heading and their content, inside whatever max-width they need.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppDrawer />

          {/*
            The cap keeps the reading width sane on a wide monitor — without it a single card
            stretched the whole viewport. Pages that want to be narrower still centre inside it.
          */}
          <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
