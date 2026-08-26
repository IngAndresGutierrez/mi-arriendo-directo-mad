import { dictionary } from "@/shared/i18n/server";
import type { Dictionary } from "@/shared/i18n";
import { KeyRoundIcon, MailCheckIcon, ShieldIcon } from "lucide-react";

import { formatBogotaDateTime } from "@/shared/format/date";

import { ChangePasswordForm } from "./change-password-form";
import { SignOutEverywhere } from "./sign-out-everywhere";
import type { AccountSecurity, SignInMethod } from "../data/security";

/**
 * Which pair of dictionary keys describes each sign-in method.
 *
 * The **keys**, not the sentences: the words live in `shared/i18n/messages` like the rest of the
 * copy, and a complete `Record<SignInMethod, …>` still forces a decision when a new method appears.
 */
/**
 * The keys of `auth` whose value is a plain string.
 *
 * Not `keyof Dictionary["auth"]`: that union includes the parameterised entries, which are
 * functions, and indexing with it gives `string | ((…) => string)` — a type React cannot render.
 * Narrowing here means a key that stops being a plain sentence is caught at the table rather than
 * at the JSX that reads it.
 */
type AuthTextKey = {
  [K in keyof Dictionary["auth"]]: Dictionary["auth"][K] extends string ? K : never;
}[keyof Dictionary["auth"]];

const METHOD_COPY: Readonly<
  Record<SignInMethod, { label: AuthTextKey; note: AuthTextKey }>
> = {
  password: { label: "providerEmailLabel", note: "providerEmailNote" },
  google: { label: "providerGoogleLabel", note: "providerGoogleNote" },
  phone: { label: "providerPhoneLabel", note: "providerPhoneNote" },
  other: { label: "providerOtherLabel", note: "providerOtherNote" },
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
export async function SecurityPanel({
  security,
}: {
  readonly security: AccountSecurity | null;
}) {
  /* A Server Component, so it reads the language itself and hands the two client children a slice. */
  const copy = (await dictionary()).auth;

  if (!security) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
          {copy.howYouSignIn}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.securityUnavailable}</p>
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
          {copy.howYouSignIn}
        </h2>

        <ul className="mt-4 space-y-3">
          {security.methods.map((method) => (
            <li key={method} className="rounded-lg bg-muted px-4 py-3">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <KeyRoundIcon className="size-4 text-brand-panel" aria-hidden="true" />
                {copy[METHOD_COPY[method].label]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{copy[METHOD_COPY[method].note]}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 divide-y divide-border">
          <Row
            label={copy.emailVerified}
            value={security.emailVerified ? copy.yes : copy.notYet}
          />
          {security.lastSignInAt ? (
            <Row label={copy.lastSignIn} value={formatBogotaDateTime(security.lastSignInAt)} />
          ) : null}
          {security.createdAt ? (
            <Row label={copy.accountCreated} value={formatBogotaDateTime(security.createdAt)} />
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
            {copy.changeYourPassword}
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            {copy.changeYourPasswordNote}
          </p>

          <ChangePasswordForm copy={copy} />
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
            {copy.yourPassword}
          </h2>
          <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
            <MailCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {copy.noPasswordHere}
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
          {copy.signOutEverywhereTitle2}
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          {copy.signOutEverywhereNote}
        </p>

        <SignOutEverywhere copy={copy} />
      </section>
    </div>
  );
}
