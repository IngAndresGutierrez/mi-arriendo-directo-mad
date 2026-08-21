"use client";

import type { ReactNode } from "react";

import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type Option = { readonly value: string; readonly label: string };

type SelectFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  options: readonly Option[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  hint?: ReactNode;
};

/**
 * Select con etiqueta, error y ARIA cableado, igual que `TextField`.
 *
 * El `Select` de Radix no emite un valor nativo de formulario, así que se controla desde
 * react-hook-form con `Controller` y el valor se añade al `FormData` al enviar.
 */
export function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onValueChange,
  error,
  disabled = false,
  hint,
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          // Ver nota en `phone-field.tsx`: `SelectTrigger` fija su alto con una clase
          // con variante, así que hay que sobreescribir esa misma variante.
          className="h-11 w-full data-[size=default]:h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
