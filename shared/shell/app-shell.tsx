import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AppDrawer } from "@/shared/shell/app-drawer";
import { AppSidebar } from "@/shared/shell/app-sidebar";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { isSidebarCollapsed, SIDEBAR_COOKIE } from "./sidebar-state";

/**
 * The frame every product screen sits in: the menu — fixed from `lg`, a drawer below it — and
 * the content.
 *
 * `bell` is a slot, not data. `shared/` is cross-cutting and may not depend on a feature, so
 * the notification bell is composed by the route group's layout, which can. (This is a
 * composition slot in the React sense, not the "pass JSX instead of data" mistake the project
 * warns about: the shell is not rendering someone else's UI on their behalf, it is leaving a
 * hole for it.)
 *
 * The menu's width is read here, on the server, so it renders correct on the first paint.
 * These routes are already dynamic — they all read the session cookie — so this costs nothing.
 */
export async function AppShell({
  children,
  bell,
  showErrands = false,
}: {
  readonly children: ReactNode;
  readonly bell?: ReactNode;
  /** Whether this person has properties: it decides the one conditional menu entry. */
  readonly showErrands?: boolean;
  /**
   * Whether the menu offers "Encargos".
   *
   * Data and not a slot: the shell is not rendering somebody else's UI, it is deciding whether one
   * of its own entries exists. Resolved by the route group's layout, which may depend on a feature
   * — `shared/` may not.
   */
}) {
  const collapsed = isSidebarCollapsed((await cookies()).get(SIDEBAR_COOKIE)?.value);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar defaultCollapsed={collapsed} showErrands={showErrands} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppDrawer bell={bell} showErrands={showErrands} />

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
