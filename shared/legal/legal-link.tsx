import type { ReactNode } from "react";
import Link from "next/link";

/**
 * A link to one of the legal documents. **Always opens in a new tab.**
 *
 * The reason is not convention, it is what these links sit next to: a checkbox in the middle of a
 * half-filled onboarding form, a banner over a page somebody is reading, a footer under a search
 * they spent a minute building. Navigating away from any of those loses it. The one thing a person
 * is doing when they click "Política de tratamiento" is *checking* something before going back to
 * what they were doing.
 *
 * It exists as a component rather than as `target="_blank"` written fourteen times because that is
 * exactly the attribute that goes missing on the fifteenth — the same reason
 * `shared/form/consent-checkbox.tsx` exists for the ARIA wiring.
 *
 * `rel="noopener noreferrer"`: modern browsers imply `noopener` for `target="_blank"`, and stating
 * it costs nothing on the day one of these points somewhere that is not our own origin.
 */
export function LegalLink({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "underline underline-offset-2"}
    >
      {children}
    </Link>
  );
}
