import { BadgeCheckIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * The badge, and the sentence that keeps it honest.
 *
 * **It claims exactly one thing**: a person read the certificado de tradición y libertad of this
 * property's matrícula and the account publishing it is named on it as owner. Nothing about the
 * state of the flat, nothing about the person, and no guarantee about the tenancy.
 *
 * A badge that says "Verificado" without saying *what* was verified means whatever the reader hopes
 * it means, and the day one of those tenancies goes wrong the product is answering for a promise it
 * never made out loud. It is the same discipline the landing follows by refusing "ahorra hasta un
 * 30%": every claim is something that actually happened.
 *
 * **On the detail page the sentence is visible, not behind a hover.** This product already wrote
 * that rule down for the disabled menu entry — "a hover-only explanation is a poor one" — and it
 * matters more here, because the sentence is the part that bounds the claim. On a card there is no
 * room for it, so the badge carries it as its accessible name and the card's job is to get somebody
 * to the page where it is spelled out.
 */

export const VERIFIED_CLAIM =
  "Revisamos el certificado de tradición y libertad de este inmueble y quien lo publica figura en " +
  "él como propietario.";

export const VERIFIED_LIMITS =
  "No revisamos el estado del inmueble ni respondemos por el arriendo: eso lo acuerdan las dos " +
  "partes.";

/** The compact form, for a catalogue card. The claim travels as the accessible name. */
export function VerifiedBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-status-approved-bg px-2 py-0.5 text-xs font-medium text-status-approved",
        className,
      )}
    >
      <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
      Propietario verificado
      {/*
        La afirmación completa, para quien no ve el color ni tiene sitio donde leerla: una insignia
        cuyo alcance solo se entiende en otra pantalla es, para un lector de pantalla, una palabra
        suelta.
      */}
      <span className="sr-only"> — {VERIFIED_CLAIM}</span>
    </span>
  );
}

/** The full form, for the listing's own page: the badge with what it does and does not mean. */
export function VerifiedNotice() {
  return (
    <div className="rounded-2xl border border-status-approved-bg bg-status-approved-bg/40 p-4">
      <p className="flex items-center gap-2 font-medium text-status-approved">
        <BadgeCheckIcon className="size-5 shrink-0" aria-hidden="true" />
        Propietario verificado
      </p>
      <p className="mt-2 text-sm text-foreground">{VERIFIED_CLAIM}</p>
      <p className="mt-1 text-sm text-muted-foreground">{VERIFIED_LIMITS}</p>
    </div>
  );
}
