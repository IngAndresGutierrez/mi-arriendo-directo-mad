"use client";

// Client, not server: it passes lucide icons to `NavItem` as *components*, and a function
// cannot cross the Server → Client boundary.
import {
  BuildingIcon,
  CalendarClockIcon,
  ClipboardListIcon,
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
  SETTINGS_ROUTE,
  SUPPORT_ROUTE,
  TENANT_PROFILE_ROUTE,
} from "@/shared/auth/routes";
import { NavItem, type NavEntry } from "@/shared/ui/nav-item";
import { cn } from "@/shared/lib/utils";

import { SignOutButton } from "./sign-out-button";

/**
 * Product sections.
 *
 * **Every entry here now leads somewhere**, and that is new: "Facturación" was the last one
 * without an `href`, rendering disabled with a "Pronto" badge, and it is gone. A disabled entry
 * earns its place while it is a promise somebody is waiting on — "Arriendos" sat here for exactly
 * that reason, because a menu that stopped at "Contratos" said the year after a signature did not
 * exist. Billing is not that: nobody is looking for it, nothing in the product refers to it, and a
 * permanent "Pronto" stops reading as a roadmap and starts reading as an abandoned section.
 *
 * `NavItem` keeps the disabled/"Pronto" behaviour even though nothing uses it today. It is the same
 * call `UNBUILT_STAGES` makes by staying an empty constant: the capability is what says out loud
 * that a section is coming, and the next one added will need it.
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
  { label: "Ajustes", icon: SettingsIcon, href: SETTINGS_ROUTE },
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
