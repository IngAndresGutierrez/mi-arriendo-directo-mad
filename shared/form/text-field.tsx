import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

type TextFieldProps = ComponentProps<"input"> & {
  /** Required: without it there is no `htmlFor` and no stable error ids. */
  id: string;
  label: string;
  /** Already resolved error message (e.g. `errors.email?.message`). */
  error?: string;
  /** Content aligned to the right of the label, like "¿Olvidaste tu contraseña?". */
  labelAction?: ReactNode;
  /** Permanent helper text below the field. */
  hint?: ReactNode;
};

/**
 * Text field with label, error and ARIA wired up in one place.
 *
 * Every form used to repeat the `<Label>`, the `aria-invalid`, the `aria-describedby` and
 * the error `<p>`, with the risk of leaving one of them unconnected.
 *
 * It takes react-hook-form's `{...register("field")}` directly: in React 19 `ref` is a
 * regular prop and is forwarded to the `<input>`.
 */
export function TextField({
  id,
  label,
  error,
  labelAction,
  hint,
  className,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>

      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn("h-11", className)}
        {...inputProps}
      />

      {hint ? (
        <div id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
