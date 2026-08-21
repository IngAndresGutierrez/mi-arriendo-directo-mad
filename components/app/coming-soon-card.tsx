"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/**
 * Envoltorio para tarjetas maquetadas cuya función todavía no existe.
 *
 * Marca el bloque como no interactivo (`aria-disabled`, sin foco en su interior) y explica
 * por qué en un tooltip. Preferimos esto a un botón que no hace nada: el usuario entiende
 * que la sección está en camino en lugar de creer que la app está rota.
 */
export function ComingSoonCard({
  children,
  label = "Próximamente",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          aria-disabled="true"
          tabIndex={0}
          className={cn(
            "rounded-2xl border border-border bg-card p-5 text-left",
            "cursor-not-allowed opacity-75 transition-opacity hover:opacity-100",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            // Nada de aquí dentro debe ser enfocable ni clicable: es una maqueta.
            "[&_*]:pointer-events-none",
            className,
          )}
        >
          {/*
            El badge va en el flujo, no en `absolute`: posicionado se montaba encima de los
            títulos en pantallas angostas.
          */}
          <p className="mb-3 flex justify-end">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              Pronto
            </span>
          </p>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
