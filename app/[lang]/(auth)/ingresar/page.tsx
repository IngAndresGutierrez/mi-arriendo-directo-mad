import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/shared/shell/auth-shell";
import { safeRedirect } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { dictionary, localePath } from "@/shared/i18n/server";

import { LoginForm } from "@/features/auth";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).auth;

  return {
    title: copy.loginTitle,
    description: copy.loginMeta,
  /*
   * **No `robots` override any more, and that is the point of the move.** While this file was
   * `/` it was the login and the site root at once, so it had to override its own group back to
   * `index: true` — the homepage of the domain cannot ask not to be indexed. The landing holds the
   * root now, so this page inherits `(auth)`'s `noindex` like the signup beside it, which is the
   * honest answer for a page whose entire content is a password field.
   */
  };
}

export default async function LoginPage(props: PageProps<"/[lang]/ingresar">) {
  const { next } = await props.searchParams;
  /*
   * `localePath` on the way out: `safeRedirect` returns a canonical Spanish path when it refuses the
   * request, and sending somebody who signed in on the English side to `/inicio` would drop them
   * into the Spanish product. It is idempotent, so a `?next=/en/inicio` that was accepted comes
   * back unchanged.
   */
  const redirectTo = await localePath(safeRedirect(next));
  const copy = (await dictionary()).auth;

  // Anyone who already has a session does not need to see the form.
  const user = await getSessionUser();
  if (user) redirect(redirectTo);

  return (
    <AuthShell
      title={
        <>
          {copy.panelLoginLead} <span className="text-accent">{copy.panelLoginAccent}</span>
        </>
      }
      description={copy.loginPanel}
    >
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {copy.welcomeBack}
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        {copy.enterCredentials}
      </p>

      <LoginForm redirectTo={redirectTo} copy={copy} />
    </AuthShell>
  );
}
