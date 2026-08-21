import type { ReactNode } from "react";

import { Logo } from "@/shared/brand/logo";
import { cn } from "@/shared/lib/utils";

type AuthShellProps = {
  /** Encabezado del panel de marca (columna derecha). */
  title: ReactNode;
  description: string;
  /** Fila superior de la columna izquierda, a la derecha del logo. */
  action?: ReactNode;
  /**
   * Ancho de la columna de contenido. `"sm"` para login y registro (pocos campos);
   * `"lg"` para formularios largos, donde permite dos columnas y evita el scroll.
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

/** El formulario largo necesita cada píxel; el corto puede respirar. */
const LOGO_MARGIN = {
  sm: "mb-8",
  lg: "mb-5",
} as const;

/**
 * JSX puramente decorativo, elevado a nivel de módulo para no recrearlo en cada render.
 * No depende de props.
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
 * Layout de dos columnas de las pantallas de acceso.
 *
 * El panel derecho usa el token `panel-marca` (púrpura en ambos temas) en lugar de
 * `bg-primary`, que en modo oscuro es cian.
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
