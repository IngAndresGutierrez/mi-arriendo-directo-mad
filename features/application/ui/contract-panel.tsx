"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  UploadIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatBytes } from "@/shared/format/bytes";

import { uploadSignedContract } from "../actions/contract";
import {
  contractFileProblem,
  contractState,
  CONTRACT_CONTENT_TYPES,
  CONTRACT_EXTERNAL_NOTE,
  CONTRACT_PROVIDER,
  CONTRACT_STEPS,
} from "../domain/contract";
import type { SignedContract } from "../domain/contract";

/**
 * The signature stage.
 *
 * The contract is signed on the landlord's **own** ZapSign account — the free tier signs five
 * documents a month, which is what a landlord with a few properties needs — and the signed PDF
 * comes back here. This product does not sign anything, does not hold their credentials and does
 * not count their documents: what it does is say what to do there and keep what came out.
 *
 * The tenant sees the same document. It is the agreement that binds them, and a lease the tenant
 * can only find in their own inbox is a lease they will eventually not find.
 */
export function ContractPanel({
  applicationId,
  contract,
  isLandlord,
  readOnly = false,
}: {
  readonly applicationId: string;
  /** With a link signed for the next hour, or `null` while nothing is uploaded. */
  readonly contract: (SignedContract & { readonly url: string }) | null;
  readonly isLandlord: boolean;
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const state = contractState(contract);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    /*
     * Checked here before spending the upload, and checked again in the action: the same pure
     * function both times, so the sentence the landlord reads is the sentence the server would
     * have said.
     */
    const problem = contractFileProblem({ type: file.type, size: file.size });
    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    const body = new FormData();
    body.set("contract", file);
    body.set("note", note);

    startTransition(async () => {
      const result = await uploadSignedContract(applicationId, body);
      if (inputRef.current) inputRef.current.value = "";

      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              state === "signed"
                ? "inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-0.5 text-xs font-medium text-status-approved"
                : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {state === "signed" && <CheckIcon className="size-3" aria-hidden="true" />}
            Firma digital · {CONTRACT_PROVIDER.name}
          </span>
          <span className="text-xs font-medium text-foreground">
            Plan gratuito: {CONTRACT_PROVIDER.freeMonthlyDocuments} documentos al mes
          </span>
        </div>

        {contract ? (
          <div className="mt-3 space-y-2">
            {/*
              El enlace está firmado y dura una hora: `contracts/**` está cerrado a los clientes
              en `storage.rules`, así que esta es la única forma de leerlo. Un contrato es el
              documento más privado del proceso y una URL permanente está a un reenvío de ser
              pública.
            */}
            <a
              className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
              href={contract.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileTextIcon className="size-4 shrink-0 text-status-approved" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{contract.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(contract.bytes)}
              </span>
              <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
            </a>
            {contract.note && (
              <p className="text-sm text-muted-foreground">{contract.note}</p>
            )}
            <p className="text-xs text-muted-foreground">
              El enlace se renueva cada vez que abres esta página.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLandlord
              ? `Fírmalo en ${CONTRACT_PROVIDER.name} con el inquilino y súbelo aquí. Hasta que el contrato firmado esté, el proceso no avanza.`
              : `El propietario firmará el contrato en ${CONTRACT_PROVIDER.name} y lo subirá aquí. Vas a recibir la invitación a firmar en tu correo.`}
          </p>
        )}
      </div>

      {isLandlord && !readOnly && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">Cómo se firma</p>
            {/*
              Se dice antes de los pasos, no después: "es fuera de aquí" y "es gratis" son las dos
              cosas que alguien quiere saber antes de leer un procedimiento de cuatro puntos.
            */}
            <p className="rounded-lg border border-brand-panel/25 bg-brand-panel/[0.04] px-3 py-2 text-sm text-brand-panel dark:border-brand-panel-muted/30 dark:bg-brand-panel-muted/10 dark:text-brand-panel-muted">
              {CONTRACT_EXTERNAL_NOTE}
            </p>
            <ol className="space-y-1.5">
              {CONTRACT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0 font-medium text-brand-panel dark:text-brand-panel-muted">
                    {index + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Button asChild variant="accent" size="xl">
              <a href={CONTRACT_PROVIDER.url} target="_blank" rel="noopener noreferrer">
                Subir el contrato a {CONTRACT_PROVIDER.name}
                <ExternalLinkIcon aria-hidden="true" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract-note">Nota sobre el contrato (opcional)</Label>
            <Input
              id="contract-note"
              className="h-11"
              placeholder="Firmado el 20 de septiembre, con anexo de inventario."
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract-file">
              {state === "signed" ? "Reemplazar el contrato firmado" : "Contrato firmado"}
            </Label>
            {/*
              El archivo sube por una Server Action, no del navegador al bucket: la regla que hay
              que cumplir es "el propietario *de esta* postulación, en *esta* etapa", y eso las
              Security Rules no lo pueden preguntar sin leer la postulación.
            */}
            <Input
              ref={inputRef}
              id="contract-file"
              type="file"
              className="h-11 py-2"
              accept={CONTRACT_CONTENT_TYPES.join(",")}
              disabled={pending}
              onChange={(event) => onPick(event.target.files)}
            />
            <p className="text-sm text-muted-foreground">
              PDF o foto, hasta 8 MB. Lo verán las dos partes.
            </p>
            {pending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <UploadIcon className="size-4 animate-pulse" aria-hidden="true" />
                Subiendo el contrato…
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
