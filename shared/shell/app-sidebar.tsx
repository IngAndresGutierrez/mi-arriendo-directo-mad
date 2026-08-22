"use client";

import Image from "next/image";
import Link from "next/link";

import { HOME_ROUTE } from "@/shared/auth/routes";

import { AppNav } from "./app-nav";

/**
 * The menu, always visible, from `lg` up.
 *
 * A wide screen has the room, and hiding the sections behind a click there costs one on every
 * navigation while buying nothing: the drawer earns its keep on a phone, where the width is
 * genuinely scarce. Below `lg` this is not rendered and `AppDrawer` takes over.
 */
export function AppSidebar() {
  return (
    <div
      data-slot="app-sidebar"
      className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-brand-panel text-brand-panel-foreground lg:flex"
    >
      <Link
        href={HOME_ROUTE}
        aria-label="Ir al inicio"
        className="flex items-center gap-3 px-4 py-4 focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none"
      >
        {/*
          The wordmark is purple on transparent and would vanish against the panel, so on this
          surface the brand is the icon mark on a light chip. Until a reversed logo exists,
          this is how it stays legible.
        */}
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-panel-foreground">
          <Image
            src="/isotipo.png"
            alt="miarriendoDIRECTO.com"
            width={1254}
            height={1254}
            priority
            sizes="32px"
            className="h-auto w-8"
          />
        </span>
      </Link>

      <AppNav />
    </div>
  );
}
