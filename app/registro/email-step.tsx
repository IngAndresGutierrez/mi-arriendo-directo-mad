"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/components/auth/form-alert";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/ui/text-field";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { emailSchema, type EmailInput } from "@/lib/validations/auth";

type EmailStepProps = {
  error: string | null;
  isGoogleLoading: boolean;
  isBusy: boolean;
  onGoogleClick: () => void;
  onSubmitEmail: (email: string) => void;
};

/** Paso 1 del registro: elegir cómo crear la cuenta. */
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

        <form
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

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={LOGIN_ROUTE}
            className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </>
  );
}
