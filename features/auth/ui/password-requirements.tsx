import { CheckIcon } from "lucide-react";

import { PASSWORD_REQUIREMENTS } from "../validations/auth";
import { cn } from "@/shared/lib/utils";

/**
 * Live checklist of the password requirements.
 *
 * It reads `PASSWORD_REQUIREMENTS`, the same list `signupSchema` is derived from: the UI
 * and the validation cannot drift apart.
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
              isMet ? "text-status-approved" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded-full",
                isMet ? "bg-status-approved/15" : "border border-current opacity-50",
              )}
            >
              {isMet ? <CheckIcon className="size-3" /> : null}
            </span>
            {requirement.label}
            {/* Color cannot be the only indicator of state. */}
            <span className="sr-only">{isMet ? "(cumplido)" : "(pendiente)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
