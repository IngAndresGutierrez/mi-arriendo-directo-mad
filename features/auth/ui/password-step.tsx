"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "lucide-react";

import { FormAlert } from "@/shared/form/form-alert";
import { PasswordRequirements } from "./password-requirements";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { signupSchema, type SignupInput } from "../validations/auth";

const REQUIREMENTS_ID = "password-requirements";

type PasswordStepProps = {
  email: string;
  error: string | null;
  isBusy: boolean;
  onBack: () => void;
  onSubmitPassword: (password: string) => Promise<void>;
};

/** Signup step 2: create the account password. */
export function PasswordStep({
  email,
  error,
  isBusy,
  onBack,
  onSubmitPassword,
}: PasswordStepProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: { password: "" },
  });

  // `useWatch` instead of `watch()`: the latter returns a function the React Compiler
  // cannot memoize safely.
  const password = useWatch({ control, name: "password" }) ?? "";
  const isSaving = isSubmitting || isBusy;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={isSaving}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <ArrowLeftIcon className="size-4" />
        Cambiar correo
      </button>

      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Crea tu contraseña
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Vas a crear la cuenta de <span className="font-medium text-foreground">{email}</span>.
      </p>

      <form
        onSubmit={handleSubmit((values) => onSubmitPassword(values.password))}
        noValidate
        className="space-y-4"
      >
        {error ? <FormAlert>{error}</FormAlert> : null}

        <TextField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          // The checklist describes the field; the error only shows when something slips
          // past it (exceeding the maximum length, for instance).
          hint={<PasswordRequirements id={REQUIREMENTS_ID} value={password} />}
          error={errors.password?.message}
          disabled={isSaving}
          autoFocus
          {...register("password")}
        />

        <SubmitButton loading={isSaving} loadingLabel="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </form>
    </>
  );
}
