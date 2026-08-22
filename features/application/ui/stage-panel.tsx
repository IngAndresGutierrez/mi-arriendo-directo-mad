"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * The work of one stage, folded inside the stage it belongs to.
 *
 * It lives here rather than in a section of its own because that is where someone looks for it:
 * the timeline already says "sube tus documentos", and the documents being somewhere else on the
 * page is the reason the previous version needed a link to point at them.
 *
 * Always starts folded, on every stage.
 *
 * The header carries the state — "5 de 5 subidos", "2 de 4 consultadas" — so what a click reveals
 * is the controls, not the news. Ten stages each unfolding on their own would be a page nobody
 * can see the shape of, and the first thing someone needs on arriving is to know where they are.
 *
 * A finished stage keeps its panel: the documents are still the documents, and a process that
 * hides what was agreed as soon as it moves on is a process nobody can audit.
 */
export function StagePanel({
  title,
  meta,
  resetOn,
  children,
}: {
  readonly title: string;
  /** A count, a status — whatever belongs on the header line beside the title. */
  readonly meta?: string;
  /**
   * When this changes, every panel folds shut.
   *
   * It carries the stage the process is on, so moving forward leaves the timeline collapsed:
   * what just finished stops taking up the screen, and the person sees where they are before
   * deciding what to open. Without it a panel opened before the change stays open — `useState`
   * only reads its initial value once — and the page grows a section at a time.
   */
  readonly resetOn?: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Adjusted during render, not in an effect: it is state derived from a prop, which is the case
  // React documents this for, and an effect would render the old state once first.
  const [lastReset, setLastReset] = useState(resetOn);
  if (resetOn !== lastReset) {
    setLastReset(resetOn);
    setOpen(false);
  }
  const id = `panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="mt-4 rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {/*
          One chevron that turns, rather than two icons swapped: the rotation is what says "this
          is the same control in another state", and it survives the animation frame in between.
        */}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 font-medium text-foreground">{title}</span>
        {meta ? <span className="shrink-0 text-sm text-muted-foreground">{meta}</span> : null}
      </button>

      {open ? (
        <div id={id} className="border-t border-border p-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
