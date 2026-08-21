import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { requireCompleteProfile } from "@/lib/auth/session";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Panel",
  description: "Tu portal en miarriendoDIRECTO.com.",
};

const ROLE_LABEL = {
  inquilino: "Inquilino",
  propietario: "Propietario",
  admin: "Administrador",
} as const;

export default async function DashboardPage() {
  const user = await requireCompleteProfile();

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Logo width={160} priority />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          Hola{user.email ? `, ${user.email}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Entraste como <span className="font-medium text-foreground">{ROLE_LABEL[user.role]}</span>.
        </p>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Tu portal está en construcción</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aquí van a vivir tus inmuebles, postulaciones, contratos y pagos. Esta pantalla
            existe para cerrar el flujo de acceso: es el destino al que llegas después de
            iniciar sesión.
          </p>
        </div>
      </main>
    </div>
  );
}
