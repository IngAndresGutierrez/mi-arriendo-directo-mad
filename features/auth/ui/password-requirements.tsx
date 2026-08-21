import { CheckIcon } from "lucide-react";

import { PASSWORD_REQUIREMENTS } from "../validations/auth";
import { cn } from "@/shared/lib/utils";

/**
 * Checklist en vivo de los requisitos de contraseña.
 *
 * Lee `PASSWORD_REQUIREMENTS`, la misma lista de la que se deriva `signupSchema`: la UI y la
 * validación no pueden desincronizarse.
 */
export function PasswordRequirements({ value, id }: { value: string; id: string }) {
  return (
    <ul id={id} className="space-y-1.5">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const isMet = requirement.isMet(value);

        return (
          <li
            key={requirement.id}
            className={cn(
              "flex items-center gap-2 text-sm",
              isMet ? "text-estado-aprobada" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded-full",
                isMet ? "bg-estado-aprobada/15" : "border border-current opacity-50",
              )}
            >
              {isMet ? <CheckIcon className="size-3" /> : null}
            </span>
            {requirement.label}
            {/* El color no puede ser el único indicador de estado. */}
            <span className="sr-only">{isMet ? "(cumplido)" : "(pendiente)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
