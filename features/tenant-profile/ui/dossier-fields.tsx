"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { AmountField } from "@/shared/form/amount-field";
import { PhoneField } from "@/shared/form/phone-field";
import { SelectField } from "@/shared/form/select-field";
import { TextField } from "@/shared/form/text-field";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  EMPLOYER_LABELS,
  OCCUPATIONS,
  OCCUPATION_LABELS,
  type Occupation,
} from "../domain/tenant-profile";
import type { TenantDossierInput } from "../validations/tenant-profile";

const DOCUMENT_OPTIONS = DOCUMENT_TYPES.map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABELS[value],
}));
const OCCUPATION_OPTIONS = OCCUPATIONS.map((value) => ({
  value,
  label: OCCUPATION_LABELS[value],
}));

/**
 * The dossier fields, shared by the two places that collect them: the application form and the
 * tenant's own profile.
 *
 * They read the form off the context rather than taking it as a prop, so the two parents can
 * differ in everything else — what they submit to, what they add around it — without this
 * having to know.
 *
 * Nothing here is verified by the platform; the documents that back it up are a later stage.
 * The copy says so, because a form that looks like a credit check and is not is a form that
 * misleads both sides.
 */
export function DossierFields() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<TenantDossierInput>();

  // `useWatch`, never `watch()`: the latter returns a function the React Compiler cannot memoize.
  const occupation = useWatch({ control, name: "occupation" }) as Occupation | undefined;
  const hasPets = useWatch({ control, name: "hasPets" });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">Quién eres</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="documentType"
            render={({ field }) => (
              <SelectField
                id="documentType"
                label="Tipo de documento"
                placeholder="Elige uno"
                options={DOCUMENT_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.documentType?.message}
              />
            )}
          />
          <TextField
            id="documentNumber"
            label="Número de documento"
            inputMode="numeric"
            autoComplete="off"
            error={errors.documentNumber?.message}
            {...register("documentNumber")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">De qué vives</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="occupation"
            render={({ field }) => (
              <SelectField
                id="occupation"
                label="Ocupación"
                placeholder="Elige una"
                options={OCCUPATION_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.occupation?.message}
              />
            )}
          />
          {/* The question changes with the answer above it: an independent has no employer. */}
          <TextField
            id="employer"
            label={occupation ? EMPLOYER_LABELS[occupation] : "Dónde trabajas"}
            autoComplete="organization"
            error={errors.employer?.message}
            {...register("employer")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="monthlyIncome"
            render={({ field }) => (
              <AmountField
                id="monthlyIncome"
                label="Ingresos mensuales (COP)"
                hint="Lo que recibes al mes, antes de descuentos."
                value={String(field.value ?? "")}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.monthlyIncome?.message}
              />
            )}
          />
          <TextField
            id="householdSize"
            label="Personas que vivirían ahí"
            type="number"
            min={1}
            inputMode="numeric"
            error={errors.householdSize?.message}
            {...register("householdSize")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">Mascotas</h2>

        <div className="flex items-center gap-2.5">
          <Controller
            control={control}
            name="hasPets"
            render={({ field }) => (
              <Checkbox
                id="hasPets"
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="hasPets" className="cursor-pointer font-normal text-foreground">
            Tengo mascotas
          </Label>
        </div>

        {hasPets ? (
          <TextField
            id="petsDescription"
            label="Cuéntale al propietario"
            hint="Cuántas, de qué tipo y tamaño. Es la razón más común por la que se rechaza una postulación: decirlo de frente juega a tu favor."
            error={errors.petsDescription?.message}
            {...register("petsDescription")}
          />
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">Referencia personal</h2>
        <p className="text-sm text-muted-foreground">
          Alguien que pueda hablar por ti. No es un codeudor: la garantía se define más adelante.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="reference.name"
            // Not "Nombre completo": next to the tenant's own name, that reads as being asked
            // for it a second time, which is exactly how this page looked before.
            label="Nombre de tu referencia"
            autoComplete="off"
            error={errors.reference?.name?.message}
            {...register("reference.name")}
          />
          <TextField
            id="reference.relationship"
            label="Qué relación tienen"
            hint="Jefe, arrendador anterior, colega…"
            error={errors.reference?.relationship?.message}
            {...register("reference.relationship")}
          />
        </div>

        <Controller
          control={control}
          name="reference.phoneCountry"
          render={({ field }) => (
            <PhoneField
              label="Teléfono de tu referencia"
              country={field.value}
              onCountryChange={field.onChange}
              countryError={errors.reference?.phoneCountry?.message}
              numberError={errors.reference?.phone?.message}
              inputProps={register("reference.phone")}
            />
          )}
        />
      </section>
    </div>
  );
}
