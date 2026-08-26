"use client";

import type { Dictionary } from "@/shared/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { FormAlert } from "@/shared/form/form-alert";
import { PhoneField } from "@/shared/form/phone-field";
import { SelectField } from "@/shared/form/select-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Label } from "@/shared/ui/label";

import { createErrand } from "../actions/create-errand";
import { ERRAND_TYPES, ERRAND_TYPE_LABELS } from "../domain/errand";
import { createErrandFormSchema } from "../validations/errand";

/**
 * The landlord hands out one errand.
 *
 * **Name and phone are typed every time, and there is no picker of past collaborators.** That is a
 * deliberate simplification of what was here before, which required the person to already have an
 * account: a sporadic figure had to sign up, verify an email and complete a profile before they
 * could be asked to open a door once. Now the account is made from the number, and a number that has
 * been used before resolves to the same collaborator — so typing it again costs nothing and adding a
 * roster to choose from can wait until somebody actually has a roster.
 *
 * The two dates fields are a day and an hour read as Bogotá wall time, the same pair the interview
 * and the visit use. The server re-checks that the moment is still in the future against **its own**
 * clock: a browser's is whatever the person set it to.
 */
export function ErrandForm({
  propertyId,
  propertyTitle,
  properties,
  common,
}: {
  readonly propertyId: string;
  readonly propertyTitle: string;
  /**
   * The landlord's listings, when the errand is being created from `/encargos` instead of from one
   * property.
   *
   * **Two entry points, one form.** Coming from a property the choice is already made and asking
   * again would be asking somebody to confirm what they just clicked; coming from the errands list
   * there is nothing to infer, so it becomes a select. A second component would be the same fields
   * twice, and the copy of a form is the one that stops matching the schema.
   */
  readonly properties?: readonly { readonly id: string; readonly title: string }[];
  /**
   * Shared words the phone field needs, resolved by the page. A prop because this is a Client
   * Component: importing the dictionary here would put both languages in the browser bundle.
   */
  readonly common: Dictionary["common"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<
    z.input<typeof createErrandFormSchema>,
    unknown,
    z.output<typeof createErrandFormSchema>
  >({
    resolver: zodResolver(createErrandFormSchema),
    mode: "onBlur",
    defaultValues: {
      propertyId,
      type: "showing",
      title: "",
      description: "",
      day: "",
      time: "",
      name: "",
      phoneCountry: "CO",
      phoneNational: "",
    },
  });

  return (
    <>
      <p className="mb-8 text-muted-foreground">
        Le llega un mensaje por WhatsApp y por SMS con lo que hay que hacer, dónde y cuándo. No
        necesita cuenta: entra con un código que le mandamos a ese mismo número.
      </p>

      {/* `post`, though JS submits it: see the note in `login-form.tsx`. */}
      <form
        method="post"
        onSubmit={handleSubmit((values) => {
          setError(null);
          startTransition(async () => {
            const result = await createErrand(values);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(MY_PROPERTIES_ROUTE);
            router.refresh();
          });
        })}
        noValidate
        className="space-y-6"
      >
        {error ? <FormAlert>{error}</FormAlert> : null}

        {properties ? null : <input type="hidden" {...register("propertyId")} />}

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-foreground">
            {properties ? "El encargo" : `El encargo — ${propertyTitle}`}
          </legend>

          {properties ? (
            <Controller
              control={control}
              name="propertyId"
              render={({ field }) => (
                <SelectField
                  id="errand-property"
                  label="¿De qué inmueble?"
                  placeholder="Elige el inmueble"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  error={errors.propertyId?.message}
                  disabled={isPending}
                  options={properties.map((property) => ({
                    value: property.id,
                    label: property.title,
                  }))}
                />
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SelectField
                id="errand-type"
                label="Qué hay que hacer"
                placeholder="Elige el tipo"
                value={field.value ?? "showing"}
                onValueChange={field.onChange}
                error={errors.type?.message}
                disabled={isPending}
                options={ERRAND_TYPES.map((type) => ({
                  value: type,
                  label: ERRAND_TYPE_LABELS[type],
                }))}
              />
            )}
          />

          <TextField
            id="errand-title"
            label="En una frase"
            placeholder="Mostrarle el apartamento a un interesado"
            error={errors.title?.message}
            disabled={isPending}
            {...register("title")}
          />

          <div className="space-y-2">
            <Label htmlFor="errand-description">El detalle</Label>
            <p className="text-sm text-muted-foreground">
              Esta persona no estuvo en la conversación: cuéntale lo que necesita saber para llegar y
              resolver.
            </p>
            <textarea
              id="errand-description"
              rows={4}
              placeholder="El portero tiene copia de la llave. El interesado se llama Juan y llega a las 3."
              disabled={isPending}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              {...register("description")}
            />
            {errors.description?.message ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="errand-day"
              label="Día"
              type="date"
              error={errors.day?.message}
              disabled={isPending}
              {...register("day")}
            />
            <TextField
              id="errand-time"
              label="Hora"
              type="time"
              error={errors.time?.message}
              disabled={isPending}
              {...register("time")}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-6">
          <legend className="text-sm font-medium text-foreground">A quién se lo encargas</legend>

          <TextField
            id="errand-name"
            label="Nombre"
            autoComplete="name"
            error={errors.name?.message}
            disabled={isPending}
            {...register("name")}
          />

          <Controller
            control={control}
            name="phoneCountry"
            render={({ field }) => (
              <PhoneField
            copy={common}
                label="Su WhatsApp"
                country={field.value ?? "CO"}
                onCountryChange={(iso) => {
                  field.onChange(iso);
                  if (getValues("phoneNational")) void trigger("phoneNational");
                }}
                countryError={errors.phoneCountry?.message}
                numberError={errors.phoneNational?.message}
                disabled={isPending}
                inputProps={register("phoneNational")}
              />
            )}
          />
        </fieldset>

        <SubmitButton loading={isPending} disabled={isPending} loadingLabel="Enviando…">
          Encargar y avisarle
        </SubmitButton>
      </form>
    </>
  );
}
