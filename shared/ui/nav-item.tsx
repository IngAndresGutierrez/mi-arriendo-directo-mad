"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/lib/utils";

export type NavEntry = {
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Absent while the section does not exist yet. */
  readonly href?: string;
  /**
   * Extra routes that belong to this section but do not hang off its path. Publishing lives
   * at `/inmuebles/publicar`, yet it is something you do inside "Mis inmuebles": without this
   * the drawer claims you are nowhere while you fill the form.
   */
  readonly activeOn?: readonly string[];
};

type NavItemProps = NavEntry & {
  /** Closes the drawer once the user has chosen where to go. */
  readonly onNavigate?: () => void;
};

const BASE =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors";

/**
 * One row of the navigation drawer: icon, label, and — while the section does not exist —
 * a "Pronto" badge.
 *
 * The badge replaced a hover tooltip. In the old 80px rail there was no room for words, so
 * the explanation had to hide behind a hover that a touch screen never fires; with the label
 * already spelled out there is room to simply say it, and it is now readable on a phone.
 *
 * A disabled entry is a `<span aria-disabled>`, never a dead link: a screen reader should not
 * announce as navigable something that goes nowhere.
 */
export function NavItem({ label, icon: Icon, href, activeOn, onNavigate }: NavItemProps) {
  const pathname = usePathname();

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(BASE, "cursor-not-allowed text-brand-panel-muted/60")}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{label}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
          Pronto
        </span>
      </span>
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
        BASE,
        "focus-visible:ring-3 focus-visible:ring-accent/50 focus-visible:outline-none",
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
