"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, findCountry, phoneRuleFor } from "@/lib/domain/countries";

type PhoneFieldProps = {
  label: string;
  /** ISO del país seleccionado. */
  country: string;
  onCountryChange: (iso: string) => void;
  countryError?: string;
  numberError?: string;
  disabled?: boolean;
  /** Props de `register("phone.national")` de react-hook-form. */
  inputProps: React.ComponentProps<"input">;
};

/**
 * Teléfono internacional: selector de país + número nacional.
 *
 * Un solo `<label>` para el número; el selector de país lleva su propio `aria-label` porque
 * es un control aparte que necesita nombre accesible propio.
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
  const errorId = "phone-error";

  return (
    <div className="space-y-2">
      <Label htmlFor="phone.national">{label}</Label>

      <div className="flex items-stretch gap-2">
        <Select value={country} onValueChange={onCountryChange} disabled={disabled}>
          <SelectTrigger
            aria-label="Código de país"
            // `data-[size=default]:h-11` y no solo `h-11`: SelectTrigger trae
            // `data-[size=default]:h-8`, y una clase con variante gana por especificidad a
            // una plana. Sin esto el selector queda más bajo que el input.
            className="h-11 w-[7.5rem] shrink-0 data-[size=default]:h-11"
            aria-invalid={countryError ? true : undefined}
          >
            {/* El trigger muestra bandera e indicativo; el nombre completo va en la lista. */}
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
          id="phone.national"
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
