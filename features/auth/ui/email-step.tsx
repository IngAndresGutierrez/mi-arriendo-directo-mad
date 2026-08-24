"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { TERMS_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { FormAlert } from "@/shared/form/form-alert";
import { GoogleButton } from "./google-button";
import { OrDivider } from "./or-divider";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { emailSchema, type EmailInput } from "../validations/auth";

type EmailStepProps = {
  error: string | null;
  isGoogleLoading: boolean;
  isBusy: boolean;
  onGoogleClick: () => void;
  onSubmitEmail: (email: string) => void;
};

/** Signup step 1: choose how to create the account. */
export function EmailStep({
  error,
  isGoogleLoading,
  isBusy,
  onGoogleClick,
  onSubmitEmail,
}: EmailStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Crear una cuenta
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">Solo te llevará un minuto.</p>

      <div className="space-y-6">
        <GoogleButton onClick={onGoogleClick} loading={isGoogleLoading} disabled={isBusy}>
          Continuar con Google
        </GoogleButton>

        <OrDivider />

        {/* `post`, though JS handles the submit: see the note in `login-form.tsx`. */}
        <form
          method="post"
          onSubmit={handleSubmit((values) => onSubmitEmail(values.email))}
          noValidate
          className="space-y-4"
        >
          {error ? <FormAlert>{error}</FormAlert> : null}

          <TextField
            id="email"
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tu@ejemplo.com"
            error={errors.email?.message}
            disabled={isBusy}
            {...register("email")}
          />

          <SubmitButton loading={false} disabled={isBusy}>
            Continuar con el correo
          </SubmitButton>
        </form>

        {/*
          Lo que había aquí antes era "Al crear tu cuenta aceptas nuestros Términos y la Política de
          privacidad", que era falso dos veces: leer una frase no es la conducta de la que el
          artículo 2.2.2.25.2.3 del Decreto 1074 permite concluir un consentimiento, y la aceptación
          se pide en la pantalla siguiente, con dos casillas. Esto dice lo que de verdad pasa, y
          enlaza el documento — que es el contenido mínimo del deber de información: que la política
          existe y cómo llegar a ella.
        */}
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          En el siguiente paso te pediremos aceptar los{" "}
          <NewTabLink
            href={TERMS_ROUTE}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Términos y condiciones
          </NewTabLink>{" "}
          y autorizar el tratamiento de tus datos.
        </p>
      </div>
    </>
  );
}
