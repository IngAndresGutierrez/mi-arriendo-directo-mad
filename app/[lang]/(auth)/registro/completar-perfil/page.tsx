import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { requireUser } from "@/shared/auth/session";
import { SignOutButton } from "@/shared/shell/sign-out-button";
import { CompleteProfileForm, getProfile } from "@/features/profile";
import { dictionary, localePath } from "@/shared/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).auth;

  return { title: copy.completeProfileTitle, description: copy.completeProfileMeta };
}

export default async function CompleteProfilePage(
  props: PageProps<"/[lang]/registro/completar-perfil">,
) {
  const { next } = await props.searchParams;
  /* Localised on the way out: see the note in the login page. */
  const redirectTo = await localePath(safeRedirect(next));
  const all = await dictionary();
  const copy = all.auth;

  // `requireUser` and not `requireCompleteProfile`: this is where the profile gets
  // completed, so requiring it would cause a redirect loop.
  const user = await requireUser();

  // Anyone who already completed it has no business on this screen.
  if (await getProfile(user.uid)) redirect(redirectTo);

  return (
    <AuthShell
      title={copy.welcome}
      description={copy.signupPanel}
      contentWidth="lg"
      action={<SignOutButton variant="inline" copy={all.nav} />}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-foreground">
        {copy.completeProfileHeading}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {copy.completeProfileNote}
      </p>

      <CompleteProfileForm redirectTo={redirectTo} common={all.common} />
    </AuthShell>
  );
}
