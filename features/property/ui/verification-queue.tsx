"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";

import { formatBogotaDateTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

import { decideVerification } from "../actions/verification";
import type { PendingVerification } from "../data/verification";

/**
 * The reviewer's queue: one row per property waiting, with its certificate and two verdicts.
 *
 * **A refusal needs a reason and an approval does not**, and the form says so rather than letting
 * somebody find out on submit: the landlord reads that sentence and acts on it, so "no se pudo" on
 * its own is a wall. Same rule as a rejected document in the process.
 */
export function VerificationQueue({
  rows,
  links,
}: {
  readonly rows: readonly PendingVerification[];
  /** Signed URLs keyed by storage path, produced by the page. A missing one could not be signed. */
  readonly links: Readonly<Record<string, string>>;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No hay solicitudes esperando revisión.
      </p>
    );
  }

  return (
    <ul className="mt-8 space-y-4">
      {rows.map((row) => (
        <Row key={row.propertyId} row={row} links={links} />
      ))}
    </ul>
  );
}

function Row({
  row,
  links,
}: {
  readonly row: PendingVerification;
  readonly links: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(approve: boolean) {
    setError(null);
    start(async () => {
      const result = await decideVerification(row.propertyId, { approve, note });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li data-slot="verification-row" className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">{row.propertyTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {row.propertyCity} · Matrícula {row.registryNumber || "sin número"} · Solicitado el{" "}
        {formatBogotaDateTime(row.submittedAt)}
      </p>

      {/*
        Los documentos, con enlaces firmados por una hora. Un certificado de tradición lleva la
        dirección completa y la identidad del dueño: es lo más sensible que guarda este producto
        sobre un inmueble, y un enlace permanente estaría a un reenvío de ser público.
      */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {row.documents.map((document) => (
          <li key={document.path}>
            {links[document.path] ? (
              <Button asChild variant="outline" size="lg">
                <a href={links[document.path]} target="_blank" rel="noreferrer noopener">
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  {document.fileName}
                </a>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {document.fileName} — no se pudo abrir ahora mismo
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Label htmlFor={`nota-${row.propertyId}`}>
          Motivo, si no se puede verificar
        </Label>
        <textarea
          id={`nota-${row.propertyId}`}
          rows={2}
          value={note}
          disabled={pending}
          placeholder="El certificado tiene cuatro meses de expedido."
          onChange={(event) => setNote(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Lo lee el propietario y es con lo que corrige. Obligatorio para rechazar.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {/*
          Aprobar es la acción de esta pantalla: es a lo que se viene. Rechazar no es su contrario en
          peso — es lo que se hace cuando no se puede hacer lo otro — así que va en `ghost` rojo,
          igual que "Eliminar" en la tarjeta de un inmueble.
        */}
        <Button variant="accent" size="xl" disabled={pending} onClick={() => decide(true)}>
          <CheckIcon aria-hidden="true" />
          {pending ? "Guardando…" : "Figura como propietario"}
        </Button>
        <Button
          variant="ghost"
          size="xl"
          disabled={pending}
          onClick={() => decide(false)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <XIcon aria-hidden="true" />
          No se pudo verificar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
