"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ConsentCheckbox } from "@/shared/form/consent-checkbox";
import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";
import { PRIVACY_ROUTE, TERMS_ROUTE } from "@/shared/auth/routes";
import { currentVersion } from "@/shared/legal/documents";
import { PrivacyNotice } from "@/shared/legal/privacy-notice";

import { AccountFields } from "./account-fields";

import { DEFAULT_COUNTRY_ISO } from "@/shared/phone/countries";
import {
  completeProfileSchema,
  type CompleteProfileFormValues,
  type CompleteProfileInput,
} from "../validations/profile";

import { refreshServerSession } from "@/shared/auth/client";

import { completeProfile } from "../actions/complete-profile";

const FIELD_NAMES = [
  "fullName",
  "phone",
  "gender",
  "address",
  "birthDate",
  "acceptsTerms",
  "authorizesDataTreatment",
  "termsVersion",
  "privacyVersion",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];

/** Server errors arrive keyed by `string`; only the known keys are accepted. */
function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

export function CompleteProfileForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();

  const form = useForm<CompleteProfileFormValues, unknown, CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      // Colombia pre-selected: it is the product's market.
      phone: { country: DEFAULT_COUNTRY_ISO, national: "" },
      gender: undefined,
      address: { line: "", city: "", department: undefined },
      birthDate: "",
      acceptsTerms: false,
      authorizesDataTreatment: false,
      /*
       * The version being agreed to travels with the answer, and the schema pins it to the
       * constant — a tab left open across a policy change cannot record consent to a wording that
       * no longer exists. Same guard as `clauseVersion` on the electronic signature.
       */
      termsVersion: currentVersion("terms"),
      privacyVersion: currentVersion("privacy"),
    },
  });

  const {
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const isSaving = isSubmitting || isNavigating;

  async function onSubmit(values: CompleteProfileInput) {
    setFormError(null);

    const formData = new FormData();
    formData.set("fullName", values.fullName);
    formData.set("phone.country", values.phone.country);
    formData.set("phone.national", values.phone.national);
    // Only sent when answered: an unanswered sensitive field must not travel as "".
    if (values.gender) formData.set("gender", values.gender);
    formData.set("address.line", values.address.line);
    formData.set("address.city", values.address.city);
    formData.set("address.department", values.address.department);
    formData.set("birthDate", values.birthDate);
    formData.set("acceptsTerms", String(values.acceptsTerms));
    formData.set("authorizesDataTreatment", String(values.authorizesDataTreatment));
    formData.set("termsVersion", String(values.termsVersion));
    formData.set("privacyVersion", String(values.privacyVersion));

    const result = await completeProfile(formData);

    if (!result.ok) {
      // Server errors are painted on their field; anything else goes to the general alert.
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && isFieldName(field)) setError(field, { message });
      }
      if (result.message) setFormError(result.message);
      else if (!result.fieldErrors) setFormError("No pudimos guardar tu perfil.");
      return;
    }

    // The action just set the role claim, but the cookie was minted earlier and does not
    // carry it yet: without refreshing it, the server would read the wrong role.
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

  // `post`, though JS handles the submit: see the note in `login-form.tsx`.
  return (
    <FormProvider {...form}>
      <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <AccountFields disabled={isSaving} />

      {/*
        The aviso de privacidad, at the point of collection — Decreto 1074 art. 2.2.2.25.3.2 asks
        for it "a más tardar al momento de la recolección", which is this screen and not a link
        somewhere.
      */}
      <PrivacyNotice purpose="crear tu cuenta, identificarte ante la otra parte de un arriendo y comunicarnos contigo" />

      {/*
        **Two answers, not one.** This was a single checkbox reading "Autorizo el tratamiento de
        mis datos personales y acepto los Términos". Accepting a contract and authorising the
        processing of personal data are different acts, and the second one has to be express
        (Ley 1581 art. 9) — bundled with the first, the record cannot say which of the two was
        being answered. Both are still required; what vitiated the authorisation was the bundling,
        not the requirement.
      */}
      <div className="space-y-3">
        <Controller
          control={control}
          name="acceptsTerms"
          render={({ field }) => (
            <ConsentCheckbox
              id="acceptsTerms"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSaving}
              error={errors.acceptsTerms?.message}
            >
              Acepto los{" "}
              <Link href={TERMS_ROUTE} className="underline underline-offset-2">
                Términos y condiciones
              </Link>
              .
            </ConsentCheckbox>
          )}
        />

        <Controller
          control={control}
          name="authorizesDataTreatment"
          render={({ field }) => (
            <ConsentCheckbox
              id="authorizesDataTreatment"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSaving}
              error={errors.authorizesDataTreatment?.message}
            >
              Autorizo el tratamiento de mis datos personales en los términos de la{" "}
              <Link href={PRIVACY_ROUTE} className="underline underline-offset-2">
                Política de tratamiento de datos personales
              </Link>
              .
            </ConsentCheckbox>
          )}
        />
      </div>

      <SubmitButton loading={isSaving} loadingLabel="Guardando…">
        Guardar y continuar
      </SubmitButton>
      </form>
    </FormProvider>
  );
}
