"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/components/auth/form-alert";
import { PhoneField } from "@/components/auth/phone-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { DEPARTMENTS, GENDER_OPTIONS, MIN_AGE } from "@/lib/domain/colombia";
import { DEFAULT_COUNTRY_ISO } from "@/lib/domain/countries";
import {
  completeProfileSchema,
  type CompleteProfileFormValues,
  type CompleteProfileInput,
} from "@/lib/validations/profile";

import { refreshServerSession } from "@/lib/auth/client";

import { completeProfile } from "./actions";

const DEPARTMENT_OPTIONS = DEPARTMENTS.map((name) => ({ value: name, label: name }));

const FIELD_NAMES = [
  "fullName",
  "phone",
  "gender",
  "address",
  "birthDate",
  "acceptsTerms",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];

/** Los errores del servidor llegan con clave `string`; solo aceptamos las conocidas. */
function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/** Tope del `<input type="date">`: hoy menos la edad mínima. */
function maxBirthDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MIN_AGE);
  return date.toISOString().slice(0, 10);
}

export function CompleteProfileForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileFormValues, unknown, CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      // Colombia preseleccionada: es el mercado del producto.
      phone: { country: DEFAULT_COUNTRY_ISO, national: "" },
      gender: undefined,
      address: { line: "", city: "", department: undefined },
      birthDate: "",
      acceptsTerms: false,
    },
  });

  // El número ya escrito, para saber si vale la pena revalidar al cambiar de país.
  const nationalPhone = useWatch({ control, name: "phone.national" });

  const isSaving = isSubmitting || isNavigating;

  async function onSubmit(values: CompleteProfileInput) {
    setFormError(null);

    const formData = new FormData();
    formData.set("fullName", values.fullName);
    formData.set("phone.country", values.phone.country);
    formData.set("phone.national", values.phone.national);
    formData.set("gender", values.gender);
    formData.set("address.line", values.address.line);
    formData.set("address.city", values.address.city);
    formData.set("address.department", values.address.department);
    formData.set("birthDate", values.birthDate);
    formData.set("acceptsTerms", String(values.acceptsTerms));

    const result = await completeProfile(formData);

    if (!result.ok) {
      // Los errores del servidor se pintan en su campo; el resto va a la alerta general.
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && isFieldName(field)) setError(field, { message });
      }
      if (result.message) setFormError(result.message);
      else if (!result.fieldErrors) setFormError("No pudimos guardar tu perfil.");
      return;
    }

    // La acción acaba de fijar el claim del rol, pero la cookie se acuñó antes y todavía
    // no lo tiene: sin refrescarla, el servidor leería el rol equivocado.
    try {
      await refreshServerSession();
    } catch {
      setFormError(
        "Guardamos tu perfil, pero tu sesión quedó desactualizada. Vuelve a iniciar sesión.",
      );
      return;
    }

    startNavigation(() => {
      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <TextField
        id="fullName"
        label="Nombre completo"
        autoComplete="name"
        placeholder="Ana María Restrepo"
        error={errors.fullName?.message}
        disabled={isSaving}
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
              // La regla del número depende del país: sin revalidar, el error del país
              // anterior se queda visible aunque el número ya sea válido en el nuevo.
              if (nationalPhone) void trigger("phone");
            }}
            countryError={errors.phone?.country?.message}
            numberError={errors.phone?.national?.message}
            disabled={isSaving}
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
            disabled={isSaving}
          />
        )}
      />

        <TextField
        id="birthDate"
        label="Fecha de nacimiento"
        type="date"
        autoComplete="bday"
        max={maxBirthDate()}
        error={errors.birthDate?.message}
        disabled={isSaving}
        {...register("birthDate")}
      />
      </div>

      {/*
        Sin `fieldset`: un grupo sin `legend` no tiene nombre accesible, y reponer la leyenda
        rompía el objetivo de que la pantalla quepa sin scroll. Las tres etiquetas
        (Dirección, Ciudad, Departamento) se explican solas y hay una sola dirección.
      */}
      <div className="space-y-2.5">
        
        <TextField
          id="address.line"
          label="Dirección"
          autoComplete="street-address"
          placeholder="Calle 60 #10-20, apto 301"
          error={errors.address?.line?.message}
          disabled={isSaving}
          {...register("address.line")}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="address.city"
            label="Ciudad"
            autoComplete="address-level2"
            placeholder="Bogotá"
            error={errors.address?.city?.message}
            disabled={isSaving}
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
                disabled={isSaving}
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="acceptsTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptsTerms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isSaving}
                aria-invalid={errors.acceptsTerms ? true : undefined}
                aria-describedby={errors.acceptsTerms ? "acceptsTerms-error" : undefined}
                className="mt-0.5"
              />
            )}
          />
          {/*
            `block`: el Label de shadcn trae `flex`, y eso convierte el texto y los enlaces
            en items de flex, que se apilan en lugar de fluir como párrafo.
          */}
          <Label htmlFor="acceptsTerms" className="block text-sm leading-relaxed font-normal">
            Autorizo el tratamiento de mis datos personales y acepto los{" "}
            <Link href="/terminos" className="underline underline-offset-2">
              Términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </Label>
        </div>
        {errors.acceptsTerms ? (
          <p id="acceptsTerms-error" className="text-sm text-destructive">
            {errors.acceptsTerms.message}
          </p>
        ) : null}
      </div>

      <SubmitButton loading={isSaving} loadingLabel="Guardando…">
        Guardar y continuar
      </SubmitButton>
    </form>
  );
}
