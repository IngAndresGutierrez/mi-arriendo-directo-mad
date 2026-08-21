import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { requireUser } from "@/shared/auth/session";
import { getProfile } from "@/lib/data/profile";

import { CompleteProfileForm } from "./complete-profile-form";

export const metadata: Metadata = {
  title: "Completa tu perfil",
  description: "Completa tus datos para empezar a usar miarriendoDIRECTO.com.",
};

export default async function CompleteProfilePage(
  props: PageProps<"/registro/completar-perfil">,
) {
  const { next } = await props.searchParams;
  const redirectTo = safeRedirect(next);

  // `requireUser` y no `requireCompleteProfile`: aquí es donde el perfil se completa, así
  // que exigirlo produciría un bucle de redirección.
  const user = await requireUser();

  // Quien ya lo completó no tiene nada que hacer en esta pantalla.
  if (await getProfile(user.uid)) redirect(redirectTo);

  return (
    <AuthShell
      title="Te damos la bienvenida"
      description="Crea tu cuenta y únete a la nueva forma de arrendar, sin trámites innecesarios."
      contentWidth="lg"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-foreground">
        Completa tu perfil
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Necesitamos estos datos para validar tu identidad y preparar tus contratos.
      </p>

      <CompleteProfileForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
