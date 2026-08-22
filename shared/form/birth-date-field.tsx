"use client";

import { useId, useState } from "react";

import {
  digitsOnly,
  fromDateParts,
  toDateParts,
  MONTHS,
  type DateParts,
} from "@/shared/format/date-parts";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/**
 * A birth date as three fields: day, month, year.
 *
 * `<input type="date">` was the previous version and it is the wrong control for this: it opens
 * on the current month, so somebody born in 1994 starts thirty years from where they need to be;
 * its typing order follows the browser's locale rather than the page's; and on a phone it is a
 * spinner scrolled through decades. Typed in the order the date is said out loud, the year is
 * just a number.
 *
 * What leaves the component is still one `YYYY-MM-DD` string, empty while the three do not yet
 * make a real date — the 31st of February is not stored as the 3rd of March, which is what
 * happens when the join is left to `Date`.
 */
export function BirthDateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: {
  readonly label: string;
  /** `YYYY-MM-DD`, or empty. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly disabled?: boolean;
}) {
  const uid = useId();
  const errorId = `${uid}-error`;
  /*
   * The three fields are their own state, not derived from `value` on every render.
   *
   * Half a date has no `YYYY-MM-DD` to be derived from: as soon as somebody types the day, the
   * joined value is empty, and rendering the fields from it would wipe what they just typed.
   */
  const [parts, setParts] = useState<DateParts>(() => toDateParts(value));

  function update(next: Partial<DateParts>) {
    const merged = { ...parts, ...next };
    setParts(merged);
    onChange(fromDateParts(merged));
  }

  return (
    <div className="space-y-2">
      {/*
        One visible label, like every other field on the form. Each input keeps a label of its own
        for a screen reader — "un campo de texto" three times in a row is unusable — but drawn as
        a second row of labels it made this block taller than the select beside it, and no
        alignment survives one block being taller than the other. The placeholder says which is
        which for anyone looking.
      */}
      {/*
        The same typography as `Label`, `leading-none` included. It is a `span` because it names a
        group rather than one control — but six pixels of line-height difference is exactly what
        put this block's inputs on a different line from the select beside it.
      */}
      <span
        id={`${uid}-label`}
        className="flex items-center text-sm leading-none font-medium text-foreground select-none"
      >
        {label}
      </span>

      <div
        role="group"
        aria-labelledby={`${uid}-label`}
        aria-describedby={error ? errorId : undefined}
        // The month takes what is left: sharing a row with the gender select, that is already
        // narrow enough to keep the three reading as one date.
        className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2"
      >
        <div>
          <Label htmlFor={`${uid}-day`} className="sr-only">
            Día
          </Label>
          <Input
            id={`${uid}-day`}
            className="h-11"
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="Día"
            maxLength={2}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            value={parts.day}
            onChange={(event) => update({ day: digitsOnly(event.target.value, 2) })}
            // Padded when they leave it: "3" and "03" are the same day, and the stored value is
            // padded anyway.
            onBlur={() => {
              if (parts.day.length === 1) update({ day: parts.day.padStart(2, "0") });
              onBlur?.();
            }}
          />
        </div>

        <div>
          <Label htmlFor={`${uid}-month`} className="sr-only">
            Mes
          </Label>
          <Select
            value={parts.month || undefined}
            onValueChange={(month) => update({ month })}
            disabled={disabled}
          >
            <SelectTrigger
              id={`${uid}-month`}
              // `SelectTrigger` sets its height with a variant class (`data-[size=default]:h-8`),
              // which outranks a plain `h-11` — the same note as in `select-field.tsx`.
              className="h-11 w-full data-[size=default]:h-11"
              aria-invalid={error ? true : undefined}
            >
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, index) => (
                <SelectItem key={name} value={String(index + 1).padStart(2, "0")}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${uid}-year`} className="sr-only">
            Año
          </Label>
          <Input
            id={`${uid}-year`}
            className="h-11"
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="Año"
            maxLength={4}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            value={parts.year}
            onChange={(event) => update({ year: digitsOnly(event.target.value, 4) })}
            onBlur={onBlur}
          />
        </div>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
