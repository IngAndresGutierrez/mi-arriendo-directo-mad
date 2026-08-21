import { Separator } from "@/shared/ui/separator";

/** The "or" divider between provider sign-in and email sign-in. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">o</span>
      <Separator className="flex-1" />
    </div>
  );
}
