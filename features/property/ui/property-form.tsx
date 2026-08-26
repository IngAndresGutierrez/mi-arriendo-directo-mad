"use client";

import type { Dictionary } from "@/shared/i18n";
import type { PropertyLabels } from "../domain/labels";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { refreshServerSession } from "@/shared/auth/client";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { DEPARTMENTS, type Department } from "@/shared/geo/colombia";
import { municipalitiesOf } from "@/shared/geo/municipalities";
import type { GeoPoint } from "@/shared/geo/point";
import { AmountField } from "@/shared/form/amount-field";
import { FormAlert } from "@/shared/form/form-alert";
import { SelectField } from "@/shared/form/select-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import { Button } from "@/shared/ui/button";

import { updateProperty } from "../actions/manage-property";
import { publishProperty } from "../actions/publish-property";
import {
  LEASE_TERMS,
  PARKING_KINDS,
  PROPERTY_TYPES,
  STRATA,
  type Property,
  type PropertyPhoto,
  type PropertyVideo,
} from "../domain/property";
import {
  bogotaDay,
  draftPropertySchema,
  publishPropertySchema,
  type PropertyFormIntent,
  type PublishPropertyFormValues,
  type PublishPropertyInput,
} from "../validations/property";
import { LocationPicker } from "./location-picker";
import { PhotoUploader } from "./photo-uploader";
import { VideoUploader } from "./video-uploader";

/**
 * One resolver per intent, hoisted: the schemas are module constants, so these are too.
 *
 * The form has two ways out — publish, and save a draft — and they differ in exactly one rule,
 * the photos. That rule has to be applied **before** `handleSubmit` calls the action, or the
 * strict resolver would refuse a draft over the one field a draft exists to be missing, and the
 * lax one would let a listing onto the catalogue with no photograph. So the resolver is picked
 * per submit from a ref, not fixed at `useForm` time.
 *
 * A ref rather than state, and that is not a style choice: the button's `onClick` and the form's
 * `submit` run in the **same** event turn, so a `setState` in the first has not landed by the
 * time the second reads it, and every draft would be validated as a publish.
 */
const PUBLISH_RESOLVER = zodResolver(publishPropertySchema);
const DRAFT_RESOLVER = zodResolver(draftPropertySchema);

/** Departments are proper nouns out of DANE: they are their own label in every language. */
const DEPARTMENT_OPTIONS = DEPARTMENTS.map((value) => ({ value, label: value }));

/*
 * The three option lists that carry words are built **per render** from the `labels` prop rather
 * than hoisted to module scope as they were. That is the cost of a second language and it is small:
 * three `map`s over five, three and two values. Hoisting them again would freeze them in whichever
 * language happened to be loaded first.
 */
function typeOptions(labels: PropertyLabels) {
  return PROPERTY_TYPES.map((value) => ({ value, label: labels.types[value] }));
}
function parkingOptions(labels: PropertyLabels) {
  return PARKING_KINDS.map((value) => ({ value, label: labels.parking[value] }));
}
function leaseOptions(labels: PropertyLabels) {
  return LEASE_TERMS.map((value) => ({ value: String(value), label: labels.lease[value] }));
}
const STRATUM_OPTIONS = STRATA.map((value) => ({ value: String(value), label: `Estrato ${value}` }));

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
  "video",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/**
 * Today in Colombia, as `<input type="date">` wants it.
 *
 * Not `toISOString()`: that is the UTC day, and where it differs from the Colombian one the
 * server rejected its own default as "una fecha en el pasado". The server re-checks with the
 * same rule — `validateAvailableFrom` — against its own clock.
 */
function todayISO(): string {
  return bogotaDay(new Date());
}

type PropertyFormProps = {
  /** Present when editing: the listing as it is stored today. Absent when publishing. */
  readonly property?: Property;
  /** The street address, which lives outside the public document. Only for editing. */
  readonly addressLine?: string;
  /** The registry number, which lives beside the address and is just as private. */
  readonly registryNumber?: string;
  /**
   * The point on the map, which lives there too and for the same reason: five decimals of
   * latitude is the address in another alphabet. Only for editing, and only for the owner.
   */
  readonly mapPoint?: GeoPoint | null;
  /**
   * The listing vocabulary, resolved by the page.
   *
   * A prop because this is a Client Component: importing the dictionary here would put both
   * languages in the browser bundle. The rest of this form is still Spanish — the portal has not
   * been translated yet — so these words follow the URL while the labels around them do not. That
   * is the transitional state, and it resolves itself when the form is translated rather than
   * needing somebody to come back and remove a hard-coded locale.
   */
  readonly labels: PropertyLabels;
  /**
   * The form's own words, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing the dictionary here would put both languages in the bundle.
   */
  readonly copy: Dictionary["propertyForm"];
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
export function PropertyForm({
  property,
  addressLine,
  registryNumber,
  mapPoint,
  labels,
  copy,
}: PropertyFormProps) {
  const t = copy;
  const TYPE_OPTIONS = typeOptions(labels);
  const PARKING_OPTIONS = parkingOptions(labels);
  const LEASE_OPTIONS = leaseOptions(labels);
  const router = useRouter();
  const isEditing = property !== undefined;
  const isDraft = property?.status === "draft";
  const [photos, setPhotos] = useState<readonly PropertyPhoto[]>(property?.photos ?? []);
  /*
   * Held in state beside the photos, for the same reason they are: the uploader reports a finished
   * upload rather than a file, and `form.setValue` alone would leave the preview with nothing to
   * render. `null` and not `undefined` in the component's own state — the schema wants the key
   * absent, and that conversion happens once, on submit.
   */
  const [video, setVideo] = useState<PropertyVideo | null>(property?.video ?? null);

  /** Which button was pressed. Read by the resolver and by the submit — see the note above. */
  const intent = useRef<PropertyFormIntent>("publish");
  /** Which of the two buttons should spin. `isSubmitting` says *that* one is, not which. */
  const [pending, setPending] = useState<PropertyFormIntent | null>(null);

  const form = useForm<PublishPropertyFormValues, unknown, PublishPropertyInput>({
    resolver: (values, context, options) =>
      (intent.current === "draft" ? DRAFT_RESOLVER : PUBLISH_RESOLVER)(values, context, options),
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
            registryNumber: registryNumber ?? "",
            point: mapPoint ?? undefined,
            line: addressLine ?? "",
            neighborhood: property.area.neighborhood,
            city: property.area.city,
            department: property.area.department,
          },
          photos: [...property.photos],
          video: property.video,
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
          address: {
            registryNumber: "",
            // No point until the landlord places one: the map is optional, and a default would
            // publish a zone somebody never chose.
            point: undefined,
            line: "",
            neighborhood: "",
            city: "",
            department: undefined,
          },
          photos: [],
          video: undefined,
        },
  });

  const { errors, isSubmitting } = form.formState;

  // `useWatch`, never `watch()`: the latter returns a function the React Compiler cannot memoize.
  const department = useWatch({ control: form.control, name: "address.department" });
  const cityOptions = municipalitiesOf(department as Department).map((value) => ({
    value,
    label: value,
  }));

  /*
   * The picker's "Centrar en el barrio" needs the three public parts of the address as they are
   * *right now*, so they are watched rather than read on click: `getValues()` inside a child's
   * event handler would read whatever was there when the child last rendered.
   */
  const city = useWatch({ control: form.control, name: "address.city" });
  const neighborhood = useWatch({ control: form.control, name: "address.neighborhood" });
  const point = useWatch({ control: form.control, name: "address.point" });

  /**
   * The intent belongs to **one** submit, so it is put back to the strict default as soon as it
   * has been read — here and on an invalid submit alike. Without that, pressing "Guardar como
   * borrador", failing validation on the canon and then pressing "Publicar inmueble" would save
   * a draft: the ref would still be holding the previous press.
   */
  function takeIntent(): PropertyFormIntent {
    const submitted = intent.current;
    intent.current = "publish";

    return submitted;
  }

  async function onSubmit(values: PublishPropertyInput) {
    const submitted = takeIntent();
    setPending(submitted);
    const data = new FormData();
    // The server re-reads it and re-picks the schema: the browser having validated proves nothing.
    data.set("intent", submitted);
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
    data.set("address.registryNumber", values.address.registryNumber);
    // Two fields, because a `FormData` has no nested objects. Empty when there is no point:
    // `mapPointFrom` in the action reads "either both or neither".
    data.set("address.lat", values.address.point ? String(values.address.point.lat) : "");
    data.set("address.lng", values.address.point ? String(values.address.point.lng) : "");
    data.set("address.line", values.address.line);
    data.set("address.neighborhood", values.address.neighborhood);
    data.set("address.city", values.address.city);
    data.set("address.department", values.address.department);
    data.set("photos", JSON.stringify(values.photos));
    /*
     * An empty string when there is none, which `parsePropertyForm` reads as "no video" rather
     * than as an unreadable one. `JSON.stringify(undefined)` is the string `"undefined"`, which
     * would have arrived at the server as a parse error about a video nobody touched.
     */
    data.set("video", values.video ? JSON.stringify(values.video) : "");

    const result = property
      ? await updateProperty(property.id, data)
      : await publishProperty(data);

    if (!result.ok) {
      setPending(null);
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
    <form
      method="post"
      /*
        Wrapped rather than passed straight in: both callbacks read the intent ref, and
        `react-hooks/refs` cannot tell that `handleSubmit` will only call them from the submit
        event. Inside an event handler it can, which is also where the read genuinely happens.
      */
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit, takeIntent)(event);
      }}
      className="space-y-10"
      noValidate
    >
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">{t.sectionProperty}</h2>
        <TextField
          id="title"
          label={t.title}
          placeholder={t.titlePlaceholder}
          error={errors.title?.message}
          {...form.register("title")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="description">{t.description}</Label>
          <textarea
            id="description"
            rows={5}
            placeholder={t.descriptionPlaceholder}
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
              label={t.type}
              placeholder={t.typePlaceholder}
              options={TYPE_OPTIONS}
              value={field.value as string}
              onValueChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">{t.sectionFeatures}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="areaM2"
            label={t.area}
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
                label={t.stratum}
                placeholder={t.select}
                options={STRATUM_OPTIONS}
                value={field.value === undefined || field.value === "" ? undefined : String(field.value)}
                onValueChange={field.onChange}
                error={errors.stratum?.message}
              />
            )}
          />
          <TextField
            id="bedrooms"
            label={t.bedrooms}
            inputMode="numeric"
            error={errors.bedrooms?.message}
            {...form.register("bedrooms")}
          />
          <TextField
            id="bathrooms"
            label={t.bathrooms}
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
                label={t.parking}
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
                    {t.furnished}
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
                    {t.petsAllowed}
                  </Label>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">{t.sectionLocation}</h2>
        {/* Broad to specific: the city list depends on the department, so it is asked first. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="address.department"
            render={({ field }) => (
              <SelectField
                id="address.department"
                label={t.department}
                placeholder={t.departmentPlaceholder}
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
                label={t.city}
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
            label={t.neighborhood}
            error={errors.address?.neighborhood?.message}
            {...form.register("address.neighborhood")}
          />
          <TextField
            id="address.line"
            label={t.address}
            placeholder={t.addressPlaceholder}
            hintTooltip={t.addressTooltip}
            error={errors.address?.line?.message}
            {...form.register("address.line")}
          />
          <TextField
            id="address.registryNumber"
            label={t.registryNumber}
            placeholder={t.registryPlaceholder}
            inputMode="numeric"
            autoComplete="off"
            hintTooltip={t.registryTooltip}
            error={errors.address?.registryNumber?.message}
            {...form.register("address.registryNumber")}
          />
        </div>

        {/*
          After the address, not before it: the map is centred from the barrio and the city, so
          asking for the point first would be asking for it with nothing to aim the map with.
        */}
        <LocationPicker
          copy={t}
          value={(point as GeoPoint | undefined) ?? null}
          onChange={(next) =>
            form.setValue("address.point", next ?? undefined, {
              shouldValidate: form.formState.isSubmitted,
            })
          }
          area={{
            neighborhood: typeof neighborhood === "string" ? neighborhood : "",
            city: typeof city === "string" ? city : "",
            department: typeof department === "string" ? department : "",
          }}
        />
        {errors.address?.point && (
          <p className="text-sm text-destructive">{errors.address.point.message}</p>
        )}
        {/*
          The section's own error, and it had nowhere to go until the map arrived. `z.flattenError`
          keys an issue by the **first** segment of its path, so anything the *server* rejects
          inside the address — a street too short, a city that is not in its department, a point
          outside Colombia — comes back as `fieldErrors.address` and is set on the object rather
          than on a field. Without this line the form went quiet: the submit failed and the page
          said nothing, which is the worst of the three possible outcomes.
        */}
        {errors.address?.message && (
          <p className="text-sm text-destructive">{errors.address.message}</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">{t.sectionTerms}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="rent"
            render={({ field }) => (
              <AmountField
                id="rent"
                label={t.rent}
                placeholder={t.rentPlaceholder}
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
                label={t.adminFee}
                hint={t.adminFeeHint}
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.adminFee?.message}
              />
            )}
          />
          <TextField
            id="availableFrom"
            label={t.availableFrom}
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
                label={t.minLease}
                placeholder={t.minLeasePlaceholder}
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
        <h2 className="text-lg font-semibold text-primary">{t.sectionPhotos}</h2>
        <PhotoUploader
          copy={t}
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

        {/*
          Under the photos and inside the same section, because it answers the same question — what
          a tenant will see — and a tenth section for one optional control would be a heading
          somebody scrolls past. The photos come first: they are what publishing requires and what
          the card and the shared preview draw, and the video is what a landlord adds on top.

          `undefined` on the way into the form, never `null`: the schema declares the field
          `.optional()`, and a `null` would fail validation with a message about a format on a
          listing whose author had just removed the video.
        */}
        <VideoUploader
          copy={t}
          video={video}
          confirmBeforeRemove={isEditing}
          error={errors.video?.message}
          onChange={(next) => {
            setVideo(next);
            form.setValue("video", next ?? undefined, {
              shouldValidate: form.formState.isSubmitted,
            });
          }}
        />
      </section>

      {/*
        Two ways out, and only one of them is the call to action — the one-cyan-per-view rule.
        Publishing is what this screen is for, so it keeps the `accent`; saving a draft is a real
        control that is not that one, which is exactly what `brand` is for. An `outline` would
        have put it among the furniture beside "Cancelar", and a second cyan would have made the
        landlord choose between two shouts.

        The pair only appears where there is a choice to make. Editing a listing that is already
        on the catalogue offers "Guardar cambios" alone, as it always did: the other button there
        would mean *unpublishing*, which is a decision about a listing strangers may already have
        applied to and does not belong on the same submit as a spelling fix.
      */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start">
        <div className="sm:flex-1">
          <SubmitButton
            loading={isSubmitting && pending === "publish"}
            disabled={isSubmitting}
            loadingLabel={isEditing && !isDraft ? t.saving : t.publishing}
          >
            {isEditing && !isDraft ? t.saveChanges : t.publish}
          </SubmitButton>
        </div>

        {(!isEditing || isDraft) && (
          <Button
            type="submit"
            variant="brand"
            size="xl"
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            onClick={() => {
              intent.current = "draft";
            }}
          >
            {isSubmitting && pending === "draft"
              ? isEditing
                ? t.saving
                : t.savingDraft
              : isEditing
                ? t.saveChanges
                : t.saveDraft}
          </Button>
        )}
      </div>

      {/*
        Said on the screen where the decision is made, not in a tooltip: somebody who has filled
        in nine sections and has no photographs is about to close the tab, and the sentence that
        stops them is the one telling them there is somewhere to put the work.
      */}
      {!isEditing && (
        <p className="text-sm text-muted-foreground">{t.draftHint}</p>
      )}
    </form>
  );
}
