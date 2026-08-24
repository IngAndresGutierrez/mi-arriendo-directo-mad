"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import { LEASE_TERMS, LEASE_TERM_LABELS, type LeaseTerm } from "@/features/property/client";
import {
  DossierFields,
  emptyDossier,
  tenantDossierSchema,
  toFormValues,
  type TenantProfile,
} from "@/features/tenant-profile/client";
import { applicationRoute } from "@/shared/auth/routes";
import { FormAlert } from "@/shared/form/form-alert";
import { SelectField } from "@/shared/form/select-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Label } from "@/shared/ui/label";

import { applyToProperty } from "../actions/apply";
import { applicationDetailsSchema } from "../validations/application";

const schema = tenantDossierSchema.and(applicationDetailsSchema);
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

/** A field the schema can complain about, so a server error lands on the right input. */
function isFieldName(name: string): name is keyof FormInput {
  return name in emptyDossier() || ["desiredMoveIn", "leaseMonths", "message"].includes(name);
}

/**
 * The application form: the tenant's dossier plus what is specific to this listing.
 *
 * When the tenant has a profile the whole dossier arrives filled in and they only check it —
 * which is the point of having one. What they submit is still sent in full and stored twice:
 * into the profile, and as a snapshot inside the application, so the landlord always sees what
 * was declared to them.
 */
export function ApplicationForm({
  slug,
  profile,
  minLeaseMonths,
}: {
  readonly slug: string;
  readonly profile: TenantProfile | null;
  /** The listing's own minimum: a tenant cannot ask for less than what was published. */
  readonly minLeaseMonths: LeaseTerm;
}) {
  const router = useRouter();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(profile ? toFormValues(profile) : emptyDossier()),
      desiredMoveIn: "",
      leaseMonths: minLeaseMonths,
      message: "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const leaseOptions = LEASE_TERMS.filter((term) => term >= minLeaseMonths).map((term) => ({
    value: String(term),
    label: LEASE_TERM_LABELS[term],
  }));

  async function onSubmit(values: FormValues) {
    const data = new FormData();
    data.set("documentType", values.documentType);
    data.set("documentNumber", values.documentNumber);
    data.set("occupation", values.occupation);
    data.set("employer", values.employer);
    data.set("monthlyIncome", String(values.monthlyIncome));
    data.set("householdSize", String(values.householdSize));
    data.set("hasPets", String(values.hasPets));
    data.set("petsDescription", values.petsDescription);
    data.set("reference.name", values.reference.name);
    data.set("reference.phone", values.reference.phone);
    data.set("reference.phoneCountry", values.reference.phoneCountry);
    data.set("reference.relationship", values.reference.relationship);
    /*
     * La declaración sobre los datos de la referencia. `DossierFields` ya pinta la casilla —es el
     * mismo bloque que el perfil— y el esquema la exige, así que sin esta línea la acción rechazaba
     * la postulación con un error que el formulario no pintaba en ningún campo: el botón parecía no
     * hacer nada.
     */
    data.set("referenceAuthorized", String(values.referenceAuthorized));
    data.set("desiredMoveIn", values.desiredMoveIn);
    data.set("leaseMonths", String(values.leaseMonths));
    data.set("message", values.message);

    const result = await applyToProperty(slug, data);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (isFieldName(field)) form.setError(field, { message: messages?.[0] });
      }
      if (result.message) form.setError("root", { message: result.message });
      return;
    }

    router.push(applicationRoute(result.applicationId));
    router.refresh();
  }

  return (
    <FormProvider {...form}>
      {/* `post`, though JS handles the submit: see the note in `login-form.tsx`. */}
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}

        <DossierFields />

        <section className="space-y-4">
          <h2 className="font-semibold text-primary dark:text-foreground">Sobre este arriendo</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="desiredMoveIn"
              label="Cuándo te mudarías"
              type="date"
              error={errors.desiredMoveIn?.message}
              {...form.register("desiredMoveIn")}
            />
            <Controller
              control={form.control}
              name="leaseMonths"
              render={({ field }) => (
                <SelectField
                  id="leaseMonths"
                  label="Por cuánto tiempo"
                  placeholder="Elige una duración"
                  options={leaseOptions}
                  value={field.value === undefined ? undefined : String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                  error={errors.leaseMonths?.message}
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Mensaje al propietario (opcional)</Label>
            <textarea
              id="message"
              rows={4}
              placeholder="Preséntate: quién eres, con quién vivirías y por qué te interesa este inmueble."
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...form.register("message")}
            />
            {errors.message ? (
              <p id="message-error" className="text-sm text-destructive">
                {errors.message.message}
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-3">
          <SubmitButton loading={isSubmitting} loadingLabel="Enviando…">
            Enviar postulación
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            Tus datos quedan guardados en tu perfil de inquilino: la próxima vez solo tendrás que
            revisarlos. El propietario ve lo que envías en esta postulación.
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
