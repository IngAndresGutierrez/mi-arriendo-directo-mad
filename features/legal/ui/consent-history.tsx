import { COOKIES_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { CONSENT_KINDS, CONSENT_KIND_LABELS } from "@/shared/legal/documents";

import { latestConsent, needsReconsent, type ConsentRecord } from "../domain/consent";

/** The date somebody reads, in Colombian time. Stored as an instant; shown as a day. */
function whenGranted(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

/**
 * What this person authorised, and when — **the derecho de acceso, as a screen**.
 *
 * Ley 1581 art. 8 gives the titular the right to know what is being processed and to be given
 * proof of the authorisation they granted. A policy that says "escríbenos y te contamos" satisfies
 * the letter of it; showing them, on the page they already have open, satisfies the point.
 *
 * It shows the version too, not just the date, because that is what makes the record
 * reconstructible: "aceptaste el 3 de marzo" says nothing about *what* was accepted if the document
 * has changed twice since.
 *
 * A Server Component: the data is read on the server and there is nothing here to hydrate.
 */
export function ConsentHistory({ consents }: { readonly consents: readonly ConsentRecord[] }) {
  const documentLinks: Readonly<Record<(typeof CONSENT_KINDS)[number], string>> = {
    terms: TERMS_ROUTE,
    privacy: PRIVACY_ROUTE,
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold tracking-tight text-primary dark:text-foreground">
        Lo que autorizaste
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar estas
        autorizaciones. Los plazos y el canal están en la{" "}
        <NewTabLink
          href={`${PRIVACY_ROUTE}#derechos`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          política de tratamiento de datos
        </NewTabLink>
        .
      </p>

      <ul role="list" className="mt-4 space-y-3">
        {CONSENT_KINDS.map((kind) => {
          const consent = latestConsent(consents, kind);
          const pending = needsReconsent(consents, kind);

          return (
            <li
              key={kind}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm first:border-t-0 first:pt-0"
            >
              <NewTabLink
                href={documentLinks[kind]}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {CONSENT_KIND_LABELS[kind]}
              </NewTabLink>

              <span className="text-muted-foreground">
                {consent && !pending
                  ? `Autorizado el ${whenGranted(consent.grantedAt)} · versión ${consent.version}`
                  : "Pendiente de autorizar"}
              </span>
            </li>
          );
        })}

        {/*
          The cookie decision is listed here but has no date and no version of its own, and the
          reason is worth stating where somebody would otherwise notice the gap: it belongs to a
          browser, not to a person. Recording it per uid would be a second source of truth that
          contradicts itself the moment they open the product somewhere else.
        */}
        <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
          <NewTabLink
            href={COOKIES_ROUTE}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Cookies
          </NewTabLink>
          <span className="text-muted-foreground">Se decide en cada navegador</span>
        </li>
      </ul>
    </section>
  );
}
