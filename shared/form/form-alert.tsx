import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

/**
 * Form-level error. `role="alert"` so screen readers announce it without the user having
 * to go looking for it.
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
