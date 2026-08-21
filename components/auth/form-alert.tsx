import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

/**
 * Error a nivel de formulario. `role="alert"` para que los lectores de pantalla lo anuncien
 * sin que el usuario tenga que buscarlo.
 */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
