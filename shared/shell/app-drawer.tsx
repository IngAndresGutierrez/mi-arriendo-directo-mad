"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, a function cannot
// cross the Server → Client boundary, and the drawer owns its open state.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BuildingIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  LifeBuoyIcon,
  MenuIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";

import { HOME_ROUTE, MY_PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { Logo } from "@/shared/brand/logo";
import { Button } from "@/shared/ui/button";
import { NavItem, type NavEntry } from "@/shared/ui/nav-item";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

import { SignOutButton } from "./sign-out-button";

/**
 * Product sections. The ones without an `href` do not exist yet: they render disabled with a
 * "Pronto" badge instead of linking to a 404.
 *
 * There is no "Publicar" entry. Publishing is something you do *to* your properties, not a
 * separate place in the product: the action lives inside "Mis inmuebles", next to the list it
 * adds to, so there is one answer to "where are my properties?" instead of two.
 */
const NAV: readonly NavEntry[] = [
  { label: "Inicio", icon: HouseIcon, href: HOME_ROUTE },
  {
    label: "Mis inmuebles",
    icon: BuildingIcon,
    href: MY_PROPERTIES_ROUTE,
    activeOn: [PUBLISH_PROPERTY_ROUTE],
  },
  { label: "Soporte", icon: LifeBuoyIcon },
  { label: "Contrato", icon: FileTextIcon },
  { label: "Facturación", icon: CreditCardIcon },
  { label: "Ajustes", icon: SettingsIcon },
];

/**
 * The product's navigation: a bar with the hamburger, and the menu itself in a drawer.
 *
 * One behaviour at every width rather than a rail that becomes a drawer on small screens.
 * The rail could only afford icons with 11px labels under them, and the sections it hid were
 * the ones nobody found; the drawer has room for full labels and gives the content the whole
 * width back — which is what the property form and the photo grid actually needed.
 */
export function AppDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
        <SheetTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Abrir menú">
            <MenuIcon className="size-5" aria-hidden="true" />
          </Button>
        </SheetTrigger>

        <Link href={HOME_ROUTE} aria-label="Ir al inicio" className="flex items-center">
          <Logo width={150} priority className="hidden sm:block" />
          {/* On a phone the wordmark would eat the bar; the icon mark carries the brand. */}
          <Image
            src="/isotipo.png"
            alt="miarriendoDIRECTO.com"
            width={1254}
            height={1254}
            priority
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
                sits on a light chip. Until a reversed logo exists, this is how it stays legible.
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

        <nav aria-label="Navegación principal" className="flex min-h-0 flex-1 flex-col px-3 py-2">
          <ul className="flex flex-col gap-1">
            {NAV.map((entry) => (
              <li key={entry.label}>
                <NavItem {...entry} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-4 pb-2">
            <SignOutButton variant="drawer" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
