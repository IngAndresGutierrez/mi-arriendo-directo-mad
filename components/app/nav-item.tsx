"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type NavEntry = {
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Ausente cuando la sección todavía no existe. */
  readonly href?: string;
};

const BASE =
  "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors";

/**
 * Ítem del menú lateral.
 *
 * Sin `href` se renderiza deshabilitado con un tooltip de "Próximamente": es honesto sobre
 * lo que existe, y no lleva a un 404. Un `<span aria-disabled>` en vez de un enlace muerto,
 * para que el lector de pantalla no lo anuncie como navegable.
 */
export function NavItem({ label, icon: Icon, href }: NavEntry) {
  const pathname = usePathname();

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled="true"
            tabIndex={0}
            className={cn(
              BASE,
              "cursor-not-allowed text-panel-marca-muted/60",
              "focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Próximamente</TooltipContent>
      </Tooltip>
    );
  }

  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        BASE,
        "focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none",
        isActive
          ? "bg-accent/15 text-accent"
          : "text-panel-marca-muted hover:bg-white/5 hover:text-panel-marca-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
