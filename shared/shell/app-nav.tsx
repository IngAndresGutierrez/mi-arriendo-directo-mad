"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, and a function
// cannot cross the Server → Client boundary.
import {
  BuildingIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  LifeBuoyIcon,
  SettingsIcon,
} from "lucide-react";

import { HOME_ROUTE, MY_PROPERTIES_ROUTE, PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { NavItem, type NavEntry } from "@/shared/ui/nav-item";

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
 * The list of sections, shared by the two surfaces that show it: the fixed sidebar on a wide
 * screen and the drawer on a narrow one. One list, so the two can never disagree about what
 * the product contains.
 */
export function AppNav({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación principal" className="flex min-h-0 flex-1 flex-col px-3 py-2">
      <ul className="flex flex-col gap-1">
        {NAV.map((entry) => (
          <li key={entry.label}>
            <NavItem {...entry} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 pb-2">
        <SignOutButton variant="drawer" />
      </div>
    </nav>
  );
}
