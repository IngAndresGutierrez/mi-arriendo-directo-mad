"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, and a function
// cannot cross the Server → Client boundary.
import {
  BuildingIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  IdCardIcon,
  LifeBuoyIcon,
  SettingsIcon,
} from "lucide-react";

import {
  CONTRACTS_ROUTE,
  ERRANDS_ROUTE,
  HOME_ROUTE,
  MY_PROPERTIES_ROUTE,
  PUBLISH_PROPERTY_ROUTE,
  RENTALS_ROUTE,
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
   * The other half of the product: the tenancy that runs after the contract is signed. It was
   * disabled here rather than absent for exactly this reason — a menu that stopped at "Contratos"
   * said the year that follows a signature did not exist.
   */
  { label: "Arriendos", icon: CalendarClockIcon, href: RENTALS_ROUTE },
  {
    label: "Perfil de inquilino",
    // Two words fit under an icon in the narrow rail; three do not.
    shortLabel: "Mi perfil",
    icon: IdCardIcon,
    href: TENANT_PROFILE_ROUTE,
  },
  /*
   * **No hay entrada de "Colaboradores", y no es un olvido.** Un colaborador ya no es usuario de
   * este producto: entra por `/colaborador` con un código a su teléfono y ve lo que le encargaron.
   * Dar de alta a uno se hace escribiendo su nombre y su número al encargar, no en una sección.
   *
   * "Encargos" sí está, y es **la única entrada condicional del menú**: se inserta más abajo, solo
   * para quien tiene inmuebles publicados. Ver los encargos que repartes cuando no tienes nada que
   * delegar es una puerta a un cuarto vacío, y a un inquilino le sobra del todo.
   */
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
  showErrands = false,
}: {
  readonly collapsed?: boolean;
  readonly onNavigate?: () => void;
  /**
   * Whether this person has any property published.
   *
   * The one conditional entry in the menu. Decided on the server — see `ProductChrome` — so the
   * first paint is already right instead of the menu growing an item after hydration.
   */
  readonly showErrands?: boolean;
}) {
  /*
   * Detrás de "Mis inmuebles", que es de donde se encarga algo: el orden mental es publicar,
   * mirar lo publicado, y después lo que delegaste sobre ello.
   */
  const entries = showErrands
    ? [
        ...NAV.slice(0, 2),
        { label: "Encargos", icon: ClipboardListIcon, href: ERRANDS_ROUTE },
        ...NAV.slice(2),
      ]
    : NAV;

  return (
    <nav
      aria-label="Navegación principal"
      className={cn("flex min-h-0 flex-1 flex-col py-2", collapsed ? "px-2" : "px-3")}
    >
      <ul className={cn("flex flex-col", collapsed ? "gap-2" : "gap-1")}>
        {entries.map((entry) => (
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
