import { Separator } from "@/components/ui/separator";

/** Separador "o" entre el acceso con proveedor y el acceso con correo. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">o</span>
      <Separator className="flex-1" />
    </div>
  );
}
