"use client";

import type { Dictionary } from "@/shared/i18n";

/** The keys of `nav` whose value is a plain string — every one of them, but stated so it stays so. */
type NavTextKey = {
  [K in keyof Dictionary["nav"]]: Dictionary["nav"][K] extends string ? K : never;
}[keyof Dictionary["nav"]];
import type { ComponentType, SVGProps } from "react";
import { useLinkStatus } from "next/link";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { usePathname } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type NavEntry = {
  /**
   * **A key into the `nav` dictionary, not a word.**
   *
   * This used to be the Spanish label. The entry is data that lives in a module-scope constant, and
   * a constant cannot be re-evaluated per language — so what the list holds is which sentence to
   * show, and `AppNav` resolves it against the copy its server parent passed down.
   */
  readonly label: NavTextKey;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Absent while the section does not exist yet. */
  readonly href?: string;
  /**
   * What the narrow rail shows instead of `label`.
   *
   * There the label sits under the icon in a 96px column: two words wrap to two lines and read
   * fine, three turn the entry into a paragraph and push the menu out of shape.
   */
  readonly shortLabel?: NavTextKey;
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
  /** The menu's words, resolved by `AppShell`. See `AppNav`. */
  readonly copy: Dictionary["nav"];
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
export function NavItem({
  label,
  shortLabel,
  icon: Icon,
  href,
  activeOn,
  collapsed,
  onNavigate,
  copy,
}: NavItemProps) {
  const pathname = usePathname();
  const base = collapsed ? STACK : ROW;
  const shown = copy[collapsed && shortLabel ? shortLabel : label];
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
        <span className={collapsed ? undefined : "flex-1 text-left"}>{shown}</span>
        {!collapsed && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
            {copy.soon}
          </span>
        )}
      </span>
    );

    if (!collapsed) return disabled;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{disabled}</TooltipTrigger>
        <TooltipContent side="right">{copy.comingSoon}</TooltipContent>
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
      <NavIcon Icon={Icon} />
      {shown}
    </Link>
  );
}

/**
 * The icon, or a spinner while this link's navigation is in flight.
 *
 * `useLinkStatus` only works inside a `<Link>`, which is why it is its own component. It answers
 * the question a click on a slow connection leaves open — *did it register, and which one did I
 * press?* — right where the finger was, instead of somewhere at the top of the screen.
 *
 * With a warm prefetch this never shows, and that is the point: it appears exactly when the
 * navigation is actually waiting on something.
 */
function NavIcon({ Icon }: { readonly Icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  const { pending } = useLinkStatus();

  return pending ? (
    <Loader2Icon className="size-5 shrink-0 animate-spin" aria-hidden="true" />
  ) : (
    <Icon className="size-5 shrink-0" aria-hidden="true" />
  );
}
