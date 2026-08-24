"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon } from "lucide-react";

import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

import { LOGIN_ROUTE, PASSWORD_RESET_ROUTE } from "@/shared/auth/routes";
import { authErrorMessage } from "@/shared/auth/errors";
import { auth } from "@/shared/firebase/auth";
import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";
import { Button } from "@/shared/ui/button";

import { PasswordRequirements } from "./password-requirements";
import { signupSchema, type SignupInput } from "../validations/auth";

const REQUIREMENTS_ID = "new-password-requirements";

/** What the screen is doing, rather than three booleans that can contradict each other. */
type State =
  | { readonly step: "checking" }
  /**
   * `missing` and `rejected` are kept apart because they are not the same news.
   *
   * A **rejected** code is a dead link: expired, already spent, revoked. A **missing** one usually
   * is not a failure at all — the likeliest way to arrive with no code is having just finished the
   * reset on Firebase's own hosted page, which then forwards here. Telling that person "el enlace
   * no sirve" is telling them something false about a password they just changed successfully.
   */
  | { readonly step: "invalid"; readonly reason: "missing" | "rejected" }
  | { readonly step: "ready"; readonly email: string }
  | { readonly step: "done" };

/**
 * Step two: the link was opened, so choose the new password.
 *
 * **The code is verified before the form is shown, not when it is submitted.** `oobCode` is
 * single-use and expires in an hour, and the two ways somebody arrives here with a dead one are
 * both ordinary — the link sat in an inbox overnight, or it was already used. Discovering that
 * *after* typing a password twice is the version of this screen that makes people give up, and
 * `verifyPasswordResetCode` costs one call to find out up front. It also returns the address, which
 * is what lets the screen say whose account is being changed: somebody with two accounts needs to
 * know which link they opened.
 *
 * **This is a Client Component and it has to be.** A fragment is never sent to the server, and
 * although Firebase puts `oobCode` in the query string rather than the hash, the code is a
 * credential: handing it to the server would put it in the request log of every hop on the way. The
 * web SDK exchanges it directly with Firebase from the browser, which is also why no Server Action
 * appears here at all.
 *
 * **`signupSchema` rather than a new schema**, so the rules a password must meet are defined once.
 * A reset screen that quietly accepted a weaker password than signup would be a way around them.
 */
export function NewPasswordForm({ oobCode }: { readonly oobCode: string }) {
  const router = useRouter();
  /*
   * The "no code at all" case is **initial state, not an effect**. Setting it synchronously inside
   * the effect is what the React compiler refuses — the same rule `LeaseTabs` pays for with its
   * `requestAnimationFrame` — and here there is nothing to schedule: whether the URL carried a code
   * is known at first render, so it is a value, not a side effect. Only the round trip to Firebase
   * needs an effect, and that one sets state from a promise callback, which is fine.
   */
  const [state, setState] = useState<State>(() =>
    oobCode ? { step: "checking" } : { step: "invalid", reason: "missing" },
  );
  const [error, setError] = useState<string | null>(null);

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

  const password = useWatch({ control, name: "password" }) ?? "";

  useEffect(() => {
    if (!oobCode) return;

    let cancelled = false;

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (!cancelled) setState({ step: "ready", email });
      })
      .catch(() => {
        // Deliberately one message for every reason the code is bad. Firebase tells them apart —
        // expired, already used, revoked — and none of those distinctions helps the person, while
        // "ya se usó" tells whoever holds a leaked link that it worked for somebody.
        if (!cancelled) setState({ step: "invalid", reason: "rejected" });
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  if (state.step === "checking") {
    return (
      <p role="status" className="text-muted-foreground">
        Comprobando el enlace…
      </p>
    );
  }

  if (state.step === "invalid") {
    const missing = state.reason === "missing";

    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          {missing ? "Aquí no hay nada que cambiar" : "El enlace no sirve"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {missing
            ? "Esta pantalla necesita el código que viene en el correo de recuperación. Si acabas de elegir tu contraseña nueva, ya está guardada: entra con ella."
            : "Este enlace ya no sirve: pudo vencerse o haberse usado. Pide uno nuevo."}
        </p>

        {/*
          Con código muerto, la acción es pedir otro. Sin código, lo más probable es que la persona
          venga de terminar el cambio, así que la cyan es entrar y pedir otro enlace queda al lado
          por si de verdad se perdió — una sola cyan por vista, y aquí depende de por qué se llegó.
        */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant={missing ? "accent" : "brand"} size="xl">
            <Link href={missing ? LOGIN_ROUTE : PASSWORD_RESET_ROUTE}>
              {missing ? "Iniciar sesión" : "Pedir un enlace nuevo"}
            </Link>
          </Button>
          <Button asChild variant={missing ? "brand" : "accent"} size="xl">
            <Link href={missing ? PASSWORD_RESET_ROUTE : LOGIN_ROUTE}>
              {missing ? "Pedir un enlace nuevo" : "Iniciar sesión"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state.step === "done") {
    return (
      <div>
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <CheckCircle2Icon className="size-6" />
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          Contraseña actualizada
        </h1>
        <p role="status" className="mt-2 text-muted-foreground">
          Ya puedes entrar con tu contraseña nueva. Si habías iniciado sesión en otro dispositivo,
          tendrás que volver a entrar allí.
        </p>

        <Button asChild variant="accent" size="xl" className="mt-8">
          <Link href={LOGIN_ROUTE}>Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Elige una contraseña nueva
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Para la cuenta de <span className="font-medium text-foreground">{state.email}</span>.
      </p>

      {/* `post`, though JS handles the submit: see the note in `login-form.tsx`. */}
      <form
        method="post"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            await confirmPasswordReset(auth, oobCode, values.password);
            setState({ step: "done" });
            /*
             * Firebase revokes the refresh tokens when a password is reset, so any session this
             * browser still holds is already dead. `refresh()` is what makes the server stop
             * rendering as though it were alive — without it the login screen this sends them to
             * could still be answered from a cached signed-in render.
             */
            router.refresh();
          } catch (cause) {
            setError(authErrorMessage(cause));
          }
        })}
        noValidate
        className="space-y-4"
      >
        {error ? <FormAlert>{error}</FormAlert> : null}

        <TextField
          id="password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          // The checklist describes the field, so it goes through `hint` and lands in
          // `aria-describedby`. Rendered as a sibling it would be a list nothing points at.
          hint={<PasswordRequirements id={REQUIREMENTS_ID} value={password} />}
          error={errors.password?.message}
          disabled={isSubmitting}
          autoFocus
          {...register("password")}
        />

        <SubmitButton loading={isSubmitting} disabled={isSubmitting} loadingLabel="Guardando…">
          Guardar la contraseña
        </SubmitButton>
      </form>
    </>
  );
}
