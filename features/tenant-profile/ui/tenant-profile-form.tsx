"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";

import { saveTenantProfile } from "../actions/save-tenant-profile";
import { emptyDossier, toFormValues } from "./defaults";
import { tenantDossierSchema, type TenantDossierInput, type TenantDossierValues } from "../validations/tenant-profile";
import type { TenantProfile } from "../domain/tenant-profile";
import { DossierFields } from "./dossier-fields";

/**
 * The tenant's dossier, on its own page.
 *
 * The same fields the first application asks for. Filling them here means the next application
 * starts already answered, and correcting them here is where you come when something changes —
 * a new job, a new phone for your reference — instead of retyping it at the worst moment.
 */
export function TenantProfileForm({ profile }: { readonly profile: TenantProfile | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<TenantDossierInput, unknown, TenantDossierValues>({
    resolver: zodResolver(tenantDossierSchema),
    defaultValues: profile ? toFormValues(profile) : emptyDossier(),
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: TenantDossierValues) {
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

    const result = await saveTenantProfile(data);
    if (!result.ok) {
      form.setError("root", { message: result.message ?? "No pudimos guardar tus datos." });
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <FormProvider {...form}>
      {/* `post`, though JS handles the submit: see the note in `login-form.tsx`. */}
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
        {form.formState.errors.root?.message ? (
          <FormAlert>{form.formState.errors.root.message}</FormAlert>
        ) : null}

        <DossierFields />

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton loading={isSubmitting} loadingLabel="Guardando…">
            Guardar mis datos
          </SubmitButton>
          {saved && !form.formState.isDirty ? (
            <p role="status" className="text-sm text-muted-foreground">
              Listo, tus datos quedaron guardados.
            </p>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
}
