"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { signInWithGoogle, signUpWithEmail } from "@/lib/auth/client";
import { authErrorMessage, isUserCancellation } from "@/lib/auth/errors";

import { EmailStep } from "./email-step";
import { PasswordStep } from "./password-step";

/**
 * Registro en dos pasos.
 *
 * El correo vive en estado del componente, **nunca en la URL**: un `?email=` quedaría en el
 * historial del navegador y en los logs del servidor.
 */
export function SignupForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isGoogleLoading, setGoogleLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const isBusy = isGoogleLoading || isNavigating;

  function goToDestination() {
    startNavigation(() => {
      router.replace(redirectTo);
      router.refresh();
    });
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

  function onSubmitEmail(value: string) {
    setFormError(null);
    setEmail(value);
  }

  function onBack() {
    setFormError(null);
    setEmail(null);
  }

  async function onSubmitPassword(password: string) {
    if (email === null) return;

    setFormError(null);
    try {
      await signUpWithEmail(email, password);
      goToDestination();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  if (email === null) {
    return (
      <EmailStep
        error={formError}
        isGoogleLoading={isGoogleLoading}
        isBusy={isBusy}
        onGoogleClick={onGoogleClick}
        onSubmitEmail={onSubmitEmail}
      />
    );
  }

  return (
    <PasswordStep
      email={email}
      error={formError}
      isBusy={isBusy}
      onBack={onBack}
      onSubmitPassword={onSubmitPassword}
    />
  );
}
