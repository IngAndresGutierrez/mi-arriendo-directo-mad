import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PASSWORD_RESET_CONFIRM_ROUTE } from "@/shared/auth/routes";

export const metadata: Metadata = {
  title: "Confirmando…",
  robots: { index: false, follow: false },
};

/**
 * Firebase's **email action handler**, pointed at this site.
 *
 * Every link Firebase mails — reset a password, verify an address, undo an email change, remove a
 * second factor — goes to one configured URL (`notification.sendEmail.callbackUri` in the Identity
 * Platform config) with `?mode=…&oobCode=…`. **One URL for every kind of action**, which is the
 * whole reason this file exists rather than the console pointing straight at
 * `/recuperar/confirmar`: that screen only knows how to reset a password, and this product **does**
 * send verification email — `sendEmailVerification` runs at signup — so aiming the global setting at
 * it would have answered "este enlace no sirve" to every new account confirming its address.
 *
 * So this is a router and not a page. It owns exactly one mode and forwards the rest to the handler
 * that serves them today, which means flipping the console setting changes the behaviour of
 * password resets and of nothing else. That is what makes the change safe to make and easy to
 * reason about afterwards.
 *
 * **A Server Component doing a redirect, so nothing renders and nothing flashes.** The `oobCode` is
 * a credential and this hop does put it in one server's request log — ours — which is the price of
 * the branded screen; it is not forwarded anywhere new, since Firebase already received it and the
 * fallback goes back to Firebase.
 */
export default async function EmailActionPage(props: PageProps<"/cuenta/accion">) {
  const params = await props.searchParams;
  const first = (value: string | string[] | undefined): string =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const mode = first(params.mode);
  const oobCode = first(params.oobCode);

  /*
   * The one we handle. Anything else — `verifyEmail`, `recoverEmail`, `revertSecondFactorAddition`,
   * or a mode Firebase adds later — is not ours to interpret, and guessing would break a flow that
   * works today.
   */
  if (mode === "resetPassword" && oobCode) {
    redirect(`${PASSWORD_RESET_CONFIRM_ROUTE}?oobCode=${encodeURIComponent(oobCode)}`);
  }

  /*
   * Back to Google's hosted handler, with the query untouched.
   *
   * The whole query string is rebuilt rather than a few named parameters copied: `apiKey`, `lang`,
   * `continueUrl` and `tenantId` are all things that handler reads, and a forward that dropped one
   * would fail in a way that looks like a broken link rather than like a missing parameter. The
   * `authDomain` is where that page is served from and is the same value the web SDK already uses.
   *
   * `permanentRedirect` is deliberately **not** used: which modes this route handles is expected to
   * change — a branded "verifica tu correo" screen is the obvious next one — and a 308 cached in
   * somebody's browser would keep sending them to Firebase after we started handling it here.
   */
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) query.set(key, value[0]);
  }

  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  /*
   * With no `authDomain` there is nowhere to forward to, and inventing one would send a credential
   * to a host nobody chose. The reset screen says "this link does not work", which is the truth
   * from the person's side and leaves the code unused rather than spent somewhere unknown.
   */
  if (!authDomain) redirect(PASSWORD_RESET_CONFIRM_ROUTE);

  redirect(`https://${authDomain}/__/auth/action?${query.toString()}`);
}
