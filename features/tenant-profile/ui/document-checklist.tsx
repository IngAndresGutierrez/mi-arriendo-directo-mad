"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, FileTextIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";

import { ensureClientSession } from "@/shared/auth/client";
import { storage } from "@/shared/firebase/storage";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { cn } from "@/shared/lib/utils";

import {
  acceptable,
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
  type ReviewStatus,
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
  onChanged,
  readOnly = false,
}: {
  readonly occupation: Occupation;
  readonly documents: readonly ChecklistDocument[];
  /** What the landlord decided, so a rejection says what to fix instead of failing silently. */
  readonly reviews?: DocumentReviews;
  /**
   * Told after every upload or removal, so the other side's screen finds out.
   *
   * Passed in rather than imported: what has to be nudged is the application, and this module
   * has no business knowing that one exists. The page, which knows both, wires them together.
   */
  readonly onChanged?: () => Promise<void>;
  /**
   * `true` once the stage is behind us: the files stay visible, the actions go.
   *
   * A button that no longer changes anything is the same lie as a button that says it will
   * continue and does not — and uploading into a stage the process has left would be recording
   * something nobody asked for.
   */
  readonly readOnly?: boolean;
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
  /*
   * A rejected file does not count towards its line. Otherwise three payslips with one rejected
   * read as "Completo" with the upload disabled — and replacing it, the only thing left to do,
   * became the one thing impossible to do.
   */
  const counted = acceptable(documents, reviews);

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

        await onChanged?.().catch(() => undefined);
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
      {!identityDecided && !readOnly ? (
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
          const valid = counted.filter((document) => document.kind === requirement.kind);
          const rejected = mine.filter((document) => statusOf(reviews, document.id) === "rejected");
          const done = valid.length >= requirement.count;
          const room = requirement.count - valid.length;

          return (
            <li
              key={requirement.kind}
              className={cn(
                "rounded-xl border p-4",
                rejected.length > 0
                  ? "border-destructive bg-destructive/5"
                  : done
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-card",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {rejected.length > 0 ? (
                      <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    ) : done ? (
                      <CheckIcon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    ) : null}
                    {DOCUMENT_LABELS[requirement.kind]}
                    {requirement.count > 1 ? (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({valid.length} de {requirement.count})
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

                  {/*
                    Loud on purpose. A rejection is the only thing on this screen that needs
                    doing again, and the previous version said it in grey text under a thumbnail
                    — where it read as a caption rather than as a problem.
                  */}
                  {rejected.map((document) => (
                    <p
                      key={document.id}
                      className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        <strong className="font-semibold">Rechazado.</strong>{" "}
                        {reviews[document.id]?.note
                          ? reviews[document.id]!.note
                          : "El propietario no lo aceptó."}
                        {readOnly ? "" : " Súbelo otra vez."}
                      </span>
                    </p>
                  ))}
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
                {readOnly ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
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
                )}
              </div>

              {mine.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {mine.map((document) => (
                    <li key={document.id} className="w-32">
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "relative block overflow-hidden rounded-lg border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          statusOf(reviews, document.id) === "rejected"
                            ? "border-2 border-destructive opacity-60"
                            : "border-border",
                        )}
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
                        {/*
                          The verdict on the file itself. A word underneath a thumbnail is a
                          caption; a mark on the thing it is about is what people read.
                        */}
                        <Verdict status={statusOf(reviews, document.id)} />
                      </a>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={document.name}>
                        {document.name}
                      </p>
                      {/*
                        The landlord's verdict, beside the file it is about. A rejection with its
                        reason is the only thing that tells the tenant what to upload instead.
                      */}
                      {/* Beside the file, the verdict alone: the reason is spelled out above. */}
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
                        </p>
                      ) : null}
                      {readOnly ? null : (
                        <button
                          type="button"
                          onClick={() => setRemoving(document)}
                          className="text-xs text-destructive underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-destructive/40 focus-visible:outline-none"
                        >
                          Quitar
                        </button>
                      )}
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
          await onChanged?.().catch(() => undefined);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * A tick or a cross on the corner of the file, or nothing while nobody has looked.
 *
 * Shared by both screens so the same file cannot be marked one way for the tenant and another
 * for the landlord. `aria-hidden`: the state is already announced in words beside it, and a
 * screen reader reading "aprobado" twice per file is worse than not decorating it at all.
 */
export function Verdict({ status }: { readonly status: ReviewStatus }) {
  if (status === "pending") return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-white shadow-xs",
        status === "approved" ? "bg-status-approved" : "bg-destructive",
      )}
    >
      {status === "approved" ? (
        <CheckIcon className="size-4" strokeWidth={3} />
      ) : (
        <XIcon className="size-4" strokeWidth={3} />
      )}
    </span>
  );
}
