"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { BirthDateField } from "@/shared/form/birth-date-field";
import { PhoneField } from "@/shared/form/phone-field";
import { SelectField } from "@/shared/form/select-field";
import { TextField } from "@/shared/form/text-field";
import { DEPARTMENTS } from "@/shared/geo/colombia";

import { GENDER_OPTIONS } from "../domain/profile";
import type { CompleteProfileFormValues } from "../validations/profile";

const DEPARTMENT_OPTIONS = DEPARTMENTS.map((value) => ({ value, label: value }));

/**
 * Who the person is: the fields asked once at signup.
 *
 * They live here, on the form context, because two screens need exactly the same block — the
 * onboarding form and the profile page — and the second one exists precisely because someone
 * filled these in and then never saw them again. Duplicating the markup would have meant
 * duplicating the ARIA wiring too, which is how a field ends up with an error nobody renders.
 */
export function AccountFields({ disabled = false }: { readonly disabled?: boolean }) {
  const {
    control,
    register,
    trigger,
    formState: { errors },
  } = useFormContext<CompleteProfileFormValues>();

  // `useWatch`, never `watch()`: the latter returns a function the React Compiler cannot memoize.
  const nationalPhone = useWatch({ control, name: "phone.national" });

  return (
    <div className="space-y-3">
      <TextField
        id="fullName"
        label="Nombre completo"
        autoComplete="name"
        placeholder="Ana María Restrepo"
        error={errors.fullName?.message}
        disabled={disabled}
        {...register("fullName")}
      />

      <Controller
        control={control}
        name="phone.country"
        render={({ field }) => (
          <PhoneField
            label="Teléfono"
            country={field.value}
            onCountryChange={(iso) => {
              field.onChange(iso);
              // The number's rule depends on the country: without revalidating, the previous
              // country's error stays visible even once the number is valid.
              if (nationalPhone) void trigger("phone");
            }}
            countryError={errors.phone?.country?.message}
            numberError={errors.phone?.national?.message}
            disabled={disabled}
            inputProps={register("phone.national")}
          />
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <SelectField
              id="gender"
              label="Género"
              placeholder="Selecciona una opción"
              options={GENDER_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
              error={errors.gender?.message}
              disabled={disabled}
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <BirthDateField
              label="Fecha de nacimiento"
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.birthDate?.message}
              disabled={disabled}
            />
          )}
        />
      </div>

      {/*
        No `fieldset`: a group without a `legend` has no accessible name, and adding the legend
        back broke the goal of fitting the screen without scrolling. The three labels speak for
        themselves and there is only one address.
      */}
      <div className="space-y-2.5">
        <TextField
          id="address.line"
          label="Dirección"
          autoComplete="street-address"
          placeholder="Calle 60 #10-20, apto 301"
          error={errors.address?.line?.message}
          disabled={disabled}
          {...register("address.line")}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="address.city"
            label="Ciudad"
            autoComplete="address-level2"
            placeholder="Bogotá"
            error={errors.address?.city?.message}
            disabled={disabled}
            {...register("address.city")}
          />

          <Controller
            control={control}
            name="address.department"
            render={({ field }) => (
              <SelectField
                id="address.department"
                label="Departamento"
                placeholder="Selecciona uno"
                options={DEPARTMENT_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.address?.department?.message}
                disabled={disabled}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
