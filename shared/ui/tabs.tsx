"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/*
 * Written here rather than pulled in with `shadcn add tabs`.
 *
 * `add` also rewrites the component's dependencies, and it has already cost this project once: it
 * silently dropped the `accent` variant and the `xl` size from `button.tsx` — the brand CTA every
 * form submits with. This wrapper is thirty lines over the Radix primitive already in
 * `dependencies`, in the same shape as `tooltip.tsx` and `separator.tsx`, so there is nothing to
 * gain by letting a generator touch the rest of the folder.
 *
 * The look is the product's own: an underlined rail, not the pill group shadcn ships. A pill group
 * reads as a filter — something you toggle over one set of things — and these are three different
 * subjects. The active tab carries the brand colour and a 2px rule under it, which is the same
 * language the sidebar uses for the section you are in.
 */

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        /*
         * Scrollable rather than wrapping: at 390px three labels with counts do not fit, and a rail
         * that wraps to two lines pushes the content down and stops reading as a rail. The scrollbar
         * is hidden because the overflow is a few pixels and a visible bar under three tabs looks
         * like a broken layout.
         */
        "flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
        "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        /*
         * `--brand-panel`, never `--primary`: in dark mode `--primary` *is* the cyan, so an active
         * tab on `text-primary` would compete with the one cyan CTA it sits above.
         */
        "data-[state=active]:text-brand-panel",
        // The rule under the active tab, drawn over the list's own border.
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:after:bg-brand-panel",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
