"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { maskChannel } from "@/features/application/client";
import { signInWithCollaboratorToken } from "@/shared/auth/client";
import { COLLABORATOR_ROUTE } from "@/shared/auth/routes";
import { FormAlert } from "@/shared/form/form-alert";
import { PhoneField } from "@/shared/form/phone-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Button } from "@/shared/ui/button";

import { requestCollaboratorCode, verifyCollaboratorCode } from "../actions/collaborator-session";
import { CODE_LENGTH } from "../domain/collaborator-auth";
import { requestCodeSchema, verifyCodeSchema } from "../validations/errand";

/**
 * How a collaborator gets in: their phone, then a code sent to it.
 *
 * **No password, and above all not the phone number as its own password** — which is what was first
 * asked for and would have meant no secret at all, since a phone number is on WhatsApp, on a card
 * and in a dozen forwarded chats. The factor here is *having* the phone, and it costs the person
 * nothing extra: the code arrives on the same channel the errand did, and there is nothing to
 * remember between one job and the next a month later.
 *
 * Two steps in one component because they are one act. Splitting them across routes would put the
 * number in a URL — personal data in the history and the server log — for no gain.
 */
export function CollaboratorLogin() {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /*
   * Typed with **input and output**, not one type for both. `phoneCountry` has a `.default()`, so
   * Zod's input has it optional while its output has it required — and with a single type parameter
   * `handleSubmit` does not fit. This is the trap `CLAUDE.md` records; it costs a line to avoid and
   * an afternoon to diagnose.
   */
  const phoneForm = useForm<
    z.input<typeof requestCodeSchema>,
    unknown,
    z.output<typeof requestCodeSchema>
  >({
    resolver: zodResolver(requestCodeSchema),
    mode: "onBlur",
    defaultValues: { phoneCountry: "CO", phoneNational: "" },
  });

  const codeForm = useForm<
    z.input<typeof verifyCodeSchema>,
    unknown,
    z.output<typeof verifyCodeSchema>
  >({
    resolver: zodResolver(verifyCodeSchema),
    mode: "onSubmit",
    defaultValues: { phoneCountry: "CO", phoneNational: "", code: "" },
  });

  if (sentTo) {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          Escribe el código
        </h1>
        <p className="mt-2 mb-8 text-muted-foreground">
          Te lo mandamos por WhatsApp y por SMS a{" "}
          <span className="font-medium text-foreground">{maskChannel("sms", sentTo)}</span>. Vence en
          10 minutos.
        </p>

        {/* `post`, though JS submits it: see the note in `login-form.tsx`. */}
        <form
          method="post"
          onSubmit={codeForm.handleSubmit((values) => {
            setError(null);
            startTransition(async () => {
              const result = await verifyCollaboratorCode(values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              /*
               * The custom token becomes a Firebase session and then the same httpOnly cookie every
               * other user carries — nothing about this person's session is special, which is what
               * lets the Security Rules keep speaking `request.auth.uid`.
               */
              const signedIn = await signInWithCollaboratorToken(result.token);
              if (!signedIn) {
                setError("No pudimos iniciar tu sesión. Inténtalo otra vez.");
                return;
              }
              router.replace(COLLABORATOR_ROUTE);
              router.refresh();
            });
          })}
          noValidate
          className="space-y-6"
        >
          {error ? <FormAlert>{error}</FormAlert> : null}

          <TextField
            id="code"
            label="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="000000"
            error={codeForm.formState.errors.code?.message}
            disabled={isPending}
            autoFocus
            {...codeForm.register("code")}
          />

          <SubmitButton loading={isPending} disabled={isPending} loadingLabel="Entrando…">
            Entrar
          </SubmitButton>
        </form>

        <Button
          variant="ghost"
          size="lg"
          className="mt-4"
          disabled={isPending}
          onClick={() => {
            setSentTo(null);
            setError(null);
          }}
        >
          Usar otro número
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Tus encargos
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Escribe el número donde recibiste el encargo y te mandamos un código para entrar.
      </p>

      <form
        method="post"
        onSubmit={phoneForm.handleSubmit((values) => {
          setError(null);
          startTransition(async () => {
            const result = await requestCollaboratorCode(values);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            /*
             * The code step is shown whether or not that number belongs to anybody. The action is
             * silent about it for the same reason the password reset is: a different answer here
             * would turn this form into a way of asking whether a given mobile works with this
             * product, and the numbers being probed would be people's.
             */
            codeForm.setValue("phoneCountry", values.phoneCountry);
            codeForm.setValue("phoneNational", values.phoneNational);
            setSentTo(result.phone);
          });
        })}
        noValidate
        className="space-y-6"
      >
        {error ? <FormAlert>{error}</FormAlert> : null}

        <Controller
          control={phoneForm.control}
          name="phoneCountry"
          render={({ field }) => (
            <PhoneField
              label="Tu número"
              // `?? "CO"`: the field's *input* type is optional because the schema defaults it, so
              // the value is `string | undefined` until Zod runs. The default is the same constant.
              country={field.value ?? "CO"}
              onCountryChange={(iso) => {
                field.onChange(iso);
                // The number's rule depends on the country: without revalidating, the previous
                // country's error stays on screen even once the number is valid.
                if (phoneForm.getValues("phoneNational")) void phoneForm.trigger("phoneNational");
              }}
              countryError={phoneForm.formState.errors.phoneCountry?.message}
              numberError={phoneForm.formState.errors.phoneNational?.message}
              disabled={isPending}
              inputProps={phoneForm.register("phoneNational")}
            />
          )}
        />

        <SubmitButton loading={isPending} disabled={isPending} loadingLabel="Enviando…">
          Mándame el código
        </SubmitButton>
      </form>
    </>
  );
}
