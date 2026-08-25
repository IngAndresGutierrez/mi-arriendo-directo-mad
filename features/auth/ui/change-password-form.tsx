"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import { z } from "zod";

import { authErrorMessage } from "@/shared/auth/errors";
import { changePassword } from "@/shared/auth/client";
import { LOGIN_ROUTE } from "@/shared/auth/routes";
import { FormAlert } from "@/shared/form/form-alert";
import { SubmitButton } from "@/shared/form/submit-button";
import { TextField } from "@/shared/form/text-field";

import { PasswordRequirements } from "./password-requirements";
import { signupSchema } from "../validations/auth";

const REQUIREMENTS_ID = "change-password-requirements";

/**
 * La actual no lleva reglas: es la que ya existe, y validarla contra los requisitos de hoy
 * rechazaría en el navegador una contraseña que Firebase aceptaría — dejando fuera precisamente a
 * quien más necesita cambiarla, el que la tiene vieja y débil.
 *
 * La nueva sale de `signupSchema`, nunca de un esquema propio: una pantalla que aceptara algo más
 * flojo que el registro sería la manera de saltárselo.
 */
const schema = signupSchema.extend({
  currentPassword: z.string().min(1, { error: "Escribe tu contraseña actual" }),
});

type FormValues = z.output<typeof schema>;

/**
 * Cambiar la contraseña desde dentro de la cuenta.
 *
 * **Pide la actual, y eso es la mitad del punto.** Sin ella esto sería un botón que le regala la
 * cuenta a cualquiera que se encuentre una sesión abierta en un portátil prestado; Firebase además
 * exige autenticación reciente para `updatePassword`, así que la comprobación no es un adorno del
 * formulario, es lo que hace que la operación exista.
 *
 * Solo se ofrece a quien entra con correo y contraseña. Ver el panel: quien entra con Google no
 * tiene ninguna contraseña aquí que cambiar.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { currentPassword: "", password: "" },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: FormValues) {
    setError(null);

    const result = await changePassword(values.currentPassword, values.password);

    if (!result.ok) {
      if (result.reason === "reauth") {
        /*
         * El único fallo que se puede señalar a un campo. `authErrorMessage` diría "correo o
         * contraseña incorrectos", que es el mensaje compartido que evita que el login enumere
         * cuentas — aquí no hay ninguna cuenta que adivinar y el formulario no tiene correo.
         */
        setFieldError("currentPassword", { message: "Esa no es tu contraseña actual." });
        return;
      }

      setError(authErrorMessage(result.error));
      return;
    }

    reset({ currentPassword: "", password: "" });
    setDone(true);

    /*
     * La contraseña cambió y la sesión no se pudo rehacer. No es un error —lo que se pidió está
     * hecho—, así que se dice y se lleva al login en vez de dejar a alguien en una pantalla que se
     * caerá sola en la siguiente navegación.
     */
    if (result.resignIn) {
      router.replace(LOGIN_ROUTE);
      router.refresh();
    }
  }

  return (
    /* `post` aunque lo envíe JavaScript: sin hidratar, un form sin método se manda como GET — y eso
       pondría las dos contraseñas en la URL y de ahí en el historial y en los logs del servidor. */
    <form
      method="post"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
      data-slot="change-password"
    >
      {error ? <FormAlert>{error}</FormAlert> : null}

      {done ? (
        <p role="status" className="flex items-center gap-1.5 text-sm text-foreground">
          <CheckIcon className="size-4 text-brand-panel" aria-hidden="true" />
          Tu contraseña quedó cambiada.
        </p>
      ) : null}

      <TextField
        id="currentPassword"
        type="password"
        label="Contraseña actual"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        disabled={isSubmitting}
        {...register("currentPassword")}
      />

      <div className="space-y-2">
        <TextField
          id="newPassword"
          type="password"
          label="Contraseña nueva"
          autoComplete="new-password"
          aria-describedby={REQUIREMENTS_ID}
          error={errors.password?.message}
          disabled={isSubmitting}
          {...register("password")}
        />
        <PasswordRequirements id={REQUIREMENTS_ID} value={password} />
      </div>

      <div className="sm:w-64">
        <SubmitButton loading={isSubmitting} loadingLabel="Cambiando…">
          Cambiar contraseña
        </SubmitButton>
      </div>
    </form>
  );
}
