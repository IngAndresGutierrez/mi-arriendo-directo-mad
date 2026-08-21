import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";

import { SignupForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description:
    "Crea tu cuenta en miarriendoDIRECTO.com y arrienda sin intermediarios ni trámites innecesarios.",
};

export default async function RegistroPage(props: PageProps<"/registro">) {
  const { next } = await props.searchParams;
  const redirectTo = safeRedirect(next);

  const user = await getSessionUser();
  if (user) redirect(redirectTo);

  return (
    <AuthShell
      title="Te damos la bienvenida"
      description="Crea tu cuenta y únete a la nueva forma de arrendar, sin trámites innecesarios."
    >
      <SignupForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
