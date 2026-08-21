import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { requireUser } from "@/shared/auth/session";
import { getProfile } from "@/features/profile";

import { CompleteProfileForm } from "@/features/profile";

export const metadata: Metadata = {
  title: "Completa tu perfil",
  description: "Completa tus datos para empezar a usar miarriendoDIRECTO.com.",
};

export default async function CompleteProfilePage(
  props: PageProps<"/registro/completar-perfil">,
) {
  const { next } = await props.searchParams;
  const redirectTo = safeRedirect(next);

  // `requireUser` and not `requireCompleteProfile`: this is where the profile gets
  // completed, so requiring it would cause a redirect loop.
  const user = await requireUser();

  // Anyone who already completed it has no business on this screen.
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
