import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/utils";

type TextFieldProps = ComponentProps<"input"> & {
  /** Requerido: sin él no hay `htmlFor` ni ids de error estables. */
  id: string;
  label: string;
  /** Mensaje de error ya resuelto (p. ej. `errors.email?.message`). */
  error?: string;
  /** Contenido alineado a la derecha de la etiqueta, como "¿Olvidaste tu contraseña?". */
  labelAction?: ReactNode;
  /** Texto de ayuda permanente bajo el campo. */
  hint?: ReactNode;
};

/**
 * Campo de texto con etiqueta, error y ARIA cableado en un solo sitio.
 *
 * Antes cada formulario repetía el `<Label>`, el `aria-invalid`, el `aria-describedby` y el
 * `<p>` de error, con el riesgo de que uno se quedara sin conectar.
 *
 * Acepta `{...register("campo")}` de react-hook-form directamente: en React 19 `ref` es una
 * prop normal y se reenvía al `<input>`.
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
