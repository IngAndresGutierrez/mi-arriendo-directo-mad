"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";
import { Checkbox } from "@/shared/ui/checkbox";

import { AccountFields } from "./account-fields";
import { Label } from "@/shared/ui/label";

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
    formData.set("gender", values.gender);
    formData.set("address.line", values.address.line);
    formData.set("address.city", values.address.city);
    formData.set("address.department", values.address.department);
    formData.set("birthDate", values.birthDate);
    formData.set("acceptsTerms", String(values.acceptsTerms));

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

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="acceptsTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptsTerms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isSaving}
                aria-invalid={errors.acceptsTerms ? true : undefined}
                aria-describedby={errors.acceptsTerms ? "acceptsTerms-error" : undefined}
                className="mt-0.5"
              />
            )}
          />
          {/*
            `block`: shadcn's Label ships `flex`, which turns the text and the links into
            flex items that stack instead of flowing as a paragraph.
          */}
          <Label htmlFor="acceptsTerms" className="block text-sm leading-relaxed font-normal">
            Autorizo el tratamiento de mis datos personales y acepto los{" "}
            <Link href="/terminos" className="underline underline-offset-2">
              Términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </Label>
        </div>
        {errors.acceptsTerms ? (
          <p id="acceptsTerms-error" className="text-sm text-destructive">
            {errors.acceptsTerms.message}
          </p>
        ) : null}
      </div>

      <SubmitButton loading={isSaving} loadingLabel="Guardando…">
        Guardar y continuar
      </SubmitButton>
      </form>
    </FormProvider>
  );
}
