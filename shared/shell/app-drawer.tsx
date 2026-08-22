"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";

import { HOME_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

import { AppNav } from "./app-nav";

/**
 * The navigation on a narrow screen: a bar with the hamburger, and the menu in a drawer.
 *
 * It is `lg:hidden`, and from `lg` up `AppSidebar` shows the same sections without a click.
 * The drawer is what a phone needs — 250px of permanent menu would leave nothing for the
 * property form — and exactly what a wide screen does not.
 */
export function AppDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6 lg:hidden">
        <SheetTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Abrir menú">
            <MenuIcon className="size-5" aria-hidden="true" />
          </Button>
        </SheetTrigger>

        <Link href={HOME_ROUTE} aria-label="Ir al inicio" className="flex items-center">
          <Logo width={150} preload className="hidden sm:block" />
          {/* On a phone the wordmark would eat the bar; the icon mark carries the brand. */}
          <Image
            src="/isotipo.png"
            alt="miarriendoDIRECTO.com"
            width={1254}
            height={1254}
            preload
            sizes="32px"
            className="h-auto w-8 sm:hidden"
          />
        </Link>
      </header>

      <SheetContent
        side="left"
        showCloseButton={false}
        overlayClassName="bg-foreground/50"
        className="w-72 gap-0 border-r-0 bg-brand-panel p-0 text-brand-panel-foreground"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <SheetTitle asChild>
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-panel-foreground">
              {/*
                The icon mark's strokes are purple and would vanish against the panel, so it
                sits on a light chip, as in the sidebar.
              */}
              <Image
                src="/isotipo.png"
                alt="miarriendoDIRECTO.com"
                width={1254}
                height={1254}
                sizes="32px"
                className="h-auto w-8"
              />
            </span>
          </SheetTitle>

          <SheetClose asChild>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="rounded-lg p-2 text-brand-panel-muted transition-colors hover:bg-white/5 hover:text-brand-panel-foreground focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </button>
          </SheetClose>
        </div>

        <AppNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
