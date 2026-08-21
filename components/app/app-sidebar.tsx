"use client";

// Cliente, no servidor: pasa los iconos de lucide como *componentes* a `NavItem`, y una
// función no puede cruzar la frontera Server → Client. Además el menú necesita
// `usePathname` para marcar la sección activa, así que es interactivo de todos modos.
import Image from "next/image";
import {
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  LifeBuoyIcon,
  SettingsIcon,
} from "lucide-react";

import { NavItem, type NavEntry } from "@/components/app/nav-item";
import { HOME_ROUTE } from "@/lib/auth/routes";

import { SignOutButton } from "./sign-out-button";

/**
 * Secciones del producto. Las que no tienen `href` todavía no existen: se muestran
 * deshabilitadas con un tooltip de "Próximamente", en lugar de enlazar a un 404.
 */
const NAV: readonly NavEntry[] = [
  { label: "Inicio", icon: HouseIcon, href: HOME_ROUTE },
  { label: "Soporte", icon: LifeBuoyIcon },
  { label: "Contrato", icon: FileTextIcon },
  { label: "Facturación", icon: CreditCardIcon },
  { label: "Ajustes", icon: SettingsIcon },
];

export function AppSidebar() {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex w-20 shrink-0 flex-col items-center gap-1 bg-panel-marca px-2 py-4"
    >
      {/*
        Isotipo: la marca completa no cabe en 80px. Va sobre un chip claro porque sus
        trazos son púrpura y sobre el fondo púrpura del panel desaparecerían. Mientras no
        exista una versión en reverso del logo, esta es la forma de que se lea.
      */}
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-panel-marca-foreground">
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
