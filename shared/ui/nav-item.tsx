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
  /**
   * Extra routes that belong to this section but do not hang off its path. Publishing lives
   * at `/inmuebles/publicar`, yet it is something you do inside "Mis inmuebles": without this
   * the menu claims you are nowhere while you fill the form.
   */
  readonly activeOn?: readonly string[];
};

type NavItemProps = NavEntry & {
  /** Icon over label, in a narrow rail. */
  readonly collapsed?: boolean;
  /** Closes the drawer once the user has chosen where to go. */
  readonly onNavigate?: () => void;
};

const ROW = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium";
const STACK =
  "flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center text-xs font-medium";

/**
 * One entry of the menu, in whichever of its two shapes the surface asked for: a row with the
 * label beside the icon, or the icon with the label underneath.
 *
 * How "this section does not exist yet" is said depends on the room available. Expanded there
 * is space for a "Pronto" badge, which a touch screen can read; collapsed there is not, so it
 * falls back to the tooltip. A hover-only explanation is a poor one, which is why it is the
 * fallback and not the rule.
 */
export function NavItem({ label, icon: Icon, href, activeOn, collapsed, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const base = collapsed ? STACK : ROW;
  const focus = "focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none";

  if (!href) {
    const disabled = (
      <span
        aria-disabled="true"
        tabIndex={collapsed ? 0 : undefined}
        className={cn(
          base,
          "cursor-not-allowed text-brand-panel-muted/60",
          collapsed && focus,
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span className={collapsed ? undefined : "flex-1 text-left"}>{label}</span>
        {!collapsed && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
            Pronto
          </span>
        )}
      </span>
    );

    if (!collapsed) return disabled;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{disabled}</TooltipTrigger>
        <TooltipContent side="right">Próximamente</TooltipContent>
      </Tooltip>
    );
  }

  const isActive =
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (activeOn?.some((route) => pathname === route || pathname.startsWith(`${route}/`)) ?? false);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        base,
        focus,
        "transition-colors",
        isActive
          ? "bg-accent/15 text-accent"
          : "text-brand-panel-muted hover:bg-white/5 hover:text-brand-panel-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
