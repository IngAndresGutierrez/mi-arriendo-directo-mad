"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { BirthDateField } from "@/shared/form/birth-date-field";
import { PhoneField } from "@/shared/form/phone-field";
import { SelectField } from "@/shared/form/select-field";
import { TextField } from "@/shared/form/text-field";
import { DEPARTMENTS, type Department } from "@/shared/geo/colombia";
import { municipalitiesOf } from "@/shared/geo/municipalities";

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
  const form = useFormContext<CompleteProfileFormValues>();
  const {
    control,
    register,
    trigger,
    formState: { errors },
  } = form;

  // `useWatch`, never `watch()`: the latter returns a function the React Compiler cannot memoize.
  const nationalPhone = useWatch({ control, name: "phone.national" });

  // The city depends on the department: 1.122 municipalities in one list is not a list anybody
  // reads, and free text let "Manizales, Antioquia" through — a pair that does not exist.
  const department = useWatch({ control, name: "address.department" });
  const cityOptions = department
    ? municipalitiesOf(department as Department).map((value) => ({ value, label: value }))
    : [];

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
              label="Género (opcional)"
              placeholder="Prefiero no responder"
              options={GENDER_OPTIONS}
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              error={errors.gender?.message}
              disabled={disabled}
              /*
               * **The sentence art. 6 of Ley 1581 requires**: sensitive data cannot be demanded,
               * and the person has to be told they are free not to give it. Permanent text and not
               * a tooltip — a right you only learn about by hovering is one most people never
               * learn about — and the label carries "(opcional)" as well, because a field is read
               * before its hint is.
               */
              hint="Es un dato sensible: no estás obligado a darlo y puedes dejarlo en blanco."
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

        {/* Departamento primero: es lo que decide qué ciudades hay. */}
        <div className="grid gap-3 sm:grid-cols-2">
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
                onValueChange={(value) => {
                  field.onChange(value);
                  // The city almost certainly does not exist in the new department, and leaving
                  // it would submit a pair that only the server would catch.
                  form.setValue("address.city", "", {
                    shouldValidate: form.formState.isSubmitted,
                  });
                }}
                error={errors.address?.department?.message}
                disabled={disabled}
              />
            )}
          />

          <Controller
            control={control}
            name="address.city"
            render={({ field }) => (
              <SelectField
                // Remounted with the department: Radix keeps the old selection otherwise, and
                // the field shows a city that is no longer among its options.
                key={department ?? "sin-departamento"}
                id="address.city"
                label="Ciudad"
                placeholder={
                  cityOptions.length > 0 ? "Selecciona tu ciudad" : "Elige primero el departamento"
                }
                options={cityOptions}
                disabled={disabled || cityOptions.length === 0}
                value={field.value || undefined}
                onValueChange={field.onChange}
                error={errors.address?.city?.message}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
