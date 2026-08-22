"use client";

import { useState } from "react";
import { z } from "zod";

import type { Department } from "@/shared/geo/colombia";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import {
  AccountFields,
  accountDetailsSchema,
  updateProfile,
  type Gender,
} from "@/features/profile/client";
import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";

import { saveTenantProfile } from "../actions/save-tenant-profile";
import { emptyDossier, toFormValues } from "./defaults";
import { tenantDossierSchema } from "../validations/tenant-profile";
import type { TenantProfile } from "../domain/tenant-profile";
import { DossierFields } from "./dossier-fields";

/**
 * One page, one form, both halves of who you are: what you gave when you signed up, and what a
 * landlord needs on top of it.
 *
 * They are together because they were never apart in anyone's head. Filling in a name at signup
 * and then never seeing it again reads as data that got lost — and the next form asking for a
 * "Nombre completo", even someone else's, confirms the suspicion.
 */
const schema = accountDetailsSchema.and(tenantDossierSchema);
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

/**
 * Everything a landlord ends up knowing about a tenant, on one page.
 *
 * The account half arrives filled in from what was given at signup — that is the whole point:
 * it was being stored and never shown. The dossier half is what an application adds. Correcting
 * either is done here instead of at the worst possible moment, in the middle of applying.
 */
export function TenantProfileForm({
  profile,
  account,
}: {
  readonly profile: TenantProfile | null;
  /**
   * What was given at signup, in the shape the fields want.
   *
   * `gender` and `department` may be `undefined`: they are selects, and a select with no value
   * shows its placeholder. Typing them as required would force a fake default here, which is
   * how a form ends up submitting an answer nobody gave.
   */
  readonly account: {
    readonly fullName: string;
    readonly phone: { readonly country: string; readonly national: string };
    readonly gender: Gender | undefined;
    readonly birthDate: string;
    readonly address: {
      readonly line: string;
      readonly city: string;
      readonly department: Department | undefined;
    };
  };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...account, ...(profile ? toFormValues(profile) : emptyDossier()) },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: FormValues) {
    const account = new FormData();
    account.set("fullName", values.fullName);
    account.set("phone.country", values.phone.country);
    account.set("phone.national", values.phone.national);
    account.set("gender", values.gender);
    account.set("birthDate", values.birthDate);
    account.set("address.line", values.address.line);
    account.set("address.city", values.address.city);
    account.set("address.department", values.address.department);

    const saveAccount = await updateProfile(account);
    if (!saveAccount.ok) {
      form.setError("root", { message: saveAccount.message ?? "No pudimos guardar tus datos." });
      return;
    }

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

    /*
     * What was just saved becomes the new baseline. Without this the form stays "dirty" against
     * the values it started with, and the confirmation — which only shows for a clean form —
     * never appeared: it saved correctly and said nothing.
     */
    form.reset(form.getValues());
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

        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-primary dark:text-foreground">Tus datos</h2>
            <p className="text-sm text-muted-foreground">
              Los que diste al crear tu cuenta. Corrígelos aquí si algo cambió.
            </p>
          </div>
          <AccountFields disabled={isSubmitting} />
        </section>

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
