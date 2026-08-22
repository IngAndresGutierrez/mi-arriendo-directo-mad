"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

import { authorizeBackgroundChecks } from "../actions/authorize-checks";

/**
 * The official sources, for the landlord to consult by hand.
 *
 * They are listed rather than queried because none of them can be queried from here: SIMIT, the
 * RUNT and the Policía have no open API, and the commercial providers that do reach them need a
 * contract. Linking them is honest work — it saves the landlord looking them up — and pretending
 * to have run the search would not be.
 */
const SOURCES: readonly { readonly name: string; readonly what: string; readonly url: string }[] = [
  { name: "SIMIT", what: "Multas y comparendos de tránsito", url: "https://www.fcm.org.co/simit/" },
  { name: "Policía Nacional", what: "Antecedentes judiciales", url: "https://antecedentes.policia.gov.co/" },
  { name: "Procuraduría", what: "Antecedentes disciplinarios", url: "https://www.procuraduria.gov.co/CertWEB/Certificado.aspx" },
  { name: "Contraloría", what: "Responsabilidad fiscal", url: "https://www.contraloria.gov.co/web/guest/atencion-al-ciudadano/tramites-servicios/certificado-de-antecedentes-fiscales" },
];

/**
 * The stage where records are checked: whether it may happen, and where.
 *
 * The tenant gives the authorisation; the landlord does the searching and records what they
 * found by moving the process on. Nothing here claims a search was run — this product cannot
 * run one yet, and saying so out loud is the difference between a stage that is not built and a
 * stage that lies.
 */
export function BackgroundCheckPanel({
  applicationId,
  authorizedAt,
  isLandlord,
  documentNumber,
}: {
  readonly applicationId: string;
  readonly authorizedAt: string | null;
  readonly isLandlord: boolean;
  /** The number the searches are run against, shown only to the landlord doing them. */
  readonly documentNumber: string;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const authorized = authorizedAt !== null;
  const when = authorized
    ? new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Bogota",
      }).format(new Date(authorizedAt))
    : null;

  return (
    // No frame and no heading of its own: the accordion around it already provides both.
    <div className="space-y-4">
      {authorized ? (
        <p className="rounded-xl bg-status-approved-bg px-4 py-3 text-sm text-status-approved">
          Autorización otorgada el {when}.
        </p>
      ) : isLandlord ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Todavía no tienes autorización del inquilino para consultar sus antecedentes. Sin ella no
          puedes hacerlo: se la pediremos en esta misma pantalla.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para seguir, el propietario necesita tu permiso para consultar tus antecedentes
            judiciales, tus multas de tránsito y tus sanciones disciplinarias. Son consultas a
            fuentes públicas y queda registrado el día en que lo autorizaste.
          </p>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="authorize-checks"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              disabled={pending}
              className="mt-0.5"
            />
            <Label htmlFor="authorize-checks" className="block text-sm leading-relaxed font-normal">
              Autorizo a {""}
              <strong className="font-medium text-foreground">el propietario de este inmueble</strong>{" "}
              a consultar mis antecedentes judiciales, de tránsito y disciplinarios para este
              proceso de arriendo.
            </Label>
          </div>
          <Button
            type="button"
            variant="accent"
            size="lg"
            disabled={!accepted || pending}
            onClick={() =>
              start(async () => {
                const result = await authorizeBackgroundChecks(applicationId);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                router.refresh();
              })
            }
          >
            {pending ? "Autorizando…" : "Autorizar la consulta"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {isLandlord ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {authorized ? (
              <>
                Consulta con la cédula{" "}
                <strong className="font-medium text-foreground">{documentNumber}</strong>. Por ahora
                las consultas se hacen en los portales oficiales; cuando termines, continúa el
                proceso.
              </>
            ) : (
              "Cuando tengas la autorización, estos son los portales donde se consulta."
            )}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SOURCES.map((source) => (
              <li key={source.name}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{source.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{source.what}</span>
                  </span>
                  <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
