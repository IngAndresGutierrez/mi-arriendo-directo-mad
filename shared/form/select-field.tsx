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
 * Select with label, error and ARIA wired up, just like `TextField`.
 *
 * Radix's `Select` does not emit a native form value, so it is controlled from
 * react-hook-form with `Controller` and the value is added to the `FormData` on submit.
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
          // See the note in `phone-field.tsx`: `SelectTrigger` sets its height with a
          // variant class, so the override has to use that same variant.
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
