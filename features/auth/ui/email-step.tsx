"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Al crear tu cuenta aceptas nuestros{" "}
          <Link href="/terminos" className="underline underline-offset-2 hover:text-foreground">
            Términos de servicio
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline underline-offset-2 hover:text-foreground">
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </>
  );
}
