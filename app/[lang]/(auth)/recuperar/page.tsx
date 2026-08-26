import { dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordResetForm } from "@/features/auth";
import { HOME_ROUTE } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { AuthShell } from "@/shared/shell/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).auth;

  return { title: copy.resetTitle, description: copy.resetMeta };
}

/**
 * `/recuperar` — asking for the email that lets you back in.
 *
 * **This route existed as a link long before it existed as a page.** `LOGIN_ROUTE`'s form has
 * carried "¿Olvidaste tu contraseña?" pointing here from the start, and until now it answered 404:
 * the exact failure the legal pages had, and the one `pnpm build` cannot catch, because a `<Link>`
 * to a route that is not there compiles perfectly.
 *
 * **Somebody with a live session is sent to the portal.** They are not locked out, so this screen
 * has nothing to offer them — and it is the one screen where arriving by accident is most likely,
 * since the link sits next to a password field they may have half-filled. Changing a password from
 * inside an account is a different flow (it should ask for the current one) and is not built.
 */
export default async function PasswordResetPage() {
  const copy = (await dictionary()).auth;
  const user = await getSessionUser();
  if (user) redirect(HOME_ROUTE);

  return (
    <AuthShell
      title={
        <>
          {copy.panelResetLead} <span className="text-accent">{copy.panelResetAccent}</span>
        </>
      }
      description={copy.resetPanel}
    >
      <PasswordResetForm copy={copy} />
    </AuthShell>
  );
}
