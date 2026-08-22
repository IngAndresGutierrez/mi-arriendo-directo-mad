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
 * Open by default — this only ever renders on the stage being worked on, and hiding the one
 * thing there is to do behind a click is a click for nothing. It folds because the list is long
 * and, once the papers are in, what the person came back for is the timeline underneath it.
 */
export function StagePanel({
  title,
  meta,
  children,
}: {
  readonly title: string;
  /** A count, a status — whatever belongs on the header line beside the title. */
  readonly meta?: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
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
