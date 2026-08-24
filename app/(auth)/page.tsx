import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";

import { LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description:
    "Accede a tu portal de miarriendoDIRECTO.com para gestionar tus inmuebles, postulaciones y pagos.",
  /*
   * **Overrides the group's `noindex`, on purpose.** `(auth)` is `noindex` because signing up and
   * completing a profile are not search results — but a route group does not change the URL, so
   * this file is also `/`: the site root, and where somebody searching for the brand has to land.
   * Without this line the homepage of the domain would be asking not to be indexed.
   */
  robots: { index: true, follow: true },
};

export default async function LoginPage(props: PageProps<"/">) {
  const { next } = await props.searchParams;
  const redirectTo = safeRedirect(next);

  // Anyone who already has a session does not need to see the form.
  const user = await getSessionUser();
  if (user) redirect(redirectTo);

  return (
    <AuthShell
      title={
        <>
          Conecta. Gestiona. <span className="text-accent">Acierta.</span>
        </>
      }
      description="Conecta directamente entre propietario e inquilino, valida perfiles en minutos y gestiona cada etapa de tu contrato en una sola plataforma."
    >
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Bienvenido de nuevo
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Ingresa tus credenciales para entrar a tu portal.
      </p>

      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
