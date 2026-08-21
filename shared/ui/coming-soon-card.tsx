"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/**
 * Wrapper for mocked-up cards whose function does not exist yet.
 *
 * It marks the block as non-interactive (`aria-disabled`, nothing focusable inside) and
 * explains why in a tooltip. Better than a button that does nothing: the user understands
 * the section is on its way instead of thinking the app is broken.
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
            // Nothing in here should be focusable or clickable: it is a mock-up.
            "[&_*]:pointer-events-none",
            className,
          )}
        >
          {/*
            The badge stays in the flow rather than `absolute`: positioned, it overlapped
            the headings on narrow screens.
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
