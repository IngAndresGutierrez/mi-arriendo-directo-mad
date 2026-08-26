import type { Dictionary } from "@/shared/i18n";
import { MailIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { WhatsAppIcon } from "@/shared/ui/whatsapp-icon";
import { supportEmailUrl, supportWhatsAppUrl } from "@/shared/lib/support-contact";
import { cn } from "@/shared/lib/utils";

import { CopyEmailButton } from "./copy-email-button";

/**
 * The two ways to reach support, as buttons — one definition, used by the card on the home
 * screen and by `/soporte`. Two copies of a contact button is two places to forget when the
 * number changes.
 */
export function WhatsAppSupportButton({
  className,
  copy,
}: {
  readonly className?: string;
  /** Its words, resolved by the server parent: this is a Client Component. */
  readonly copy: Dictionary["support"];
}) {
  return (
    <Button asChild variant="accent" size="xl" className={cn("w-full", className)}>
      <a href={supportWhatsAppUrl()} target="_blank" rel="noreferrer">
        <WhatsAppIcon className="size-4" />
        {copy.writeOnWhatsApp}
        <span className="sr-only"> {copy.opensInNewTab}</span>
      </a>
    </Button>
  );
}

/**
 * The email action, which is not the same action on every device.
 *
 * On a phone `mailto:` opens the mail app, which is exactly what is wanted. On a desktop it
 * only opens something if the operating system has a mail client registered — and someone who
 * reads their mail on gmail.com has not registered one, so the button does nothing and looks
 * broken. So the choice is made by the **pointer**, not by the width: `pointer: coarse` is a
 * finger and `pointer: fine` is a mouse, which is the actual question here. A phone held in
 * landscape is still a phone, and a width breakpoint would get it wrong.
 *
 * Both are rendered and one is hidden with CSS rather than picked in JavaScript: the media
 * query is answered before hydration, so nothing flashes and nothing has to guess on the
 * server. `display: none` also takes the hidden one out of the accessibility tree, so a screen
 * reader is offered exactly one email action.
 */
export function EmailSupportButton({
  className,
  copy,
}: {
  readonly className?: string;
  /** Its words, resolved by the server parent: this is a Client Component. */
  readonly copy: Dictionary["support"];
}) {
  return (
    <>
      <Button
        asChild
        variant="outline"
        size="xl"
        className={cn("w-full pointer-fine:hidden", className)}
      >
        <a href={supportEmailUrl()}>
          <MailIcon className="size-4" />
          {copy.sendEmail}
        </a>
      </Button>

      <CopyEmailButton className={cn("hidden pointer-fine:flex", className)} copy={copy} />
    </>
  );
}

/** Both, stacked. WhatsApp first: it is the one that answers in minutes. */
export function SupportActions({
  className,
  copy,
}: {
  readonly className?: string;
  /** Its words, resolved by the server parent: this is a Client Component. */
  readonly copy: Dictionary["support"];
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <WhatsAppSupportButton copy={copy} />
      <EmailSupportButton copy={copy} />
    </div>
  );
}
