"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, and a function
// cannot cross the Server → Client boundary.
import {
  BuildingIcon,
  CalendarClockIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  IdCardIcon,
  LifeBuoyIcon,
  SettingsIcon,
} from "lucide-react";

import {
  CONTRACTS_ROUTE,
  HOME_ROUTE,
  MY_PROPERTIES_ROUTE,
  PUBLISH_PROPERTY_ROUTE,
  SUPPORT_ROUTE,
  TENANT_PROFILE_ROUTE,
} from "@/shared/auth/routes";
import { NavItem, type NavEntry } from "@/shared/ui/nav-item";
import { cn } from "@/shared/lib/utils";

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
  { label: "Contratos", icon: FileTextIcon, href: CONTRACTS_ROUTE },
  /*
   * The tenancy itself has no route yet, and the entry is here disabled rather than absent:
   * the process ending in a signed contract is only half of what this product is about, and a
   * menu that stops at "Contratos" says the other half does not exist.
   */
  { label: "Arriendos", icon: CalendarClockIcon },
  {
    label: "Perfil de inquilino",
    // Two words fit under an icon in the narrow rail; three do not.
    shortLabel: "Mi perfil",
    icon: IdCardIcon,
    href: TENANT_PROFILE_ROUTE,
  },
  { label: "Soporte", icon: LifeBuoyIcon, href: SUPPORT_ROUTE },
  { label: "Facturación", icon: CreditCardIcon },
  { label: "Ajustes", icon: SettingsIcon },
];

/**
 * The list of sections, shared by the two surfaces that show it: the fixed sidebar on a wide
 * screen and the drawer on a narrow one. One list, so the two can never disagree about what
 * the product contains.
 */
export function AppNav({
  collapsed = false,
  onNavigate,
}: {
  readonly collapsed?: boolean;
  readonly onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn("flex min-h-0 flex-1 flex-col py-2", collapsed ? "px-2" : "px-3")}
    >
      <ul className={cn("flex flex-col", collapsed ? "gap-2" : "gap-1")}>
        {NAV.map((entry) => (
          <li key={entry.label}>
            <NavItem {...entry} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 pb-2">
        <SignOutButton variant="drawer" collapsed={collapsed} />
      </div>
    </nav>
  );
}
