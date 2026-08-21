"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type NavEntry = {
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Absent while the section does not exist yet. */
  readonly href?: string;
};

const BASE =
  "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors";

/**
 * Sidebar menu item.
 *
 * Without an `href` it renders disabled with a "coming soon" tooltip: honest about what
 * exists, and it does not lead to a 404. A `<span aria-disabled>` rather than a dead link,
 * so screen readers do not announce it as navigable.
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
              "cursor-not-allowed text-brand-panel-muted/60",
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
          : "text-brand-panel-muted hover:bg-white/5 hover:text-brand-panel-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
