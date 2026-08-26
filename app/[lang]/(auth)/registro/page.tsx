import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { dictionary, localePath } from "@/shared/i18n/server";

import { SignupForm } from "@/features/auth";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).auth;

  return { title: copy.createAccount, description: copy.signupMeta };
}

export default async function RegistroPage(props: PageProps<"/[lang]/registro">) {
  const { next } = await props.searchParams;
  /* Localised on the way out: see the note in the login page. */
  const redirectTo = await localePath(safeRedirect(next));
  const copy = (await dictionary()).auth;

  const user = await getSessionUser();
  if (user) redirect(redirectTo);

  return (
    <AuthShell
      title={copy.welcome}
      description={copy.signupPanel}
    >
      <SignupForm redirectTo={redirectTo} copy={copy} />
    </AuthShell>
  );
}
