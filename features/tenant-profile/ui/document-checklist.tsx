"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckIcon, FileTextIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { ensureClientSession } from "@/shared/auth/client";
import { storage } from "@/shared/firebase/storage";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { cn } from "@/shared/lib/utils";

import {
  identityShape,
  isPdf,
  requiredDocuments,
  statusOf,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_HINTS,
  DOCUMENT_LABELS,
  DOCUMENT_MAX_BYTES,
  REVIEW_STATUS_LABELS,
  type DocumentKind,
  type DocumentReviews,
} from "../domain/documents";
import type { Occupation } from "../domain/tenant-profile";
import { deleteTenantDocument, recordTenantDocument } from "../actions/documents";

/** A document already there, with a link that opens it. Signed by the server, valid for an hour. */
export type ChecklistDocument = {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly name: string;
  readonly contentType: string;
  readonly url: string;
};

/**
 * The paperwork, one line per document, with what is already in and what is not.
 *
 * The list is built from the occupation the tenant declared, so nobody is shown a line they
 * cannot fill. Files go from the browser straight to Cloud Storage — the same route the listing
 * photos take — and a Server Action records what landed, re-checking the type, the size and that
 * the path is inside this person's own folder.
 *
 * Every upload gets a preview: an image as a thumbnail, a PDF as a named link. Uploading a
 * document you cannot see is uploading a document you cannot check, and the commonest problem
 * with a photographed cédula is that it came out unreadable.
 */
export function DocumentChecklist({
  occupation,
  documents,
  reviews = {},
}: {
  readonly occupation: Occupation;
  readonly documents: readonly ChecklistDocument[];
  /** What the landlord decided, so a rejection says what to fix instead of failing silently. */
  readonly reviews?: DocumentReviews;
}) {
  const router = useRouter();
  const [busy, startUpload] = useTransition();
  /*
   * Which line is uploading, not just *that* something is.
   *
   * `useTransition` gives one boolean for the whole component, so the first version disabled
   * every button and said nothing anywhere: three payslips went up over several seconds with no
   * sign that anything was happening, which reads as a page that ignored the click. The spinner
   * belongs on the row the file is going into.
   */
  const [uploading, setUploading] = useState<{ readonly kind: DocumentKind; readonly total: number; readonly done: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ChecklistDocument | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  /*
   * How the person happens to hold their identity document. It starts from what is already
   * uploaded — someone coming back to a half-finished checklist should find it as they left it —
   * and the checkbox only matters while nothing has been uploaded yet, which is exactly when the
   * question can still be answered either way.
   */
  const shape = identityShape(documents);
  const [singleFileId, setSingleFileId] = useState(shape === "one_file");
  const identityDecided = shape !== null;

  function upload(kind: DocumentKind, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];
    setError(null);

    const rejected = files.find(
      (file) =>
        !(DOCUMENT_CONTENT_TYPES as readonly string[]).includes(file.type) ||
        file.size > DOCUMENT_MAX_BYTES,
    );
    if (rejected) {
      setError("Solo PDF, JPG, PNG o WEBP, y hasta 8 MB por archivo.");
      return;
    }

    setUploading({ kind, total: files.length, done: 0 });

    startUpload(async () => {
      try {
        // The upload needs the web SDK's session, which can lag a page load: see
        // `ensureClientSession`.
        const user = await ensureClientSession();
        if (!user) {
          setError("Tu sesión expiró. Vuelve a iniciar sesión para subir tus documentos.");
          return;
        }

        const { ref, uploadBytes } = await import("firebase/storage");

        for (const [index, file] of files.entries()) {
          setUploading({ kind, total: files.length, done: index });
          const safeName = file.name.replace(/[^\w.-]/g, "");
          const path = `applicants/${user.uid}/${crypto.randomUUID()}-${safeName}`;
          await uploadBytes(ref(storage, path), file, { contentType: file.type });

          const result = await recordTenantDocument({
            kind,
            path,
            name: file.name.slice(0, 200),
            contentType: file.type,
            size: file.size,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
        }

        router.refresh();
      } catch {
        setError("No pudimos subir el archivo. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setUploading(null);
        const input = inputs.current[kind];
        if (input) input.value = "";
      }
    });
  }

  return (
    <div className="space-y-5">
      {/*
        No heading here: the accordion that wraps this already says what it is and how far along
        it is. Two of them was what the page ended up rendering, one from each side.
      */}
      {!identityDecided ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4">
          <Checkbox
            id="single-file-id"
            checked={singleFileId}
            onCheckedChange={(checked) => setSingleFileId(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="single-file-id" className="block text-sm leading-relaxed font-normal">
            Tengo mi cédula en un solo archivo, con las dos caras
            <span className="mt-0.5 block text-muted-foreground">
              Marca esto si la escaneaste completa. Si le tomaste dos fotos, déjalo sin marcar y
              súbelas por separado.
            </span>
          </Label>
        </div>
      ) : null}

      <ul className="space-y-3">
        {requiredDocuments(occupation, singleFileId).map((requirement) => {
          const mine = documents.filter((document) => document.kind === requirement.kind);
          const done = mine.length >= requirement.count;
          const room = requirement.count - mine.length;

          return (
            <li
              key={requirement.kind}
              className={cn(
                "rounded-xl border p-4",
                done ? "border-accent/40 bg-accent/5" : "border-border bg-card",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {done ? (
                      <CheckIcon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    ) : null}
                    {DOCUMENT_LABELS[requirement.kind]}
                    {requirement.count > 1 ? (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({mine.length} de {requirement.count})
                      </span>
                    ) : null}
                    {requirement.optional ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
                        Si aplica
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {DOCUMENT_HINTS[requirement.kind]}
                  </p>
                </div>

                <input
                  ref={(element) => {
                    inputs.current[requirement.kind] = element;
                  }}
                  id={`upload-${requirement.kind}`}
                  type="file"
                  accept={DOCUMENT_CONTENT_TYPES.join(",")}
                  multiple={requirement.count > 1}
                  className="sr-only"
                  onChange={(event) => upload(requirement.kind, event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={busy || room <= 0}
                  onClick={() => inputs.current[requirement.kind]?.click()}
                >
                  {uploading?.kind === requirement.kind ? (
                    <>
                      <Loader2Icon className="animate-spin" aria-hidden="true" />
                      {/* With several files, which one: "subiendo 2 de 3" is a progress bar in words. */}
                      {uploading.total > 1
                        ? `Subiendo ${uploading.done + 1} de ${uploading.total}…`
                        : "Subiendo…"}
                    </>
                  ) : (
                    <>
                      <UploadIcon aria-hidden="true" />
                      {mine.length === 0 ? "Subir" : room > 0 ? "Subir otro" : "Completo"}
                    </>
                  )}
                </Button>
              </div>

              {mine.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {mine.map((document) => (
                    <li key={document.id} className="w-32">
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {isPdf(document) ? (
                          <span className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1 bg-muted text-xs text-muted-foreground">
                            <FileTextIcon className="size-6" aria-hidden="true" />
                            PDF
                          </span>
                        ) : (
                          <Image
                            src={document.url}
                            alt={`Previsualización de ${DOCUMENT_LABELS[document.kind]}`}
                            width={200}
                            height={150}
                            unoptimized
                            className="aspect-4/3 w-full object-cover"
                          />
                        )}
                      </a>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={document.name}>
                        {document.name}
                      </p>
                      {/*
                        The landlord's verdict, beside the file it is about. A rejection with its
                        reason is the only thing that tells the tenant what to upload instead.
                      */}
                      {statusOf(reviews, document.id) !== "pending" ? (
                        <p
                          className={cn(
                            "text-xs font-medium",
                            statusOf(reviews, document.id) === "approved"
                              ? "text-status-approved"
                              : "text-destructive",
                          )}
                        >
                          {REVIEW_STATUS_LABELS[statusOf(reviews, document.id)]}
                          {reviews[document.id]?.note ? `: ${reviews[document.id]!.note}` : ""}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setRemoving(document)}
                        className="text-xs text-destructive underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-destructive/40 focus-visible:outline-none"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/*
        Said out loud as well as shown: a spinner inside a button is invisible to a screen reader,
        and this is the part of the process that takes the longest.
      */}
      <p className="sr-only" aria-live="polite">
        {uploading
          ? `Subiendo ${DOCUMENT_LABELS[uploading.kind]}${uploading.total > 1 ? `, archivo ${uploading.done + 1} de ${uploading.total}` : ""}.`
          : ""}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title="¿Quitar este documento?"
        description={
          <>
            Se elimina <strong className="text-foreground">{removing?.name}</strong> y tendrás que
            subirlo otra vez. No se puede deshacer.
          </>
        }
        confirmLabel="Quitar documento"
        pendingLabel="Quitando…"
        onConfirm={async () => {
          if (!removing) return;
          const result = await deleteTenantDocument(removing.id);
          if (!result.ok) setError(result.message);
          setRemoving(null);
          router.refresh();
        }}
      />
    </div>
  );
}
