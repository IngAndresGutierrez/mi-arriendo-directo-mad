"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { groupThousands, toDigits } from "@/shared/format/money";
import { TextField } from "@/shared/form/text-field";


type AmountFieldProps = {
  readonly id: string;
  readonly label: string;
  /** Raw digits, no separators — this is what the schema and the server see. */
  readonly value: string;
  readonly onChange: (digits: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly hint?: ReactNode;
  readonly placeholder?: string;
};

/**
 * Money input that groups thousands **while you type**.
 *
 * An unformatted `1800000` is genuinely hard to read: a landlord typing one zero too many
 * publishes an eighteen-million-peso rental and only finds out from the silence. Seeing
 * `1.800.000` form under the cursor makes the mistake visible at the moment it happens.
 *
 * What leaves this component is always raw digits: the separators are presentation, and
 * `Number("1.800.000")` is `NaN`, so letting them reach the schema would break coercion.
 *
 * The caret is preserved by counting digits, not characters. Reformatting shifts everything
 * to the right of the cursor, and a naive implementation sends the caret to the end on every
 * keystroke — which is only invisible while you type at the end.
 */
export function AmountField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
}: AmountFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);

  const digits = toDigits(value ?? "");
  const formatted = groupThousands(digits);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const target = caretDigits.current;
    if (!input || target === null) return;
    caretDigits.current = null;

    // Walk the formatted text until `target` digits have been passed; that index is where the
    // caret belongs, separators included.
    let seen = 0;
    let position = input.value.length;
    for (let i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i] ?? "")) seen++;
      if (seen === target) {
        position = i + 1;
        break;
      }
    }
    if (target === 0) position = 0;
    input.setSelectionRange(position, position);
  }, [formatted]);

  return (
    <TextField
      ref={inputRef}
      id={id}
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      hint={hint}
      error={error}
      value={formatted}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value;
        const caret = event.target.selectionStart ?? raw.length;
        // How many digits sit before the cursor — the only position that survives reformatting.
        caretDigits.current = toDigits(raw.slice(0, caret)).length;
        onChange(toDigits(raw));
      }}
    />
  );
}
