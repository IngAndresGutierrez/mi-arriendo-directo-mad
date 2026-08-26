"use client";

import type { Dictionary } from "@/shared/i18n";
import { useState, useTransition } from "react";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";

import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";

import { requestPasswordReset } from "../actions/request-password-reset";
import { passwordResetSchema, type EmailInput } from "../validations/auth";

/**
 * Step one of recovering an account: say which address, and we send a link to it.
 *
 * **The confirmation never says whether the account exists**, and the wording is the whole point:
 * "si existe una cuenta con ese correo, te enviamos un enlace". Anything more definite turns this
 * screen into an account-enumeration oracle — type addresses, learn which ones are registered —
 * which is the same leak `shared/auth/errors.ts` avoids by giving invalid credentials and unknown
 * user one shared message on the login form. The action is silent for the same reason; this is the
 * half a person actually reads.
 *
 * **There is no error state on submit either.** The action never throws and never reports a
 * refusal, so the only failure the form can show is a malformed address, which the schema catches
 * before anything is sent. A form that sometimes said "no pudimos enviarlo" would be leaking the
 * same bit through a different door.
 */
export function PasswordResetForm({
  copy,
}: {
  /**
   * The copy this renders, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing `shared/i18n/dictionary` here would put **both** languages into
   * the browser bundle.
   */
  readonly copy: Dictionary["auth"];
}) {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailInput>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  if (sentTo) {
    return (
      <div>
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <MailCheckIcon className="size-6" />
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          {copy.checkYourEmail}
        </h1>

        {/*
          `role="status"`: the heading and the form were swapped out from under somebody who may not
          be looking at the screen, and without a live region the only feedback for a screen reader
          is that the button stopped being busy.
        */}
        <p role="status" className="mt-2 text-muted-foreground">
          {copy.resetSentToBefore} <span className="font-medium text-foreground">{sentTo}</span>
          {copy.resetSentToAfter}
        </p>

        <p className="mt-6 text-sm text-muted-foreground">
          {copy.resetNotArrived}
        </p>

        <div className="mt-8">
          <Link
            href={LOGIN_ROUTE}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-foreground"
          >
            {copy.backToSignIn}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {copy.resetTitle}
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        {copy.resetFormNote}
      </p>

      {/* `post`, even though JavaScript submits it: see the note in `login-form.tsx`. */}
      <form
        method="post"
        onSubmit={handleSubmit((values) => {
          startTransition(async () => {
            await requestPasswordReset(values);
            setSentTo(values.email);
          });
        })}
        noValidate
        className="space-y-6"
      >
        <TextField
          id="email"
          label={copy.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={copy.emailPlaceholderAlt}
          error={errors.email?.message}
          disabled={isPending}
          {...register("email")}
        />

        <SubmitButton loading={isPending} disabled={isPending} loadingLabel={copy.sendingLink}>
          {copy.sendLink}
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿Ya la recordaste?{" "}
        <Link
          href={LOGIN_ROUTE}
          className="font-medium text-primary underline-offset-4 hover:underline dark:text-foreground"
        >
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
