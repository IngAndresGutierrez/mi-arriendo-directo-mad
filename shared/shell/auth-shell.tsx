import type { ReactNode } from "react";

import { Logo } from "@/shared/brand/logo";
import { cn } from "@/shared/lib/utils";

type AuthShellProps = {
  /** Heading of the brand panel (right column). */
  title: ReactNode;
  description: string;
  /** Top row of the left column, to the right of the logo. */
  action?: ReactNode;
  /**
   * Width of the content column. `"sm"` for login and signup (few fields); `"lg"` for long
   * forms, where it allows two columns and avoids scrolling.
   */
  contentWidth?: "sm" | "lg";
  children: ReactNode;
};

const CONTENT_WIDTH = {
  sm: "max-w-sm",
  lg: "max-w-lg",
} as const;

const VERTICAL_PADDING = {
  sm: "py-12",
  lg: "py-5",
} as const;

/** The long form needs every pixel; the short one can breathe. */
const LOGO_MARGIN = {
  sm: "mb-8",
  lg: "mb-5",
} as const;

/**
 * Purely decorative JSX, hoisted to module level so it is not rebuilt on every render.
 * It does not depend on props.
 */
const GLOW_DECORATION = (
  <>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-accent/15 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-40 -left-28 size-[32rem] rounded-full bg-accent/10 blur-3xl"
    />
  </>
);

/**
 * Two-column layout for the access screens.
 *
 * The right panel uses the `panel-marca` token (purple in both themes) instead of
 * `bg-primary`, which is cyan in dark mode.
 */
export function AuthShell({
  title,
  description,
  action,
  contentWidth = "sm",
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div
        className={cn(
          "flex items-center justify-center bg-background px-6 sm:px-12",
          VERTICAL_PADDING[contentWidth],
        )}
      >
        <div className={cn("w-full", CONTENT_WIDTH[contentWidth])}>
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-4",
              LOGO_MARGIN[contentWidth],
            )}
          >
            <Logo width={200} priority />
            {action}
          </div>

          {children}
        </div>
      </div>

      <aside className="relative hidden items-center justify-center overflow-hidden bg-panel-marca px-12 lg:flex">
        {GLOW_DECORATION}

        <div className="relative max-w-md text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-panel-marca-foreground text-balance">
            {title}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-panel-marca-muted text-pretty">
            {description}
          </p>
        </div>
      </aside>
    </main>
  );
}
