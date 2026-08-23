import { cn } from "@/shared/lib/utils";

/**
 * A placeholder block, for the moment before real content arrives.
 *
 * `aria-hidden` on purpose: a shimmering rectangle is nothing to a screen reader, and reading
 * out a dozen of them is worse than silence. The announcement belongs to the `role="status"`
 * wrapper the loading screens put around these, once, in words.
 */
export function Skeleton({ className }: { readonly className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} />
  );
}

/**
 * The wrapper that says, once, that something is loading.
 *
 * Every `loading.tsx` uses it so the sentence is the same and there is exactly one live region
 * per screen instead of one per placeholder.
 */
export function LoadingScreen({
  label = "Cargando…",
  children,
}: {
  readonly label?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}
