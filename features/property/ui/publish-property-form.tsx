"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { refreshServerSession } from "@/shared/auth/client";
import { propertyDetailRoute } from "@/shared/auth/routes";
import { DEPARTMENTS } from "@/shared/geo/colombia";
import { FormAlert } from "@/shared/form/form-alert";
import { SelectField } from "@/shared/form/select-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import { publishProperty } from "../actions/publish-property";
import {
  LEASE_TERMS,
  LEASE_TERM_LABELS,
  PARKING_KINDS,
  PARKING_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  STRATA,
  type PropertyPhoto,
} from "../domain/property";
import {
  publishPropertySchema,
  type PublishPropertyFormValues,
  type PublishPropertyInput,
} from "../validations/property";
import { PhotoUploader } from "./photo-uploader";

const TYPE_OPTIONS = PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }));
const DEPARTMENT_OPTIONS = DEPARTMENTS.map((value) => ({ value, label: value }));
const PARKING_OPTIONS = PARKING_KINDS.map((value) => ({ value, label: PARKING_LABELS[value] }));
const STRATUM_OPTIONS = STRATA.map((value) => ({ value: String(value), label: `Estrato ${value}` }));
const LEASE_OPTIONS = LEASE_TERMS.map((value) => ({
  value: String(value),
  label: LEASE_TERM_LABELS[value],
}));

/** The field names the Server Action can return errors for. */
const FIELD_NAMES = [
  "title",
  "description",
  "type",
  "rent",
  "adminFee",
  "areaM2",
  "bedrooms",
  "bathrooms",
  "parking",
  "stratum",
  "minLeaseMonths",
  "availableFrom",
  "address",
  "photos",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/** Today, as `<input type="date">` wants it. The server re-checks against its own clock. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The form a landlord fills to publish a property.
 *
 * It is one page rather than a wizard: everything asked here is information the landlord
 * already has in their head, and a five-step wizard would only add ceremony. The sections are
 * the reading order of the listing itself, so the form doubles as a preview of what a tenant
 * will see.
 */
export function PublishPropertyForm() {
  const router = useRouter();
  const [photos, setPhotos] = useState<readonly PropertyPhoto[]>([]);

  const form = useForm<PublishPropertyFormValues, unknown, PublishPropertyInput>({
    resolver: zodResolver(publishPropertySchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      type: "apartment",
      rent: "",
      adminFee: "0",
      areaM2: "",
      bedrooms: "",
      bathrooms: "",
      parking: "none",
      stratum: "",
      furnished: false,
      petsAllowed: false,
      minLeaseMonths: "12",
      availableFrom: todayISO(),
      address: { line: "", neighborhood: "", city: "", department: "Caldas" },
      photos: [],
    },
  });

  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: PublishPropertyInput) {
    const data = new FormData();
    data.set("title", values.title);
    data.set("description", values.description);
    data.set("type", values.type);
    data.set("rent", String(values.rent));
    data.set("adminFee", String(values.adminFee));
    data.set("areaM2", String(values.areaM2));
    data.set("bedrooms", String(values.bedrooms));
    data.set("bathrooms", String(values.bathrooms));
    data.set("parking", values.parking);
    data.set("stratum", String(values.stratum));
    data.set("furnished", String(values.furnished));
    data.set("petsAllowed", String(values.petsAllowed));
    data.set("minLeaseMonths", String(values.minLeaseMonths));
    data.set("availableFrom", values.availableFrom);
    data.set("address.line", values.address.line);
    data.set("address.neighborhood", values.address.neighborhood);
    data.set("address.city", values.address.city);
    data.set("address.department", values.address.department);
    data.set("photos", JSON.stringify(values.photos));

    const result = await publishProperty(data);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (isFieldName(field)) form.setError(field, { message: messages?.[0] });
      }
      if (result.message) form.setError("root", { message: result.message });
      return;
    }

    // The action promoted the account to landlord, but this browser's cookie was minted before
    // the claim existed: without re-minting it the server keeps reading the old role.
    if (result.rolePromoted) await refreshServerSession();

    router.push(propertyDetailRoute(result.id));
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10" noValidate>
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">El inmueble</h2>
        <TextField
          id="title"
          label="Título del anuncio"
          placeholder="Apartamento luminoso en Palermo"
          error={errors.title?.message}
          {...form.register("title")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción</Label>
          <textarea
            id="description"
            rows={5}
            placeholder="Cuéntale al inquilino cómo es el inmueble, qué incluye y qué hay cerca."
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "description-error" : undefined}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            {...form.register("description")}
          />
          {errors.description && (
            <p id="description-error" className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <SelectField
              id="type"
              label="Tipo de inmueble"
              placeholder="Selecciona el tipo"
              options={TYPE_OPTIONS}
              value={field.value as string}
              onValueChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Características</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="areaM2"
            label="Área (m²)"
            inputMode="numeric"
            error={errors.areaM2?.message}
            {...form.register("areaM2")}
          />
          <Controller
            control={form.control}
            name="stratum"
            render={({ field }) => (
              <SelectField
                id="stratum"
                label="Estrato"
                placeholder="Selecciona"
                options={STRATUM_OPTIONS}
                value={field.value === undefined || field.value === "" ? undefined : String(field.value)}
                onValueChange={field.onChange}
                error={errors.stratum?.message}
              />
            )}
          />
          <TextField
            id="bedrooms"
            label="Habitaciones"
            inputMode="numeric"
            error={errors.bedrooms?.message}
            {...form.register("bedrooms")}
          />
          <TextField
            id="bathrooms"
            label="Baños"
            inputMode="numeric"
            error={errors.bathrooms?.message}
            {...form.register("bathrooms")}
          />
          <Controller
            control={form.control}
            name="parking"
            render={({ field }) => (
              <SelectField
                id="parking"
                label="Parqueadero"
                placeholder="Selecciona"
                options={PARKING_OPTIONS}
                value={field.value as string}
                onValueChange={field.onChange}
                error={errors.parking?.message}
              />
            )}
          />
        </div>

        <div className="flex flex-wrap gap-6">
          <Controller
            control={form.control}
            name="furnished"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="furnished"
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label htmlFor="furnished" className="block font-normal">
                  Amoblado
                </Label>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="petsAllowed"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="petsAllowed"
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label htmlFor="petsAllowed" className="block font-normal">
                  Acepta mascotas
                </Label>
              </div>
            )}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Ubicación</h2>
        <TextField
          id="address.line"
          label="Dirección"
          placeholder="Calle 60 #10-20 apto 301"
          hint="Solo la ve el inquilino cuya postulación apruebes. En el anuncio se muestran el barrio y la ciudad."
          error={errors.address?.line?.message}
          {...form.register("address.line")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="address.neighborhood"
            label="Barrio"
            error={errors.address?.neighborhood?.message}
            {...form.register("address.neighborhood")}
          />
          <TextField
            id="address.city"
            label="Ciudad"
            error={errors.address?.city?.message}
            {...form.register("address.city")}
          />
        </div>
        <Controller
          control={form.control}
          name="address.department"
          render={({ field }) => (
            <SelectField
              id="address.department"
              label="Departamento"
              placeholder="Selecciona el departamento"
              options={DEPARTMENT_OPTIONS}
              value={field.value as string}
              onValueChange={field.onChange}
              error={errors.address?.department?.message}
            />
          )}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Condiciones</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="rent"
            label="Canon mensual (COP)"
            inputMode="numeric"
            placeholder="1800000"
            error={errors.rent?.message}
            {...form.register("rent")}
          />
          <TextField
            id="adminFee"
            label="Administración (COP)"
            inputMode="numeric"
            hint="Escribe 0 si el inmueble no paga administración."
            error={errors.adminFee?.message}
            {...form.register("adminFee")}
          />
          <TextField
            id="availableFrom"
            label="Disponible desde"
            type="date"
            min={todayISO()}
            error={errors.availableFrom?.message}
            {...form.register("availableFrom")}
          />
        </div>
        <Controller
          control={form.control}
          name="minLeaseMonths"
          render={({ field }) => (
            <SelectField
              id="minLeaseMonths"
              label="Duración mínima del arriendo"
              placeholder="Selecciona la duración"
              options={LEASE_OPTIONS}
              value={String(field.value)}
              onValueChange={field.onChange}
              error={errors.minLeaseMonths?.message}
            />
          )}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Fotos</h2>
        <PhotoUploader
          photos={photos}
          error={errors.photos?.message}
          onChange={(next) => {
            setPhotos(next);
            form.setValue("photos", [...next], { shouldValidate: form.formState.isSubmitted });
          }}
        />
      </section>

      <SubmitButton loading={isSubmitting} loadingLabel="Publicando…">
        Publicar inmueble
      </SubmitButton>
    </form>
  );
}
