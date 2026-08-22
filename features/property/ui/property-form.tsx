"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { refreshServerSession } from "@/shared/auth/client";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { DEPARTMENTS, type Department } from "@/shared/geo/colombia";
import { municipalitiesOf } from "@/shared/geo/municipalities";
import { AmountField } from "@/shared/form/amount-field";
import { FormAlert } from "@/shared/form/form-alert";
import { SelectField } from "@/shared/form/select-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import { updateProperty } from "../actions/manage-property";
import { publishProperty } from "../actions/publish-property";
import {
  LEASE_TERMS,
  LEASE_TERM_LABELS,
  PARKING_KINDS,
  PARKING_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  STRATA,
  type Property,
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

type PropertyFormProps = {
  /** Present when editing: the listing as it is stored today. Absent when publishing. */
  readonly property?: Property;
  /** The street address, which lives outside the public document. Only for editing. */
  readonly addressLine?: string;
};

/**
 * The form a landlord fills to publish a property — and the same one they edit it with.
 *
 * It is one page rather than a wizard: everything asked here is information the landlord
 * already has in their head, and a five-step wizard would only add ceremony. The sections are
 * the reading order of the listing itself, so the form doubles as a preview of what a tenant
 * will see.
 *
 * Publishing and editing share it on purpose: two forms for one shape is how a field ends up
 * being addable but not editable.
 */
export function PropertyForm({ property, addressLine }: PropertyFormProps) {
  const router = useRouter();
  const isEditing = property !== undefined;
  const [photos, setPhotos] = useState<readonly PropertyPhoto[]>(property?.photos ?? []);

  const form = useForm<PublishPropertyFormValues, unknown, PublishPropertyInput>({
    resolver: zodResolver(publishPropertySchema),
    mode: "onBlur",
    defaultValues: property
      ? {
          title: property.title,
          description: property.description,
          type: property.type,
          rent: String(property.rent),
          adminFee: String(property.adminFee),
          areaM2: String(property.areaM2),
          bedrooms: String(property.bedrooms),
          bathrooms: String(property.bathrooms),
          parking: property.parking,
          stratum: String(property.stratum),
          furnished: property.furnished,
          petsAllowed: property.petsAllowed,
          minLeaseMonths: String(property.minLeaseMonths),
          availableFrom: property.availableFrom,
          address: {
            line: addressLine ?? "",
            neighborhood: property.area.neighborhood,
            city: property.area.city,
            department: property.area.department,
          },
          photos: [...property.photos],
        }
      : {
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
          // No default department: the city list hangs off it, and a preselected one would
          // quietly publish in the wrong place.
          address: { line: "", neighborhood: "", city: "", department: undefined },
          photos: [],
        },
  });

  const { errors, isSubmitting } = form.formState;

  // `useWatch`, never `watch()`: the latter returns a function the React Compiler cannot memoize.
  const department = useWatch({ control: form.control, name: "address.department" });
  const cityOptions = municipalitiesOf(department as Department).map((value) => ({
    value,
    label: value,
  }));

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

    const result = property
      ? await updateProperty(property.id, data)
      : await publishProperty(data);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (isFieldName(field)) form.setError(field, { message: messages?.[0] });
      }
      if (result.message) form.setError("root", { message: result.message });
      return;
    }

    // The action promoted the account to landlord, but this browser's cookie was minted before
    // the claim existed: without re-minting it the server keeps reading the old role.
    if ("rolePromoted" in result && result.rolePromoted) await refreshServerSession();

    // Both ways out end on the list. Publishing something is not finishing with it: the next
    // thing a landlord does is copy its link, publish another, or look at what they already
    // have — and all three are there. Editing ends there for the same reason it always did.
    router.push(MY_PROPERTIES_ROUTE);
    router.refresh();
  }

  // `post`, though JS handles the submit: see the note in `login-form.tsx`.
  return (
    <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-10" noValidate>
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
          {/* The two switches share the parking row: they answer the same kind of question. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:self-end sm:pb-2.5">
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
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Ubicación</h2>
        {/* Broad to specific: the city list depends on the department, so it is asked first. */}
        <div className="grid gap-4 sm:grid-cols-2">
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
                onValueChange={(value) => {
                  field.onChange(value);
                  // The chosen city almost certainly does not exist in the new department, and
                  // leaving it would submit a mismatched pair that only the server would catch.
                  form.setValue("address.city", "", {
                    shouldValidate: form.formState.isSubmitted,
                  });
                }}
                error={errors.address?.department?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="address.city"
            render={({ field }) => (
              <SelectField
                // Remounted per department: Radix keeps the previous label when a controlled
                // value goes back to undefined, so the trigger would sit empty instead of
                // showing the placeholder again.
                key={typeof department === "string" ? department : "sin-departamento"}
                id="address.city"
                label="Ciudad"
                placeholder={
                  cityOptions.length > 0 ? "Selecciona la ciudad" : "Elige primero el departamento"
                }
                options={cityOptions}
                disabled={cityOptions.length === 0}
                value={field.value ? String(field.value) : undefined}
                onValueChange={field.onChange}
                error={errors.address?.city?.message}
              />
            )}
          />
          <TextField
            id="address.neighborhood"
            label="Barrio"
            error={errors.address?.neighborhood?.message}
            {...form.register("address.neighborhood")}
          />
          <TextField
            id="address.line"
            label="Dirección"
            placeholder="Calle 60 #10-20 apto 301"
            hint="Solo la ve el inquilino cuya postulación apruebes. En el anuncio se muestran el barrio y la ciudad."
            error={errors.address?.line?.message}
            {...form.register("address.line")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Condiciones</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="rent"
            render={({ field }) => (
              <AmountField
                id="rent"
                label="Canon mensual (COP)"
                placeholder="1.800.000"
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.rent?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="adminFee"
            render={({ field }) => (
              <AmountField
                id="adminFee"
                label="Administración (COP)"
                hint="Escribe 0 si el inmueble no paga administración."
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.adminFee?.message}
              />
            )}
          />
          <TextField
            id="availableFrom"
            label="Disponible desde"
            type="date"
            min={todayISO()}
            error={errors.availableFrom?.message}
            {...form.register("availableFrom")}
          />
          <Controller
            control={form.control}
            name="minLeaseMonths"
            render={({ field }) => (
              <SelectField
                id="minLeaseMonths"
                label="Duración mínima"
                placeholder="Selecciona la duración"
                options={LEASE_OPTIONS}
                value={String(field.value)}
                onValueChange={field.onChange}
                error={errors.minLeaseMonths?.message}
              />
            )}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Fotos</h2>
        <PhotoUploader
          photos={photos}
          // Editing removes a photo that already exists: that is a delete, and every delete in
          // the product asks first. While publishing there is nothing to lose yet.
          confirmBeforeRemove={isEditing}
          error={errors.photos?.message}
          onChange={(next) => {
            setPhotos(next);
            form.setValue("photos", [...next], { shouldValidate: form.formState.isSubmitted });
          }}
        />
      </section>

      <SubmitButton loading={isSubmitting} loadingLabel={isEditing ? "Guardando…" : "Publicando…"}>
        {isEditing ? "Guardar cambios" : "Publicar inmueble"}
      </SubmitButton>
    </form>
  );
}
