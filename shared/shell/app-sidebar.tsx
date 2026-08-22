"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, and a function
// cannot cross the Server → Client boundary. The menu also needs `usePathname` to mark the
// active section, so it is interactive anyway.
import Image from "next/image";
import {
  BuildingIcon,
  PlusIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  LifeBuoyIcon,
  SettingsIcon,
} from "lucide-react";

import { NavItem, type NavEntry } from "@/shared/ui/nav-item";
import { HOME_ROUTE, MY_PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";

import { SignOutButton } from "./sign-out-button";

/**
 * Product sections. The ones without an `href` do not exist yet: they render disabled with
 * a "coming soon" tooltip instead of linking to a 404.
 */
const NAV: readonly NavEntry[] = [
  { label: "Inicio", icon: HouseIcon, href: HOME_ROUTE },
  { label: "Mis inmuebles", icon: BuildingIcon, href: MY_PROPERTIES_ROUTE },
  { label: "Publicar", icon: PlusIcon, href: PUBLISH_PROPERTY_ROUTE },
  { label: "Soporte", icon: LifeBuoyIcon },
  { label: "Contrato", icon: FileTextIcon },
  { label: "Facturación", icon: CreditCardIcon },
  { label: "Ajustes", icon: SettingsIcon },
];

export function AppSidebar() {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex w-20 shrink-0 flex-col items-center gap-1 bg-brand-panel px-2 py-4"
    >
      {/*
        Icon mark: the full logo does not fit in 80px. It sits on a light chip because its
        strokes are purple and would vanish against the panel's purple background. Until a
        reversed version of the logo exists, this is how it stays legible.
      */}
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-panel-foreground">
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

      <ul className="flex w-full flex-col gap-1">
        {NAV.map((entry) => (
          <li key={entry.label}>
            <NavItem {...entry} />
          </li>
        ))}
      </ul>

      <div className="mt-auto w-full pt-4">
        <SignOutButton />
      </div>
    </nav>
  );
}
