"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheckIcon, FileUpIcon, XIcon } from "lucide-react";

import { ensureClientSession } from "@/shared/auth/client";
import { storage } from "@/shared/firebase/storage";
import { storageErrorMessage } from "@/shared/firebase/storage-errors";
import { formatBytes } from "@/shared/format/bytes";
import { formatBogotaDateTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import { requestVerification } from "../actions/verification";
import {
  CERTIFICATE_MAX_AGE_DAYS,
  MAX_VERIFICATION_DOCUMENTS,
  VERIFICATION_STATE_LABELS,
  verificationDocumentProblem,
  verificationFolder,
  type PropertyVerification,
  type VerificationState,
} from "../domain/verification";

/**
 * Where a landlord asks to have their ownership checked, and reads what came back.
 *
 * **The refusal's reason is the point of this panel.** "El certificado tiene cuatro meses" and "el
 * certificado nombra a otra persona" are two completely different things to do next, and a refusal
 * that only said "no se pudo" would be a wall. It is the same rule a rejected document in the
 * process already follows.
 */
const STATE_STYLES: Readonly<Record<VerificationState, string>> = {
  none: "bg-muted text-muted-foreground",
  in_review: "bg-status-pending-bg text-status-pending",
  verified: "bg-status-approved-bg text-status-approved",
  rejected: "bg-status-rejected-bg text-status-rejected",
  stale: "bg-status-pending-bg text-status-pending",
};

export function VerificationPanel({
  propertyId,
  state,
  verification,
  blocker,
}: {
  readonly propertyId: string;
  readonly state: VerificationState;
  readonly verification: PropertyVerification | null;
  /**
   * Why it cannot be asked for right now, decided by the page from `verificationBlocker`.
   *
   * Passed in rather than recomputed here: the Server Action asks the same function before it
   * writes, and a third copy of "when may this be requested?" would be the one that drifts.
   */
  readonly blocker: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<readonly File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAsk = blocker === null;

  return (
    <section
      aria-labelledby="verificacion-heading"
      className="mt-8 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="verificacion-heading"
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <BadgeCheckIcon className="size-4 text-brand-panel" aria-hidden="true" />
            Propietario verificado
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Revisamos tu certificado de tradición y libertad y, si figuras en él como propietario,
            tu anuncio lleva una insignia que lo dice. Es lo que responde al miedo con el que la
            gente no arrienda directo.
          </p>
        </div>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATE_STYLES[state])}>
          {VERIFICATION_STATE_LABELS[state]}
        </span>
      </div>

      {/*
        El motivo del rechazo, en la pantalla y no en un correo: es lo único con lo que se decide qué
        hacer después. Se muestra también cuando ya se volvió a solicitar, porque sigue siendo el
        contexto de lo que se está corrigiendo.
      */}
      {state === "rejected" && verification?.note ? (
        <p className="mt-4 rounded-xl bg-status-rejected-bg p-4 text-sm text-status-rejected">
          <span className="font-medium">No se pudo verificar:</span> {verification.note}
        </p>
      ) : null}

      {state === "stale" ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Cambiaste la matrícula inmobiliaria después de que verificáramos este inmueble, así que la
          insignia dejó de aplicar: hablaba del inmueble detrás del número anterior. Vuelve a
          solicitarla con el certificado del nuevo.
        </p>
      ) : null}

      {state === "verified" && verification?.verifiedAt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Verificado el {formatBogotaDateTime(verification.verifiedAt)}.
        </p>
      ) : null}

      {state === "in_review" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Recibimos tu solicitud y la estamos revisando. Te avisamos aquí mismo.
        </p>
      ) : null}

      {canAsk ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-foreground">
            Adjunta el <span className="font-medium">certificado de tradición y libertad</span> de
            este inmueble. Sirve uno expedido en los últimos {CERTIFICATE_MAX_AGE_DAYS} días: es lo
            que hace que el documento diga cómo está el registro <em>hoy</em>.
          </p>

          {picked.length > 0 ? (
            <ul className="space-y-2">
              {picked.map((file) => (
                <li
                  key={file.name + file.size}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {file.name}
                    <span className="text-muted-foreground"> · {formatBytes(file.size)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Quitar ${file.name}`}
                    onClick={() => setPicked((all) => all.filter((one) => one !== file))}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            data-slot="verification-documents"
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])];
              event.target.value = "";
              if (chosen.length === 0) return;

              if (picked.length + chosen.length > MAX_VERIFICATION_DOCUMENTS) {
                setError(`Hasta ${MAX_VERIFICATION_DOCUMENTS} archivos.`);
                return;
              }
              /* El mismo juicio que hace el servidor: el picker y la acción comparten la función. */
              const problem = chosen.map((file) => verificationDocumentProblem(file)).find(Boolean);
              if (problem) {
                setError(problem);
                return;
              }
              setError(null);
              setPicked((all) => [...all, ...chosen]);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="xl"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <FileUpIcon aria-hidden="true" />
              Adjuntar el certificado
            </Button>
            <Button
              variant="brand"
              size="xl"
              disabled={pending || picked.length === 0}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const documents = await upload(picked);
                    const result = await requestVerification(propertyId, { documents });
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setPicked([]);
                    router.refresh();
                  } catch (thrown) {
                    setError(
                      thrown instanceof Error && thrown.message === "no-session"
                        ? "Tu sesión expiró. Vuelve a iniciar sesión para adjuntar los archivos."
                        : storageErrorMessage(thrown),
                    );
                  }
                })
              }
            >
              {pending ? "Enviando…" : "Solicitar la verificación"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            El certificado lleva la dirección completa y tu identidad. Solo lo ve quien revisa, y
            nunca sale en el anuncio.
          </p>
        </div>
      ) : (
        blocker !== "already_verified" && (
          <p className="mt-5 text-sm text-muted-foreground">{blocker}</p>
        )
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Straight to Cloud Storage, one at a time.
 *
 * Not `usePickedFiles`: that hook lives in `features/lease` and belongs to it, previews `blob:`
 * URLs for images and holds a per-file preview this panel has no use for — a certificate is a PDF
 * and what matters is its name. Reaching across a module boundary for a hook whose behaviour is
 * three-quarters wrong here would be worse than these fifteen lines.
 */
async function upload(files: readonly File[]) {
  const user = await ensureClientSession();
  if (!user) throw new Error("no-session");

  const { ref, uploadBytes } = await import("firebase/storage");
  const uploaded = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.-]/g, "-").slice(-80) || "documento";
    const path = `${verificationFolder(user.uid)}${crypto.randomUUID()}-${safeName}`;
    await uploadBytes(ref(storage, path), file, { contentType: file.type });

    uploaded.push({
      path,
      fileName: file.name.slice(-120),
      contentType: file.type,
      bytes: file.size,
    });
  }

  return uploaded;
}
