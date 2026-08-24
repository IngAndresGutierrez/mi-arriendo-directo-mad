"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/*
 * Written here rather than pulled in with `shadcn add switch`, for the reason `tabs.tsx` says: `add`
 * also rewrites the component's dependencies, and it has already dropped the `accent` variant and the
 * `xl` size from `button.tsx` once. This is twenty lines over the Radix primitive that is already in
 * `dependencies`, in the same shape as `tooltip.tsx` and `separator.tsx`.
 *
 * The checked colour is **`--brand-panel`, never `--primary`**: in dark mode `--primary` *is* the
 * cyan, so a switch on `bg-primary` would compete with the one cyan CTA of whatever view it lands in.
 * The same trap the secondary buttons already documented.
 */

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-input data-[state=checked]:bg-brand-panel",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-xs ring-0 transition-transform",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
