"use client";

import { useLocale, type Dictionary } from "@/shared/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { signInWithGoogle, signUpWithEmail } from "@/shared/auth/client";
import { authErrorMessage, isUserCancellation } from "@/shared/auth/errors";

import { EmailStep } from "./email-step";
import { PasswordStep } from "./password-step";

/**
 * Two-step signup.
 *
 * The email lives in component state, **never in the URL**: an `?email=` would end up in
 * the browser history and in the server logs.
 */
export function SignupForm({
  redirectTo,
  copy,
}: {
  readonly redirectTo: string;
  /**
   * The copy this renders, resolved by the page that mounts it.
   *
   * A prop and not a dictionary import: this is a Client Component, and importing
   * `shared/i18n/dictionary` here would put **both** languages in the browser bundle.
   */
  readonly copy: Dictionary["auth"];
}) {
  const router = useRouter();
  const locale = useLocale();
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
      if (!isUserCancellation(error)) setFormError(authErrorMessage(error, locale));
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
      setFormError(authErrorMessage(error, locale));
    }
  }

  if (email === null) {
    return (
      <EmailStep
        copy={copy}
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
      copy={copy}
      email={email}
      error={formError}
      isBusy={isBusy}
      onBack={onBack}
      onSubmitPassword={onSubmitPassword}
    />
  );
}
