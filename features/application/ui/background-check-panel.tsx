"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

import { authorizeBackgroundChecks } from "../actions/authorize-checks";
import { recordBackgroundCheck } from "../actions/record-check";
import {
  checkStatusOf,
  CHECK_SOURCES,
  CHECK_STATUS_LABELS,
  type CheckResults,
  type CheckSourceId,
  type CheckStatus,
} from "../domain/background-check";

const STATUS_STYLES: Readonly<Record<CheckStatus, string>> = {
  pending: "bg-muted text-muted-foreground",
  clean: "bg-status-approved-bg text-status-approved",
  findings: "bg-destructive/10 text-destructive",
};

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
  results,
  readOnly = false,
}: {
  readonly applicationId: string;
  readonly authorizedAt: string | null;
  readonly isLandlord: boolean;
  /** The number the searches are run against, shown only to the landlord doing them. */
  readonly documentNumber: string;
  /** What each search turned up so far. */
  readonly results: CheckResults;
  /** `true` once the stage is behind us: the results stay, the controls go. */
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Which source's note is being written, and what it says. */
  const [writing, setWriting] = useState<CheckSourceId | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<CheckSourceId | null>(null);

  function record(source: CheckSourceId, status: "clean" | "findings", reason = "") {
    setSaving(source);
    start(async () => {
      try {
        const result = await recordBackgroundCheck(applicationId, { source, status, note: reason });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setWriting(null);
        setNote("");
        router.refresh();
      } finally {
        setSaving(null);
      }
    });
  }

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
      ) : isLandlord || readOnly ? (
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

      {/*
        Every one of these is consulted by hand — none of them has an open API — so the product
        does the honest half: it says what to check, links straight to it, and keeps what was
        found. The tenant reads the same list, which is the point of writing it down at all.
      */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {isLandlord ? (
            authorized ? (
              <>
                Consulta cada una con la cédula{" "}
                <strong className="font-medium text-foreground">{documentNumber}</strong> y anota
                qué encontraste.
              </>
            ) : (
              "Cuando tengas la autorización, estas son las consultas que hay que hacer."
            )
          ) : (
            "Estas son las consultas que hace el propietario, y lo que ha encontrado."
          )}
        </p>

        <ul className="space-y-2">
          {CHECK_SOURCES.map((source) => {
            const status = checkStatusOf(results, source.id);
            const result = results[source.id];

            return (
              <li
                key={source.id}
                className={cn(
                  "rounded-xl border p-3",
                  status === "clean" && "border-accent/40 bg-accent/5",
                  status === "findings" && "border-destructive/40 bg-destructive/5",
                  status === "pending" && "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        {source.name}
                        <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {source.what}
                      </span>
                    </span>
                  </a>

                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_STYLES[status],
                    )}
                  >
                    {status === "clean" ? (
                      <CheckIcon className="size-3" aria-hidden="true" />
                    ) : status === "findings" ? (
                      <AlertTriangleIcon className="size-3" aria-hidden="true" />
                    ) : null}
                    {CHECK_STATUS_LABELS[status]}
                  </span>

                  {isLandlord && authorized && !readOnly ? (
                    <span className="flex gap-1.5">
                      {status !== "clean" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          disabled={saving === source.id}
                          onClick={() => record(source.id, "clean")}
                          aria-label={`Marcar ${source.name} sin hallazgos`}
                        >
                          Sin hallazgos
                        </Button>
                      ) : null}
                      {status !== "findings" ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="lg"
                          disabled={saving === source.id}
                          onClick={() => setWriting(writing === source.id ? null : source.id)}
                          aria-label={`Anotar un hallazgo en ${source.name}`}
                        >
                          Con hallazgos
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {/* What was found, in the landlord's own words. The tenant reads this. */}
                {result?.note ? (
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      status === "findings" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {result.note}
                  </p>
                ) : null}

                {writing === source.id && !readOnly ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <label htmlFor={`note-${source.id}`} className="text-sm font-medium text-foreground">
                      ¿Qué encontraste?
                    </label>
                    <textarea
                      id={`note-${source.id}`}
                      rows={2}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Por ejemplo: dos comparendos sin pagar de 2024."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="lg"
                        disabled={saving === source.id}
                        onClick={() => record(source.id, "findings", note)}
                      >
                        Guardar el hallazgo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        disabled={saving === source.id}
                        onClick={() => {
                          setWriting(null);
                          setNote("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

    </div>
  );
}
