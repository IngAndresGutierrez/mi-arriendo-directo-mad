"use client";

import type { DossierLabels } from "../domain/labels";
import type { Dictionary } from "@/shared/i18n";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import { AmountField } from "@/shared/form/amount-field";
import { ConsentCheckbox } from "@/shared/form/consent-checkbox";
import { PhoneField } from "@/shared/form/phone-field";
import { SelectField } from "@/shared/form/select-field";
import { TextField } from "@/shared/form/text-field";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import {
  DOCUMENT_TYPES,
  OCCUPATIONS,
  type Occupation,
} from "../domain/tenant-profile";
import type { TenantDossierInput } from "../validations/tenant-profile";

/*
 * Built **per render** from the `labels` prop rather than hoisted to module scope as they were:
 * a module constant cannot be re-evaluated per language, and hoisting them again would freeze the
 * options in whichever language happened to load first. Two `map`s over three and five values.
 */
function documentOptions(labels: DossierLabels) {
  return DOCUMENT_TYPES.map((value) => ({ value, label: labels.documentTypes[value] }));
}
function occupationOptions(labels: DossierLabels) {
  return OCCUPATIONS.map((value) => ({ value, label: labels.occupations[value] }));
}

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
export function DossierFields({
  common,
  labels,
  copy,
}: {
  /**
   * Shared words this block needs (the phone field's two ARIA labels), resolved by the server
   * parent. A prop because everything here is `"use client"`.
   */
  readonly common: Dictionary["common"];
  /**
   * The dossier's vocabulary, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly labels: DossierLabels;
  /** The dossier's own sentences, resolved by the page. */
  readonly copy: Dictionary["dossier"];
}) {
  const DOCUMENT_OPTIONS = documentOptions(labels);
  const OCCUPATION_OPTIONS = occupationOptions(labels);
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
        <h2 className="font-semibold text-primary dark:text-foreground">{copy.whoYouAre}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="documentType"
            render={({ field }) => (
              <SelectField
                id="documentType"
                label={copy.documentType}
                placeholder={copy.chooseOneMasc}
                options={DOCUMENT_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.documentType?.message}
              />
            )}
          />
          <TextField
            id="documentNumber"
            label={copy.documentNumber}
            inputMode="numeric"
            autoComplete="off"
            error={errors.documentNumber?.message}
            {...register("documentNumber")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">{copy.howYouEarn}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="occupation"
            render={({ field }) => (
              <SelectField
                id="occupation"
                label={copy.occupation}
                placeholder={copy.chooseOne}
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
            label={occupation ? labels.employerLabels[occupation] : labels.employerLabels.employee}
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
                label={copy.monthlyIncome}
                hint={copy.monthlyIncomeHint}
                value={String(field.value ?? "")}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.monthlyIncome?.message}
              />
            )}
          />
          <TextField
            id="householdSize"
            label={copy.household}
            type="number"
            min={1}
            inputMode="numeric"
            error={errors.householdSize?.message}
            {...register("householdSize")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">{copy.pets}</h2>

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
            {copy.hasPets}
          </Label>
        </div>

        {hasPets ? (
          <TextField
            id="petsDescription"
            label={copy.tellTheLandlord}
            hint={copy.petsHint}
            error={errors.petsDescription?.message}
            {...register("petsDescription")}
          />
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-primary dark:text-foreground">{copy.reference}</h2>
        <p className="text-sm text-muted-foreground">
          {copy.referenceIntro}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="reference.name"
            // Not "Nombre completo": next to the tenant's own name, that reads as being asked
            // for it a second time, which is exactly how this page looked before.
            label={copy.referenceName}
            autoComplete="off"
            error={errors.reference?.name?.message}
            {...register("reference.name")}
          />
          <TextField
            id="reference.relationship"
            label={copy.referenceRelation}
            hint={copy.referenceRelationHint}
            error={errors.reference?.relationship?.message}
            {...register("reference.relationship")}
          />
        </div>

        <Controller
          control={control}
          name="reference.phoneCountry"
          render={({ field }) => (
            <PhoneField
            copy={common}
              label={copy.referencePhone}
              country={field.value}
              onCountryChange={field.onChange}
              countryError={errors.reference?.phoneCountry?.message}
              numberError={errors.reference?.phone?.message}
              inputProps={register("reference.phone")}
            />
          )}
        />

        {/*
          **The reference is a third party who never authorised anything.** This is the one field
          in the product where somebody hands us another person's name and phone number, and Ley
          1581 requires the authorisation of the *titular* — who here is the reference, not the
          person filling this form. We cannot obtain it directly, so what we can do is put the
          declaration on the record and make the obligation visible. Required, and asked again on
          every save: the tick is about the number in the field above it, and that field is
          editable.
        */}
        <Controller
          control={control}
          name="referenceAuthorized"
          render={({ field }) => (
            <ConsentCheckbox
              id="referenceAuthorized"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              error={errors.referenceAuthorized?.message}
            >
              {copy.referenceAuthorized}
            </ConsentCheckbox>
          )}
        />
      </section>
    </div>
  );
}
