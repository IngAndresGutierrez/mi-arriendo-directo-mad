import { dictionary } from "@/shared/i18n/server";
import { HeadsetIcon } from "lucide-react";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";

import { SUPPORT_ROUTE } from "@/shared/auth/routes";
import { SUPPORT_EMAIL, supportWhatsAppDisplay } from "@/shared/lib/support-contact";

import { SupportActions } from "./support-actions";

/**
 * Support card on the home screen: the two ways to reach a person, without a detour.
 *
 * Deliberately **without a photo of a person**: presenting a stock image as "our team" would
 * invent someone who does not exist. A neutral avatar says the same thing without claiming
 * something false.
 *
 * The buttons come from `SupportActions`, the same block `/soporte` renders, so the two
 * surfaces cannot drift. The number and the address are printed underneath as plain text
 * because a channel you can only reach by clicking is a channel you cannot write down.
 */
export async function SupportCard({ firstName }: { firstName: string }) {
  /* A Server Component, so it reads the language itself and hands the client buttons a slice. */
  const copy = (await dictionary()).support;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      aria-labelledby="support-heading"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <HeadsetIcon className="size-5" />
        </span>
        <div>
          <h2 id="support-heading" className="font-semibold text-foreground">
            {copy.team}
          </h2>
          <p className="text-sm text-muted-foreground">miarriendoDIRECTO</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {copy.greetingBefore}
        {firstName ? ` ${firstName}` : ""}
        {copy.greetingAfter}
      </p>

      <SupportActions className="mt-4" copy={copy} />

      <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <dt>{copy.whatsappLabel}</dt>
          <dd>{supportWhatsAppDisplay()}</dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <dt>{copy.emailLabel}</dt>
          {/* `break-all`: the address is longer than the 22rem column on a narrow screen. */}
          <dd className="break-all">{SUPPORT_EMAIL}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        <Link
          href={SUPPORT_ROUTE}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-foreground"
        >
          {copy.seeSupportPage}
        </Link>
      </p>
    </section>
  );
}
