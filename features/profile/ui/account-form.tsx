"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { CheckIcon } from "lucide-react";
import type { z } from "zod";

import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";
import type { Department } from "@/shared/geo/colombia";

import { AccountFields } from "./account-fields";
import { accountDetailsSchema } from "../validations/profile";
import { updateProfile } from "../actions/update-profile";
import type { Gender } from "../domain/profile";

type FormInput = z.input<typeof accountDetailsSchema>;
type FormValues = z.output<typeof accountDetailsSchema>;

export type AccountFormValues = {
  readonly fullName: string;
  readonly phone: { readonly country: string; readonly national: string };
  /** Selects: `undefined` muestra el placeholder, y `null` no es un valor que acepten. */
  readonly gender: Gender | undefined;
  readonly birthDate: string;
  readonly address: {
    readonly line: string;
    readonly city: string;
    readonly department: Department | undefined;
  };
};

/**
 * Quién eres en la plataforma: el bloque de datos que tienen todas las cuentas.
 *
 * **Es el mismo `AccountFields` y la misma `updateProfile` que usa el perfil de inquilino, contra el
 * mismo `users/{uid}`.** Esa es la razón de que existan las dos pantallas sin que puedan
 * contradecirse: no hay dos copias del teléfono, hay un documento con dos puertas. Un propietario
 * puede no llegar nunca a tener dossier de inquilino, y aun así tiene nombre, teléfono y dirección
 * que la otra parte del proceso ve.
 *
 * Lo que este formulario deliberadamente **no** toca es lo que `updateProfile` tampoco: el correo
 * —viene de la sesión verificada, no de un campo—, el rol —es un custom claim— y `termsAcceptedAt`,
 * que sería mentira si se moviera cada vez que alguien corrige una tilde de su apellido.
 */
export function AccountForm({ account }: { readonly account: AccountFormValues }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: account,
  });

  const { isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: FormValues) {
    const data = new FormData();
    data.set("fullName", values.fullName);
    data.set("phone.country", values.phone.country);
    data.set("phone.national", values.phone.national);
    // Solo se manda si se respondió: vacío borra el campo, que es lo que revoca el dato sensible.
    if (values.gender) data.set("gender", values.gender);
    data.set("birthDate", values.birthDate);
    data.set("address.line", values.address.line);
    data.set("address.city", values.address.city);
    data.set("address.department", values.address.department);

    const result = await updateProfile(data);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) form.setError(field as keyof FormInput, { message });
        }
      }
      form.setError("root", { message: result.message ?? "No pudimos guardar tus datos." });
      return;
    }

    /*
     * Lo recién guardado pasa a ser la nueva referencia. Sin esto el formulario sigue "sucio"
     * contra los valores con los que arrancó y la confirmación —que solo se muestra si está
     * limpio— no aparece nunca: guarda bien y no dice nada.
     */
    form.reset(form.getValues());
    setSaved(true);
    router.refresh();
  }

  return (
    <FormProvider {...form}>
      {/* `post` aunque lo envíe JavaScript: antes de hidratar no hay handler que lo impida. */}
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-6"
        data-slot="account-form"
      >
        {form.formState.errors.root?.message ? (
          <FormAlert>{form.formState.errors.root.message}</FormAlert>
        ) : null}

        <AccountFields disabled={isSubmitting} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saved && !isDirty ? (
            <p
              // `status` y no `alert`: guardar bien es una noticia, no una interrupción.
              role="status"
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <CheckIcon className="size-4 text-brand-panel" aria-hidden="true" />
              Tus datos están guardados
            </p>
          ) : null}

          <div className="sm:w-56">
            <SubmitButton loading={isSubmitting} disabled={!isDirty} loadingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
