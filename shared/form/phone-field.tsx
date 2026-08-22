"use client";

import { useId } from "react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { COUNTRIES, findCountry, phoneRuleFor } from "@/shared/phone/countries";

type PhoneFieldProps = {
  label: string;
  /** ISO of the selected country. */
  country: string;
  onCountryChange: (iso: string) => void;
  countryError?: string;
  numberError?: string;
  disabled?: boolean;
  /** Props from react-hook-form's `register("phone.national")`. */
  inputProps: React.ComponentProps<"input">;
};

/**
 * International phone: country selector + national number.
 *
 * One `<label>` for the number; the country selector carries its own `aria-label` because
 * it is a separate control that needs its own accessible name.
 */
export function PhoneField({
  label,
  country,
  onCountryChange,
  countryError,
  numberError,
  disabled = false,
  inputProps,
}: PhoneFieldProps) {
  const error = countryError ?? numberError;
  const selected = findCountry(country);
  const rule = phoneRuleFor(country);
  /*
   * Generated, not fixed. Two of these can share a page — your own number and your reference's
   * — and with a hardcoded id `label for=` resolves to the *first* match: typing in the second
   * field went into the first, and the second stayed empty while looking filled in.
   */
  const uid = useId();
  const inputId = `${uid}-phone`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>

      <div className="flex items-stretch gap-2">
        <Select value={country} onValueChange={onCountryChange} disabled={disabled}>
          <SelectTrigger
            aria-label="Código de país"
            // `data-[size=default]:h-11` and not just `h-11`: SelectTrigger ships
            // `data-[size=default]:h-8`, and a variant class beats a flat one on
            // specificity. Without this the selector ends up shorter than the input.
            className="h-11 w-[7.5rem] shrink-0 data-[size=default]:h-11"
            aria-invalid={countryError ? true : undefined}
          >
            {/* The trigger shows flag and dial code; the full name lives in the list. */}
            <SelectValue placeholder="País">
              {selected ? (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">{selected.flag}</span>
                  <span>{selected.dialCode}</span>
                </span>
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((option) => (
              <SelectItem key={option.iso} value={option.iso}>
                <span aria-hidden="true" className="mr-1.5">
                  {option.flag}
                </span>
                {option.name}
                <span className="ml-1.5 text-muted-foreground">{option.dialCode}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={rule.example}
          className="h-11 flex-1"
          aria-invalid={numberError ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          {...inputProps}
        />
      </div>

      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
