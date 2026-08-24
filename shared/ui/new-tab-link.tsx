import type { ReactNode } from "react";
import Link from "next/link";

/**
 * A link that opens in a new tab, because it leaves what the person is in the middle of.
 *
 * **The rule it encodes**: a link is a new tab when the page it leaves has state worth keeping and
 * the destination is a place you go to *check* something before coming back. Two families qualify
 * today:
 *
 * - the legal documents — clicked from a checkbox in a half-filled onboarding form, from a banner
 *   over something being read, from the footer under a search that took a minute to build;
 * - the shortcut out of the portal into the public catalogue, which is a different context
 *   altogether: somebody looking at their open processes who wants to browse listings is not done
 *   with the page they are on.
 *
 * It is **not** for ordinary navigation inside the product. `/soporte` from the footer, a property
 * from the catalogue, a process from the list — those are where you were going, and a new tab there
 * is clutter somebody has to close.
 *
 * A component rather than `target="_blank"` written fifteen times, because that is the attribute
 * that goes missing on the sixteenth — the same reason `shared/form/consent-checkbox.tsx` exists
 * for the ARIA wiring. It started life as `LegalLink` in `shared/legal/`, and moved here the moment
 * the second family appeared: a product shortcut importing from the legal module would have been
 * the wrong dependency for a rule that was never about legal documents.
 *
 * `rel="noopener noreferrer"`: modern browsers imply `noopener` for `target="_blank"`, and stating
 * it costs nothing on the day one of these points somewhere that is not our own origin.
 */
export function NewTabLink({
  href,
  className,
  children,
  ...rest
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
  /** `aria-label` and friends, for a link whose text is not its whole accessible name. */
  readonly "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "underline underline-offset-2"}
      {...rest}
    >
      {children}
    </Link>
  );
}
