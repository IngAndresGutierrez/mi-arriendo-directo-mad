"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { InfoIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * The explanation a field needs, folded behind an icon beside its label.
 *
 * Two reasons it is not permanent text: a paragraph under every field pushes the next one off
 * the screen on a phone, and an explanation that is always there is read once and then stops
 * being read at all.
 *
 * It opens on hover and on focus like any tooltip, **and on click**, because Radix tooltips do
 * not open on touch and a finger is how half of this form gets filled. The same sentence is also
 * rendered for a screen reader — a tooltip that only exists while the pointer is over it is not
 * an explanation for someone who never has a pointer there.
 */
export function FieldHint({
  id,
  label,
  children,
}: {
  /** The id the field points at with `aria-describedby`. */
  readonly id: string;
  /** Which field this explains: "Qué es esto" three times on a page says nothing. */
  readonly label: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  /*
   * Opened by a tap, it has to be closable by one. Radix closes a tooltip when the pointer
   * leaves, and on a touch screen the pointer never leaves: tapping a second icon left two
   * explanations on the screen at once, and tapping the page left the first one there for good.
   */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            ref={trigger}
            type="button"
            aria-label={`Qué es ${label}`}
            onClick={() => setOpen((current) => !current)}
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <InfoIcon className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {children}
        </TooltipContent>
      </Tooltip>

      <p id={id} className="sr-only">
        {children}
      </p>
    </>
  );
}
