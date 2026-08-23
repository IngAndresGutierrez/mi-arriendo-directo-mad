"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import { HOME_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { AppNav } from "./app-nav";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
  sidebarCookieValue,
} from "./sidebar-state";

/**
 * The menu, always visible from `lg` up, in one of two widths.
 *
 * It starts narrow — icon over label, which is enough to navigate by — and opens to the full
 * labels when asked. The choice sticks, because a menu that reverts to something you did not
 * pick is a menu you have to fix on every visit. It is stored in a cookie so the server sends
 * the width it already knows about instead of the page jumping open after hydration.
 *
 * Below `lg` this is not rendered and `AppDrawer` takes over.
 */
export function AppSidebar({ defaultCollapsed }: { readonly defaultCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${sidebarCookieValue(next)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }

  const Icon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  const label = collapsed ? "Expandir menú" : "Contraer menú";

  return (
    <div
      data-slot="app-sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col bg-brand-panel text-brand-panel-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-24" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-4",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <Link
          href={HOME_ROUTE}
          aria-label="Ir al inicio"
          className="flex shrink-0 items-center rounded-xl focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none"
        >
          {/*
            Both marks are half purple (#330852) on transparent, and the panel is purple
            (#2d124d): "miarriendo" against it is contrast 1.05, which is not dim, it is
            absent. So on this surface the brand always sits on a light chip. Until a
            reversed logo exists, this is what keeps it legible.

            Which mark goes in the chip is the only thing the width decides: opened there is
            room for the full lockup, and collapsed there is room for the icon alone.
          */}
          <span
            className={cn(
              "flex items-center justify-center rounded-xl bg-brand-panel-foreground",
              collapsed ? "size-11" : "px-3 py-2",
            )}
          >
            {collapsed ? (
              <Image
                src="/isotipo.png"
                alt="miarriendoDIRECTO.com"
                width={1254}
                height={1254}
                preload
                sizes="32px"
                className="h-auto w-8"
              />
            ) : (
              <Logo width={132} preload />
            )}
          </span>
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggle}
              aria-label={label}
              aria-expanded={!collapsed}
              className="rounded-lg p-2 text-brand-panel-muted transition-colors hover:bg-white/5 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none"
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </div>

      <AppNav collapsed={collapsed} />
    </div>
  );
}
