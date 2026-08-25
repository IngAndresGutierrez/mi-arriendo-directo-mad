import { KeyRoundIcon, MailCheckIcon, ShieldIcon } from "lucide-react";

import { formatBogotaDateTime } from "@/shared/format/date";

import { ChangePasswordForm } from "./change-password-form";
import { SignOutEverywhere } from "./sign-out-everywhere";
import type { AccountSecurity, SignInMethod } from "../data/security";

const METHOD_COPY: Readonly<Record<SignInMethod, { label: string; note: string }>> = {
  password: {
    label: "Correo y contraseña",
    note: "Entras con tu correo y una contraseña que eliges tú.",
  },
  google: {
    label: "Google",
    note: "Tu contraseña y la verificación en dos pasos las administra Google, así que aquí no hay nada que configurar.",
  },
  phone: {
    label: "Código a tu teléfono",
    note: "Entras con un código de un solo uso, sin contraseña.",
  },
  other: { label: "Otro método", note: "Escríbenos si quieres cambiar cómo entras." },
};

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Cómo entras y qué puedes hacer al respecto.
 *
 * **Lo que esta pantalla deliberadamente no tiene es una lista de sesiones activas.** Firebase no
 * expone en qué dispositivos hay una sesión abierta —no hay tal inventario que consultar—, así que
 * la fila "dispositivo actual · activo" que pedía el diseño de referencia sería una lista de un
 * elemento que en realidad solo dice "tú", con el aspecto de un registro que nadie lleva. Lo que sí
 * es verdad y sí sirve es **cuándo fue la última entrada**: una que no reconoces es exactamente la
 * razón por la que alguien abre esta pestaña, y debajo está el botón que lo corta todo.
 *
 * Server Component: lo único interactivo son las dos piezas de abajo, cada una con su `"use client"`.
 */
export function SecurityPanel({ security }: { readonly security: AccountSecurity | null }) {
  if (!security) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
          Cómo entras
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No pudimos leer el estado de tu cuenta en este momento. Recarga la página en un rato; tus
          preferencias de avisos siguen funcionando.
        </p>
      </section>
    );
  }

  const hasPassword = security.methods.includes("password");

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="como-entras"
        data-slot="sign-in-methods"
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2
          id="como-entras"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-primary dark:text-foreground"
        >
          <ShieldIcon className="size-5" aria-hidden="true" />
          Cómo entras
        </h2>

        <ul className="mt-4 space-y-3">
          {security.methods.map((method) => (
            <li key={method} className="rounded-lg bg-muted px-4 py-3">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <KeyRoundIcon className="size-4 text-brand-panel" aria-hidden="true" />
                {METHOD_COPY[method].label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{METHOD_COPY[method].note}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 divide-y divide-border">
          <Row
            label="Correo verificado"
            value={security.emailVerified ? "Sí" : "Todavía no"}
          />
          {security.lastSignInAt ? (
            <Row label="Última entrada" value={formatBogotaDateTime(security.lastSignInAt)} />
          ) : null}
          {security.createdAt ? (
            <Row label="Cuenta creada" value={formatBogotaDateTime(security.createdAt)} />
          ) : null}
        </dl>
      </section>

      {hasPassword ? (
        <section
          aria-labelledby="cambiar-contrasena"
          className="rounded-xl border border-border bg-card p-6"
        >
          <h2
            id="cambiar-contrasena"
            className="text-lg font-semibold tracking-tight text-primary dark:text-foreground"
          >
            Cambiar tu contraseña
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Te pedimos la actual: sin eso, cualquiera que se encuentre tu sesión abierta podría
            quedarse con la cuenta.
          </p>

          <ChangePasswordForm />
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
            Tu contraseña
          </h2>
          <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
            <MailCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            No tienes una contraseña en este producto: entras con Google, y tanto la contraseña como
            la verificación en dos pasos las administra Google.
          </p>
        </section>
      )}

      <section
        aria-labelledby="cerrar-todo"
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2
          id="cerrar-todo"
          className="text-lg font-semibold tracking-tight text-primary dark:text-foreground"
        >
          Cerrar sesión en todas partes
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Si crees que alguien más entró a tu cuenta, esto invalida todas las sesiones abiertas.
          También la de este dispositivo.
        </p>

        <SignOutEverywhere />
      </section>
    </div>
  );
}
