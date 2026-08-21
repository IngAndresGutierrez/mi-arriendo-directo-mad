import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

type AuthShellProps = {
  /** Encabezado del panel de marca (columna derecha). */
  title: ReactNode;
  description: string;
  /** Fila superior de la columna izquierda, a la derecha del logo. */
  action?: ReactNode;
  children: ReactNode;
};

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
export function AuthShell({ title, description, action, children }: AuthShellProps) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex items-center justify-center bg-background px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
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
