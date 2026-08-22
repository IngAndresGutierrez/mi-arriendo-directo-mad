import type { ReactNode } from "react";

import { AppDrawer } from "@/shared/shell/app-drawer";
import { TooltipProvider } from "@/shared/ui/tooltip";

/**
 * The frame every product screen sits in: the navigation bar, its drawer, and the content.
 *
 * It exists so the four screens stop repeating the same layout — one of them had already
 * drifted a container width apart from the others. Pages bring only what is theirs: their
 * heading and their content, inside whatever max-width they need.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <AppDrawer />

        {/*
          Without the old rail the content had the whole viewport, and on a wide monitor a
          card stretched edge to edge. The cap keeps the reading width sane; pages that want
          to be narrower still centre inside it.
        */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
