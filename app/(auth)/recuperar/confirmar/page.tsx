import type { Metadata } from "next";

import { NewPasswordForm } from "@/features/auth";
import { AuthShell } from "@/shared/shell/auth-shell";

export const metadata: Metadata = {
  title: "Elige una contraseña nueva",
  description: "Termina de recuperar tu cuenta de miarriendoDIRECTO.com.",
};

/**
 * `/recuperar/confirmar?oobCode=…` — where the link in the email lands.
 *
 * **Firebase decides whether this page is ever reached, and that is a console setting rather than
 * code.** `generatePasswordResetLink` builds its link against the project's *action URL*; out of
 * the box that is Google's own hosted handler on the `authDomain`, which works but is a page with
 * somebody else's branding on it in the middle of recovering an account. Pointing it here is one
 * field in Firebase Authentication → Templates → Action URL, set to
 * `https://miarriendodirecto.com/recuperar/confirmar`.
 *
 * This page is built and correct either way, which is the point of doing it in this order: with the
 * console untouched nothing regresses — the flow simply completes on Firebase's page — and the day
 * the setting changes, the branded screen is already there. Nothing about the security of the code
 * depends on which page handles it; `oobCode` is verified by Firebase in both.
 *
 * **No session guard here, unlike `/recuperar`.** Somebody resetting a password may well still have
 * a stale session in this browser — that is exactly what happens when they reset it *because* they
 * are confused about being signed in — and bouncing them to the portal would strand them holding a
 * one-use link that expires in an hour.
 *
 * The code is read from `searchParams` and handed straight to a Client Component: the exchange with
 * Firebase happens in the browser, so the credential never reaches this server.
 */
export default async function ConfirmPasswordResetPage(
  props: PageProps<"/recuperar/confirmar">,
) {
  const { oobCode } = await props.searchParams;

  return (
    <AuthShell
      title={
        <>
          Casi listo. <span className="text-accent">Elige tu contraseña.</span>
        </>
      }
      description="Después de guardarla podrás entrar con ella en cualquier dispositivo."
    >
      <NewPasswordForm oobCode={typeof oobCode === "string" ? oobCode : ""} />
    </AuthShell>
  );
}
