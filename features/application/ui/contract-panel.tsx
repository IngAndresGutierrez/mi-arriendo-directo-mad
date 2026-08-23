"use client";

import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { contractFileRoute } from "@/shared/auth/routes";
import { formatBytes } from "@/shared/format/bytes";
import { formatBogotaDateTime } from "@/shared/format/date";

import { removeContract, saveSignatureSpots, uploadContract } from "../actions/contract";
import { confirmSignature, requestSignatureCode } from "../actions/signature";
import { SignaturePad } from "./signature-pad";
import {
  contractBlocker,
  contractBlockerMessage,
  contractFileProblem,
  canStamp,
  contractState,
  hasSigned,
  spotsReady,
  replacingVoids,
  validSignatures,
  CONTRACT_CONTENT_TYPES,
  CONTRACT_PARTIES,
  CONTRACT_PARTY_LABELS,
  OTP_LENGTH,
  SIGNATURE_CHANNEL_LABELS,
  SIGNATURE_CHANNELS,
  SIGNATURE_CLAUSE,
  SIGNATURE_CLAUSE_VERSION,
} from "../domain/contract";
import type {
  Contract,
  ContractDocument,
  SignatureSpot,
  StampedContract,
} from "../domain/contract";

/**
 * `pdfjs-dist` es más de un mega, y solo hace falta para que el propietario marque dónde firma cada
 * parte. Detrás de `next/dynamic` y sin SSR: se descarga cuando alguien abre el colocador, no
 * cuando se renderiza la página que lo contiene.
 */
const SignaturePlacer = dynamic(
  () => import("./signature-placer").then((module) => module.SignaturePlacer),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Cargando el visor…</p> },
);

/**
 * The signature stage.
 *
 * The contract is signed **here**, by both parties, with a one-time code sent to the channel each
 * of them already verified. Nobody creates an account anywhere and the file never leaves: the
 * evidence that makes the signature reliable — the clause each party accepted, the exact moment,
 * and the hash of the file they signed — lives on the application beside it.
 *
 * Both sides read the same panel. It is the document that binds them, and a lease one party can
 * only find in their own inbox is a lease they will eventually not find.
 */
export function ContractPanel({
  applicationId,
  contract,
  document: file,
  stamped,
  isLandlord,
  channels,
  readOnly = false,
}: {
  readonly applicationId: string;
  /** The record: the file's metadata plus each party's signature over it. */
  readonly contract: Contract | null;
  /** The same file with a link signed for the next hour, or `null` while nothing is uploaded. */
  readonly document: (ContractDocument & { readonly url: string }) | null;
  /** El PDF derivado que las partes descargan, con su enlace de una hora. */
  readonly stamped: (StampedContract & { readonly url: string }) | null;
  readonly isLandlord: boolean;
  /**
   * Los canales que de verdad pueden entregar un código, decididos en el servidor.
   *
   * No se ofrece uno que va a fallar: WhatsApp necesita su plantilla aprobada por Meta, y mostrar el
   * radio sin ella era ofrecer un control que responde "no pudimos enviar el código".
   */
  readonly channels: readonly (typeof SIGNATURE_CHANNELS)[number][];
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(contract?.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const [channel, setChannel] = useState<(typeof SIGNATURE_CHANNELS)[number]>(channels[0] ?? "email");
  const [acceptedClause, setAcceptedClause] = useState(false);
  const [code, setCode] = useState("");
  /** Adónde se mandó el código, enmascarado, o `null` mientras no se ha pedido. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** El trazo dibujado, como data URL, o "" si no dibujó. Opcional: el código es lo que firma. */
  const [stroke, setStroke] = useState("");
  const [spots, setSpots] = useState<readonly SignatureSpot[]>(contract?.spots ?? []);
  const [placing, setPlacing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const state = contractState(contract);
  const blocker = contractBlocker(contract);
  const signatures = validSignatures(contract);
  const wouldVoid = replacingVoids(contract);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "No pudimos completar la acción.");
        return;
      }
      router.refresh();
    });
  }

  function onPick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    /*
     * Se comprueba aquí antes de gastar la subida, y otra vez en la acción: la misma función pura
     * en los dos sitios, así que la frase que se lee en pantalla es la que habría dicho el
     * servidor.
     */
    const problem = contractFileProblem({ type: picked.type, size: picked.size });
    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    const body = new FormData();
    body.set("contract", picked);
    body.set("note", note);

    startTransition(async () => {
      const result = await uploadContract(applicationId, body);
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
            {state === "signed" ? (
              <CheckIcon className="size-3" aria-hidden="true" />
            ) : (
              <ShieldCheckIcon className="size-3" aria-hidden="true" />
            )}
            Firma electrónica
          </span>
          <span className="text-xs font-medium text-foreground">
            Se firma aquí, sin cuentas ni trámites
          </span>
        </div>

        {file ? (
          <div className="mt-3 space-y-3">
            {/*
              El enlace lo firma el servidor y dura una hora: la ruta de contratos está cerrada a
              los clientes en `storage.rules`, así que esta es la única forma de leerlo. Un contrato
              es el documento más privado del proceso y una URL permanente está a un reenvío de ser
              pública.
            */}
            <a
              className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileTextIcon
                className="size-4 shrink-0 text-brand-panel dark:text-brand-panel-muted"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(file.bytes)}
              </span>
              <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
            </a>

            {/*
              Cambiar el archivo va aquí, pegado al archivo, y como enlace discreto — no como un
              bloque titulado abajo con el mismo peso que "firmar". Son dos trabajos distintos:
              firmar es lo que vienes a hacer, y cambiar el documento es una corrección. Además
              esto **borra las firmas**, así que ofrecerlo como un igual de la acción principal es
              poner una acción destructiva al lado de la constructiva.
            */}
            {isLandlord && !readOnly && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  {pending ? "Subiendo…" : "Cambiar el contrato"}
                </button>
                {/*
                  Y quitarlo, que no es lo mismo que cambiarlo: quien subió el archivo equivocado lo
                  quiere fuera, no canjeado por otro que quizá todavía no tiene a mano. Sin esto la
                  pantalla se queda con un documento que nadie quiso y sin vuelta atrás.
                */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRemoving(true)}
                  className="text-xs text-destructive underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-destructive/40 focus-visible:outline-none disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            )}

            {/*
              Quién firmó y cuándo, con el canal enmascarado. Esto es la bitácora: es lo que
              responde a una impugnación, y por eso la leen las dos partes y no solo quien firmó.
            */}
            <ul className="space-y-1.5">
              {CONTRACT_PARTIES.map((party) => {
                const signature = signatures.find((each) => each.party === party);

                return (
                  <li key={party} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-foreground">
                      {signature ? "✓ " : ""}
                      {CONTRACT_PARTY_LABELS[party]}
                    </span>
                    {signature ? (
                      <span className="text-muted-foreground">
                        firmó el {formatBogotaDateTime(signature.signedAt)} · código a{" "}
                        {signature.sentTo}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">sin firmar</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/*
              El PDF firmado: el original con los trazos y la hoja de evidencia. Va arriba del
              original porque es lo que alguien viene a buscar una vez firmado.
            */}
            {stamped && (
              <a
                className="flex items-center gap-2 rounded-lg border border-status-approved bg-status-approved-bg px-3 py-2 text-sm font-medium text-status-approved hover:opacity-90"
                href={stamped.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileTextIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">Contrato firmado por las dos partes</span>
                <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
              </a>
            )}

            {contract?.note && <p className="text-sm text-muted-foreground">{contract.note}</p>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLandlord
              ? "Sube el contrato de arrendamiento. Los dos lo firman aquí mismo, con un código que les llega al correo o al WhatsApp que ya verificaron."
              : "El propietario subirá el contrato aquí. Después lo firman los dos desde esta página, con un código que te llega al correo o al WhatsApp que ya verificaste."}
          </p>
        )}

        {blocker && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            {contractBlockerMessage(blocker, isLandlord)}
          </p>
        )}
      </div>

      {/*
        Firmar. Lo ve cualquiera de las dos partes que todavía no haya firmado, y desaparece cuando
        ya firmó: un control que no cambia nada es la misma mentira que un "Continuar" que no
        continúa.
      */}
      {file && !readOnly && !hasSigned(contract, isLandlord ? "landlord" : "tenant") && (
        <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Tu firma</p>

          {sentTo === null ? (
            <>
              {/*
                La cláusula se acepta *antes* de pedir el código, no al escribirlo: la presunción
                del Decreto 2364 aplica a la firma pactada, así que el acuerdo tiene que venir antes
                del mecanismo, no junto con su resultado.
              */}
              <label className="flex gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--brand-panel)]"
                  checked={acceptedClause}
                  onChange={(event) => setAcceptedClause(event.target.checked)}
                />
                <span>{SIGNATURE_CLAUSE}</span>
              </label>

              {/*
                Con un solo canal no hay elección que ofrecer: un grupo de radios de un elemento es
                una pregunta cuya respuesta ya está dada. Se dice a dónde va y se acabó.
              */}
              {channels.length > 1 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">
                    ¿Por dónde te mandamos el código?
                  </legend>
                  {channels.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="signature-channel"
                        className="size-4 accent-[var(--brand-panel)]"
                        checked={channel === option}
                        onChange={() => setChannel(option)}
                      />
                      <span>
                        {option === "email"
                          ? "Mi correo electrónico verificado"
                          : `Mi ${SIGNATURE_CHANNEL_LABELS[option]}, al número que registré`}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {channel === "email"
                    ? "Te mandamos el código a tu correo electrónico verificado."
                    : `Te mandamos el código por ${SIGNATURE_CHANNEL_LABELS[channel]}, al número que registraste.`}
                </p>
              )}

              <Button
                type="button"
                variant="accent"
                size="xl"
                disabled={pending || !acceptedClause}
                /*
                  Sin `router.refresh()`: pedir el código no cambia nada de lo que la página
                  muestra — el reto vive en una colección que nadie lee — y refrescar mantenía
                  `pending` en `true` durante todo el viaje al servidor, con el lienzo de la firma
                  deshabilitado justo cuando aparece. Alguien haría clic para dibujar y no pasaría
                  nada.
                */
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await requestSignatureCode(applicationId, {
                      channel,
                      acceptedClause,
                      clauseVersion: SIGNATURE_CLAUSE_VERSION,
                    });
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setSentTo(result.sentTo ?? "");
                  })
                }
              >
                {pending ? "Enviando…" : "Mandarme el código para firmar"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Te mandamos un código a {sentTo}. Escríbelo aquí para firmar.
              </p>

              {/*
                El dibujo va aquí, junto al código, porque es una sola acción: se firma una vez. Y
                solo si hay dónde estamparlo — sobre una foto del contrato no hay página que marcar,
                y la firma vale igual porque el código es lo que firma.
              */}
              {spotsReady(contract) && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Dibuja tu firma (opcional)</p>
                  <SignaturePad onChange={setStroke} disabled={pending} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="signature-code">Código de {OTP_LENGTH} dígitos</Label>
                <Input
                  id="signature-code"
                  className="h-11 max-w-40 tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={"0".repeat(OTP_LENGTH)}
                  value={code}
                  maxLength={OTP_LENGTH}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="accent"
                  size="xl"
                  disabled={pending || code.length !== OTP_LENGTH}
                  onClick={() => run(() => confirmSignature(applicationId, { code, stroke }))}
                >
                  {pending ? "Firmando…" : "Firmar el contrato"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  disabled={pending}
                  onClick={() => {
                    setSentTo(null);
                    setCode("");
                  }}
                >
                  Pedir otro código
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {isLandlord && !readOnly && (
        <div className="space-y-4">
          {/*
            Marcar dónde firma cada parte. Solo sobre un PDF: en una foto no hay página que
            coordinar, y el panel lo dice en vez de ofrecer un botón que no haría nada.
          */}
          {file && canStamp(file) && (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Dónde firma cada parte</p>
                {spotsReady(contract) && (
                  <span className="text-xs font-medium text-status-approved">Marcado</span>
                )}
              </div>
              {placing ? (
                <>
                  <SignaturePlacer
                    /*
                      La ruta propia, no la URL firmada de Storage: `pdf.js` hace `fetch` y el
                      bucket no manda cabeceras CORS, así que el navegador lo bloqueaba. El enlace
                      de arriba sigue usando la URL firmada porque un `<a>` no necesita CORS.
                    */
                    url={contractFileRoute(applicationId)}
                    spots={spots}
                    onChange={setSpots}
                    disabled={pending}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="brand"
                      size="xl"
                      disabled={pending || spots.length !== 2}
                      onClick={() =>
                        run(async () => {
                          const result = await saveSignatureSpots(applicationId, { spots });
                          if (result.ok) setPlacing(false);
                          return result;
                        })
                      }
                    >
                      {pending ? "Guardando…" : "Guardar los recuadros"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xl"
                      disabled={pending}
                      onClick={() => {
                        setSpots(contract?.spots ?? []);
                        setPlacing(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {spotsReady(contract)
                      ? "Las dos firmas se dibujarán donde las marcaste. Puedes cambiarlo."
                      : "Marca en el PDF dónde firma cada parte. Sin esto se puede firmar igual, pero la firma no se dibuja en el documento."}
                  </p>
                  <Button
                    type="button"
                    variant="brand"
                    size="xl"
                    disabled={pending}
                    onClick={() => setPlacing(true)}
                  >
                    {spotsReady(contract) ? "Cambiar los recuadros" : "Marcar dónde se firma"}
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contract-note">Nota sobre el contrato (opcional)</Label>
            <Input
              id="contract-note"
              className="h-11"
              placeholder="Incluye el inventario como anexo."
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {/*
            Subir, solo cuando no hay contrato: es entonces la única cosa que hacer, y por eso va en
            cian. Una vez subido, cambiarlo es una corrección y vive junto al archivo, arriba.
          */}
          {state === "none" && (
            <Button
              type="button"
              variant="accent"
              size="xl"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon aria-hidden="true" />
              {pending ? "Subiendo…" : "Subir el contrato"}
            </Button>
          )}

          {/*
            El input, una sola vez y compartido por los dos disparadores: dos inputs para el mismo
            archivo son dos sitios donde arreglar el mismo `accept`.
          */}
          <input
            ref={inputRef}
            id="contract-file"
            type="file"
            className="sr-only"
            accept={CONTRACT_CONTENT_TYPES.join(",")}
            disabled={pending}
            onChange={(event) => onPick(event.target.files)}
          />

          {/* El aviso de que se pierden firmas, junto a lo que las pierde. */}
          {wouldVoid > 0 && (
            <p className="rounded-lg border border-status-current bg-status-current-bg px-3 py-2 text-sm text-status-current">
              Si cambias el archivo se pierde
              {wouldVoid === 1 ? " la firma que ya hay" : ` ${wouldVoid} firmas que ya hay`}: la
              firma vale para el documento exacto que se firmó, y habría que volver a firmar.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="¿Quitar el contrato?"
        description={
          wouldVoid > 0
            ? `Se elimina el archivo y ${wouldVoid === 1 ? "la firma que ya hay" : `las ${wouldVoid} firmas que ya hay`}. Habrá que subir el contrato otra vez y volver a firmar.`
            : "Se elimina el archivo y habrá que subir el contrato otra vez para que las dos partes lo firmen."
        }
        confirmLabel="Quitar el contrato"
        pendingLabel="Quitando…"
        onConfirm={async () => {
          const result = await removeContract(applicationId);
          setRemoving(false);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.refresh();
        }}
      />
    </div>
  );
}
