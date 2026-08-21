"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/components/auth/form-alert";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/ui/text-field";
import { signInWithEmail, signInWithGoogle } from "@/shared/auth/client";
import { authErrorMessage, isUserCancellation } from "@/shared/auth/errors";
import { PASSWORD_RESET_ROUTE, SIGNUP_ROUTE } from "@/shared/auth/routes";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isGoogleLoading, setGoogleLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const isBusy = isSubmitting || isGoogleLoading || isNavigating;
  const isSigningIn = isSubmitting || isNavigating;

  function goToDestination() {
    startNavigation(() => {
      router.replace(redirectTo);
      // Descarta el cache del router para que los Server Components ya vean la sesión.
      router.refresh();
    });
  }

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await signInWithEmail(values.email, values.password);
      goToDestination();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  async function onGoogleClick() {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      goToDestination();
    } catch (error) {
      if (!isUserCancellation(error)) setFormError(authErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <GoogleButton onClick={onGoogleClick} loading={isGoogleLoading} disabled={isBusy}>
        Continuar con Google
      </GoogleButton>

      <OrDivider />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <TextField
          id="email"
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu@correo.com"
          error={errors.email?.message}
          disabled={isBusy}
          {...register("email")}
        />

        <TextField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          disabled={isBusy}
          labelAction={
            <Link
              href={PASSWORD_RESET_ROUTE}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-foreground"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
          {...register("password")}
        />

        <SubmitButton loading={isSigningIn} disabled={isBusy} loadingLabel="Iniciando sesión…">
          Iniciar sesión
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href={SIGNUP_ROUTE}
          className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground"
        >
          Créala gratis
        </Link>
      </p>
    </div>
  );
}
