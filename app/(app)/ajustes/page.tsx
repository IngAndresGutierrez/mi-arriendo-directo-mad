import type { Metadata } from "next";
import Link from "next/link";

import { getAccountSecurity, SecurityPanel } from "@/features/auth";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferencesCard,
  readNotificationPreferences,
} from "@/features/notification";
import { AccountForm } from "@/features/profile/client";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import type { Department } from "@/shared/geo/colombia";
import { findCountry } from "@/shared/phone/countries";

import { SettingsTabs } from "./settings-tabs";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Tus datos, tus avisos y cómo entras a tu cuenta.",
  // El `noindex, nofollow` lo pone el layout de `(app)` para todo el grupo. Repetirlo aquí con
  // solo `index: false` reemplazaría el objeto entero y se comería el `nofollow`.
};

/** Las iniciales del nombre, para la ficha de identidad. Dos como mucho: tres no caben. */
function initials(fullName: string, fallback: string): string {
  const letters = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");

  return letters.join("") || fallback.slice(0, 1).toUpperCase() || "?";
}

/**
 * Los ajustes de la cuenta: quién eres, de qué te avisamos y cómo entras.
 *
 * **La pestaña Perfil no duplica `/perfil-inquilino`, y la diferencia es de quién es cada cosa.** El
 * dossier de inquilino —documento, ingresos, referencia— lo llena quien se postula, y un propietario
 * puede recorrer el producto entero sin tener uno. Los datos de cuenta los tienen los dos, porque son
 * lo que la plataforma muestra de una persona a la otra, así que su sitio es este.
 *
 * Que los dos formularios sean el mismo `AccountFields` sobre la misma `updateProfile` contra el
 * mismo `users/{uid}` es lo que hace que no puedan contradecirse: corregir el teléfono en cualquiera
 * de las dos pantallas lo corrige en la otra, porque no hay dos copias — hay un documento con dos
 * puertas.
 */
export default async function SettingsPage() {
  const user = await requireCompleteProfile();

  /*
   * Tres lecturas independientes, en paralelo. Encadenadas, la página tardaría lo que suman; y
   * ninguna de las tres necesita el resultado de otra.
   */
  const [account, preferences, security] = await Promise.all([
    getProfile(user.uid),
    readNotificationPreferences(user.uid),
    getAccountSecurity(user.uid),
  ]);

  /*
   * El teléfono vuelve de E.164 a los dígitos nacionales que muestra el campo: `+57` es del selector
   * de país, y dejarlo dentro de la caja de texto hace que el número falle su propia validación en
   * cuanto alguien lo toca.
   */
  const country = account ? findCountry(account.phoneCountry) : undefined;
  const national =
    account && country && account.phone.startsWith(country.dialCode)
      ? account.phone.slice(country.dialCode.length)
      : (account?.phone ?? "");

  const fullName = account?.fullName ?? "";
  const email = user.email ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Ajustes
      </h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Tus datos, de qué te avisamos y cómo entras a tu cuenta.
      </p>

      <SettingsTabs
        profile={
          <div className="space-y-6">
            {/*
              La ficha de identidad. Las iniciales y **ninguna foto**: subir una es una capacidad que
              este producto no tiene todavía —ni ruta en el bucket, ni reglas, ni sitio donde se vea—
              y un círculo que invita a hacer clic para cambiarla sería un control que no hace nada.
            */}
            <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
              <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-panel text-xl font-semibold text-brand-panel-foreground"
              >
                {initials(fullName, email)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{fullName}</p>
                <p className="truncate text-sm text-muted-foreground">{email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  El correo viene de tu forma de entrar y no se edita aquí.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
                Tus datos
              </h2>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Es lo que ve la otra parte de un proceso. Los mismos datos aparecen en{" "}
                <Link
                  href={TENANT_PROFILE_ROUTE}
                  className="font-medium text-brand-panel underline underline-offset-4"
                >
                  tu perfil de inquilino
                </Link>
                : cambiarlos en cualquiera de los dos sitios los cambia en el otro.
              </p>

              <AccountForm
                account={{
                  fullName,
                  phone: { country: account?.phoneCountry ?? "CO", national },
                  // Un select sin valor muestra su placeholder; `null` no es un valor que acepte.
                  gender: account?.gender ?? undefined,
                  birthDate: account?.birthDate ?? "",
                  address: {
                    line: account?.address.line ?? "",
                    city: account?.address.city ?? "",
                    department: account?.address.department as Department | undefined,
                  },
                }}
              />
            </section>
          </div>
        }
        notifications={
          /*
           * `null` es "no pudimos leer", no "todo apagado": ver `allowsChannel`. Se dibuja con los
           * valores por defecto, que es también lo que el servidor está aplicando mientras tanto, y
           * cualquier cambio manda la tabla entera — así que tocar un interruptor deja un estado
           * completo y correcto aunque la lectura hubiera fallado.
           */
          <NotificationPreferencesCard
            preferences={preferences ?? DEFAULT_NOTIFICATION_PREFERENCES}
          />
        }
        security={<SecurityPanel security={security} />}
      />
    </div>
  );
}
