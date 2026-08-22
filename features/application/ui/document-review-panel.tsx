"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckIcon, ExternalLinkIcon, FileTextIcon, XIcon } from "lucide-react";

import {
  isPdf,
  statusOf,
  DOCUMENT_LABELS,
  REVIEW_STATUS_LABELS,
  type DocumentReviews,
  type ReviewStatus,
} from "@/features/tenant-profile/client";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import { reviewTenantDocument } from "../actions/review-document";

/** A document as this panel needs it: enough to show it and to judge it. */
export type ReviewableDocument = {
  readonly id: string;
  readonly kind: keyof typeof DOCUMENT_LABELS;
  readonly name: string;
  readonly contentType: string;
  readonly url: string;
};

const STATUS_STYLES: Readonly<Record<ReviewStatus, string>> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-status-approved-bg text-status-approved",
  rejected: "bg-destructive/10 text-destructive",
};

/**
 * What the tenant uploaded, for the landlord to open and judge one by one.
 *
 * Each document is a link that opens the file — clicking to *see* it is the whole job, and a
 * list of filenames is not a review. Approving or rejecting is recorded per document, so the
 * gate on continuing knows exactly what is still outstanding; a rejection asks for a reason,
 * because "rechazado" alone tells the tenant to upload something again without saying what was
 * wrong with it.
 */
export function DocumentReviewPanel({
  applicationId,
  documents,
  reviews,
}: {
  readonly applicationId: string;
  readonly documents: readonly ReviewableDocument[];
  readonly reviews: DocumentReviews;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  /*
   * Which row is being saved, not just that something is.
   *
   * `useTransition` gives one boolean for the whole panel, so judging one document froze the
   * buttons on all of them — reviewing five meant five waits with the whole list unusable, and
   * each wait long enough to look broken.
   */
  const [saving, setSaving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function judge(documentId: string, status: "approved" | "rejected", reason = "") {
    setSaving(documentId);
    start(async () => {
      try {
        const result = await reviewTenantDocument(applicationId, { documentId, status, note: reason });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setRejecting(null);
        setNote("");
        router.refresh();
      } finally {
        setSaving(null);
      }
    });
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        El inquilino todavía no ha subido nada. Aquí los verás a medida que lleguen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {documents.map((document) => {
          const status = statusOf(reviews, document.id);
          const review = reviews[document.id];

          return (
            <li
              key={document.id}
              className={cn(
                "rounded-xl border p-3",
                status === "approved" && "border-accent/40 bg-accent/5",
                status === "rejected" && "border-destructive/40 bg-destructive/5",
                status === "pending" && "border-border bg-card",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* The preview is the link: seeing the document is the review. */}
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="shrink-0 overflow-hidden rounded-lg border border-border">
                    {isPdf(document) ? (
                      <span className="flex size-14 items-center justify-center bg-muted text-muted-foreground">
                        <FileTextIcon className="size-5" aria-hidden="true" />
                      </span>
                    ) : (
                      <Image
                        src={document.url}
                        alt=""
                        width={112}
                        height={112}
                        unoptimized
                        className="size-14 object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {DOCUMENT_LABELS[document.kind]}
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {document.name}
                    </span>
                  </span>
                </a>

                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_STYLES[status],
                  )}
                >
                  {REVIEW_STATUS_LABELS[status]}
                </span>

                {/*
                  Only the action that changes the state. Offering "Aprobar" on something already
                  approved is offering to do nothing, and it makes the row read as undecided when
                  it is not — the verdict is the chip beside it, not the buttons.
                */}
                <span className="flex gap-1.5">
                  {status !== "approved" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={saving === document.id}
                      onClick={() => judge(document.id, "approved")}
                      aria-label={`Aprobar ${DOCUMENT_LABELS[document.kind]}`}
                    >
                      <CheckIcon aria-hidden="true" />
                      {status === "rejected" ? "Aprobar de todos modos" : "Aprobar"}
                    </Button>
                  ) : null}
                  {status !== "rejected" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      disabled={saving === document.id}
                      onClick={() => setRejecting(rejecting === document.id ? null : document.id)}
                      aria-label={`Rechazar ${DOCUMENT_LABELS[document.kind]}`}
                    >
                      <XIcon aria-hidden="true" />
                      {status === "approved" ? "Cambiar de opinión" : "Rechazar"}
                    </Button>
                  ) : null}
                </span>
              </div>

              {review?.status === "rejected" && review.note ? (
                <p className="mt-2 text-sm text-destructive">Motivo: {review.note}</p>
              ) : null}

              {rejecting === document.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <label
                    htmlFor={`note-${document.id}`}
                    className="text-sm font-medium text-foreground"
                  >
                    ¿Qué le falta a este documento?
                  </label>
                  <textarea
                    id={`note-${document.id}`}
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Por ejemplo: la foto está borrosa y no se lee el número."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      disabled={saving === document.id}
                      onClick={() => judge(document.id, "rejected", note)}
                    >
                      Rechazar documento
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      disabled={saving === document.id}
                      onClick={() => {
                        setRejecting(null);
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

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
