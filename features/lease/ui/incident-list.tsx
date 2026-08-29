"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  FileWarningIcon,
  ImageIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
  VideoIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { uploadError, usePickedFiles, type Picked } from "./use-picked-files";
import { formatBytes } from "@/shared/format/bytes";
import { formatBogotaDateTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

import { reportIncident, updateIncident } from "../actions/incident";
import {
  allowedTransitions,
  attachmentProblem,
  attachmentsLabel,
  incidentAnchor,
  incidentFolder,
  incidentState,
  isIncidentOpen,
  isVideoAttachment,
  transitionRequiresNote,
  INCIDENT_CONTENT_TYPES,
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_PARTY_LABELS,
  INCIDENT_STATE_LABELS,
  INCIDENT_TITLE_MAX,
  MAX_INCIDENT_ATTACHMENTS,
  transitionLabel,
  type Incident,
  type IncidentAttachment,
  type IncidentState,
  type IncidentUpdate,
} from "../domain/incident";

/**
 * One report as it crosses from the server: the record, and a link per file **keyed by path**.
 *
 * A map rather than signed copies of two lists, because the files hang off the report *and* off every
 * update in its thread. A path missing from the map is a file whose URL could not be signed, which is
 * a different thing from a file that is not there — and the record renders either way.
 */
export type IncidentRow = {
  readonly incident: Incident;
  readonly urls: Readonly<Record<string, string | null>>;
};

const STATE_BADGE: Readonly<Record<IncidentState, string>> = {
  reported: "bg-status-pending-bg text-status-pending",
  in_progress: "bg-status-current-bg text-status-current",
  awaiting_confirmation: "bg-status-pending-bg text-status-pending",
  resolved: "bg-status-approved-bg text-status-approved",
  withdrawn: "bg-muted text-muted-foreground",
};

/**
 * What has gone wrong in the property, and what each side is doing about it.
 *
 * **Only the tenant reports; both parties manage.** An incident is what the person living there
 * finds, so a landlord "reporting" one about a property they do not occupy would be a note about
 * their own tenant with no way for the tenant to answer. Once it exists it is a thing the two of them
 * work through — and the state machine is asymmetric about the one step that matters: the landlord
 * can say "ya lo arreglé", and only the tenant can say it is actually fixed.
 *
 * Everything here is `brand`, never `accent`. The one cyan action on this page is the month that has
 * to be paid: a tenancy with rent due and a broken boiler still has one first thing to do.
 */
export function IncidentList({
  leaseId,
  rows,
  isLandlord,
}: {
  readonly leaseId: string;
  /** Newest first, as the server read them. */
  readonly rows: readonly IncidentRow[];
  readonly isLandlord: boolean;
}) {
  const [reporting, setReporting] = useState(false);

  return (
    <section aria-labelledby="incidents-heading" className="scroll-mt-24" id="incidentes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="incidents-heading"
          className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Incidentes ({rows.length})
        </h2>
        {!isLandlord && !reporting ? (
          <Button variant="brand" size="xl" onClick={() => setReporting(true)}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Reportar un incidente
          </Button>
        ) : null}
      </div>

      {reporting ? <IncidentForm leaseId={leaseId} onDone={() => setReporting(false)} /> : null}

      {/*
        El estado vacío se calla mientras el formulario está abierto: decirle "repórtalo aquí" a
        alguien que ya lo tiene abierto y medio lleno es ruido debajo de la cosa que está haciendo.
      */}
      {rows.length === 0 && !reporting ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {isLandlord
            ? "El inquilino no ha reportado nada. Cuando lo haga, lo vas a ver aquí con sus fotos o videos, y lo podrás poner en arreglo desde la misma ficha."
            : "No has reportado nada todavía. Si algo se daña o se rompe, repórtalo aquí con fotos o un video: queda anotado con la fecha y el propietario lo ve al instante."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <IncidentItem
              key={row.incident.id}
              leaseId={leaseId}
              row={row}
              isLandlord={isLandlord}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One report, folded shut.
 *
 * The header carries the title, when it was reported, how many files came with it **and where it is
 * now** — the same reasoning as the months: what a click reveals is the detail, not the news. An
 * incident whose state you have to open it to learn is an incident nobody tracks.
 */
function IncidentItem({
  leaseId,
  row,
  isLandlord,
}: {
  readonly leaseId: string;
  readonly row: IncidentRow;
  readonly isLandlord: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `incidente-panel-${row.incident.id}`;
  const state = incidentState(row.incident);
  const transitions = allowedTransitions(state, isLandlord);
  /*
   * Con `?? []` porque un incidente reportado antes de que existiera el hilo no trae la clave, y esos
   * documentos están en la base ahora mismo. El convertidor ya lo rellena; esto es la segunda red,
   * que es la que faltaba cuando la lista se cayó con "Cannot read properties of undefined".
   */
  const updates = row.incident.updates ?? [];
  const attachments = row.incident.attachments ?? [];
  // Comentar sigue teniendo sentido mientras el incidente esté vivo, o mientras a esta parte le quede
  // algo que pulsar. En uno cerrado por el inquilino no hay ni una cosa ni la otra.
  const canAct = isIncidentOpen(state) || transitions.length > 0;

  return (
    /*
     * `data-incident` y `data-state` no son decoración: son cómo un driver le pregunta al producto en
     * qué estado quedó un incidente en vez de recalcularlo. Una aserción que repite la regla es una
     * segunda copia de la regla, y la copia que nadie mira es la del test.
     */
    <li
      id={incidentAnchor(row.incident.id)}
      data-incident={row.incident.id}
      data-state={state}
      data-attachments={attachments.length}
      className="scroll-mt-24 rounded-xl border border-border bg-card"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          {/* Un título de 120 caracteres cabe: se equilibra en dos líneas en vez de recortarse. */}
          <span className="block font-medium text-balance text-foreground">
            {row.incident.title}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatBogotaDateTime(row.incident.createdAt)} ·{" "}
            {attachmentsLabel(attachments)}
            {updates.length > 0
              ? ` · ${updates.length === 1 ? "1 mensaje" : `${updates.length} mensajes`}`
              : ""}
          </span>
        </span>
        <StateBadge state={state} />
      </button>

      {open ? (
        <div id={panelId} className="space-y-4 border-t border-border p-4">
          {/* `whitespace-pre-line`: se escribió en un textarea, y los saltos de línea son del autor. */}
          <p className="text-sm whitespace-pre-line text-foreground">{row.incident.description}</p>
          <p className="text-xs text-muted-foreground">
            Reportado por {row.incident.reporterName || "el inquilino"}
          </p>
          {attachments.length > 0 ? (
            <Attachments attachments={attachments} urls={row.urls ?? {}} />
          ) : null}

          {updates.length > 0 ? <Thread updates={updates} urls={row.urls ?? {}} /> : null}

          {canAct ? (
            <IncidentActions
              leaseId={leaseId}
              incidentId={row.incident.id}
              state={state}
              transitions={transitions}
            />
          ) : (
            /*
             * Sin controles y dicho: un incidente cerrado por el inquilino no se reabre — se reporta
             * otra vez, que es otra cosa que pasó. Mismo trato que una postulación retirada.
             */
            <p className="text-sm text-muted-foreground">
              Este incidente está cerrado. Si vuelve a pasar, repórtalo de nuevo.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function StateBadge({ state }: { readonly state: IncidentState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATE_BADGE[state],
      )}
    >
      {INCIDENT_STATE_LABELS[state]}
    </span>
  );
}

/**
 * What happened since the report, oldest first.
 *
 * Every entry says who, when, what it moved to and why — which is what makes this the record rather
 * than a chat. "El propietario · En arreglo · mando al plomero el martes" is one line that answers
 * everything somebody opening this three months later wants to know.
 */
function Thread({
  updates,
  urls,
}: {
  readonly updates: readonly IncidentUpdate[];
  readonly urls: Readonly<Record<string, string | null>>;
}) {
  return (
    <ol aria-label="Historial del incidente" className="space-y-3 border-t border-border pt-4">
      {updates.map((update, index) => (
        <li key={`${update.at}-${index}`} className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {update.authorName || INCIDENT_PARTY_LABELS[update.by]}
            </span>{" "}
            · {formatBogotaDateTime(update.at)}
            {update.movedTo ? (
              <>
                {" · "}
                <span
                  data-moved-to={update.movedTo}
                  className="font-medium text-brand-panel dark:text-foreground"
                >
                  {INCIDENT_STATE_LABELS[update.movedTo]}
                </span>
              </>
            ) : null}
          </p>
          {update.note ? (
            <p className="whitespace-pre-line text-foreground">{update.note}</p>
          ) : null}
          {update.attachments.length > 0 ? (
            <Attachments attachments={update.attachments} urls={urls} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The files of a report or of one update.
 *
 * A video is rendered as a video and a photo as a photo, because the whole reason this accepts both is
 * that they answer different questions — a still frame cannot carry "it only leaks when the tap runs",
 * and neither can it show that the pipe really was replaced. `preload="metadata"` so opening a report
 * does not pull five videos down a phone connection.
 *
 * **The record is read from the document; only the link comes from the signed URL.** A file whose URL
 * could not be signed still shows its name, its type and its size, and says so — what is lost is being
 * able to open it, and nothing else.
 */
function Attachments({
  attachments,
  urls,
}: {
  readonly attachments: readonly IncidentAttachment[];
  readonly urls: Readonly<Record<string, string | null>>;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const video = isVideoAttachment(attachment.contentType);
        const url = urls[attachment.path] ?? null;

        return (
          <li
            key={attachment.path}
            data-attachment={video ? "video" : "image"}
            className="overflow-hidden rounded-xl border border-border bg-background"
          >
            {url ? (
              video ? (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                />
              ) : (
                <a href={url} target="_blank" rel="noreferrer noopener" className="block">
                  {/*
                    `unoptimized`: la URL está firmada y caduca en una hora, así que el optimizador de
                    Next guardaría en caché una imagen tras un enlace que va a morir — y la siguiente
                    firma es otra URL, así que la caché no se reutiliza nunca.
                  */}
                  <Image
                    src={url}
                    alt={attachment.fileName}
                    width={640}
                    height={360}
                    unoptimized
                    className="aspect-video w-full bg-muted object-cover"
                  />
                </a>
              )
            ) : (
              <p className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <FileWarningIcon className="size-4 shrink-0" aria-hidden="true" />
                No pudimos abrir este archivo ahora mismo. Recarga en un momento.
              </p>
            )}
            <div className="flex items-start justify-between gap-2 p-3">
              <p className="min-w-0 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {video ? (
                    <VideoIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{attachment.fileName}</span>
                </span>
                {formatBytes(attachment.bytes)}
              </p>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Abrir ${attachment.fileName}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What the picker means for an incident: five files, photo **or video**, in the reporter's folder.
 *
 * A module constant rather than an inline object, so the two forms in this file cannot drift and so
 * the reference is stable — `usePickedFiles` memoises on it.
 */
const INCIDENT_PICKER = {
  max: MAX_INCIDENT_ATTACHMENTS,
  problemOf: attachmentProblem,
  folderOf: incidentFolder,
  tooMany: (room: number) =>
    room === 0
      ? `Ya adjuntaste ${MAX_INCIDENT_ATTACHMENTS} archivos, que es el máximo.`
      : `Solo puedes adjuntar ${MAX_INCIDENT_ATTACHMENTS} archivos en total.`,
} as const;

/** The pick button, the previews and the sentence about what is allowed. */
function AttachmentPicker({
  id,
  picked,
  onPick,
  onDrop,
  disabled,
  label,
  hint,
}: {
  readonly id: string;
  readonly picked: readonly Picked[];
  readonly onPick: (files: FileList | null) => void;
  readonly onDrop: (target: Picked) => void;
  readonly disabled: boolean;
  readonly label: string;
  readonly hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      {picked.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {picked.map((one) => (
            <li
              key={one.preview}
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              {one.file.type.startsWith("video/") ? (
                <video
                  src={one.preview}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                />
              ) : (
                /*
                  `unoptimized`, como en los adjuntos ya guardados y por una razón más fuerte: la
                  fuente es un `blob:` de esta pestaña, así que no hay nada que el optimizador pueda ir
                  a buscar ni dominio que declarar en `next.config.ts`.
                */
                <Image
                  src={one.preview}
                  alt={one.file.name}
                  width={640}
                  height={360}
                  unoptimized
                  className="aspect-video w-full bg-muted object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-2 p-3">
                <p className="min-w-0 text-xs text-muted-foreground">
                  <span className="block truncate font-medium text-foreground">{one.file.name}</span>
                  {formatBytes(one.file.size)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Quitar ${one.file.name}`}
                  onClick={() => onDrop(one)}
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={INCIDENT_CONTENT_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            onPick(event.target.files);
            // Vaciar el input: sin esto, elegir el mismo fichero otra vez no dispara `change`.
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <Button asChild variant="outline" size="xl" disabled={disabled}>
          <label htmlFor={id}>
            <UploadIcon className="size-4" aria-hidden="true" />
            {label}
          </label>
        </Button>
        {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

const PICKER_HINT = `Hasta ${MAX_INCIDENT_ATTACHMENTS} archivos: fotos de 8 MB o videos de 50 MB.`;

// ---------------------------------------------------------------------------
// the two forms
// ---------------------------------------------------------------------------

/** The report itself: a title, what happened, and the files. */
function IncidentForm({
  leaseId,
  onDone,
}: {
  readonly leaseId: string;
  readonly onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { picked, pick, drop, clear, uploadAll } = usePickedFiles(INCIDENT_PICKER);

  function submit() {
    setError(null);

    startTransition(async () => {
      try {
        const attachments = await uploadAll((done, total) => setProgress({ done, total }));

        const result = await reportIncident(leaseId, { title, description, attachments });
        if (!result.ok) {
          setError(result.message);

          return;
        }

        clear();
        setTitle("");
        setDescription("");
        onDone();
        router.refresh();
      } catch (thrown) {
        setError(uploadError(thrown));
      } finally {
        setProgress(null);
      }
    });
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <Label htmlFor="incident-title">Qué pasó</Label>
        <Input
          id="incident-title"
          value={title}
          maxLength={INCIDENT_TITLE_MAX}
          placeholder="Se rompió el sifón del lavaplatos"
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Una frase. Es lo que el propietario ve en la lista.
        </p>
      </div>

      <div>
        <Label htmlFor="incident-description">Cuéntalo con detalle</Label>
        <textarea
          id="incident-description"
          rows={4}
          maxLength={INCIDENT_DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Desde anoche gotea debajo del mueble de la cocina. Puse una olla para recoger el agua, pero el mueble ya está mojado."
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Desde cuándo pasa y qué has hecho. Esto queda con la fecha, y es lo que las dos partes leen
          después.
        </p>
      </div>

      <AttachmentPicker
        id="incident-files"
        picked={picked}
        onPick={(files) => setError(pick(files))}
        onDrop={drop}
        disabled={pending}
        label="Adjuntar fotos o video"
        hint={`${PICKER_HINT} Un video sirve para lo que una foto no puede mostrar — un ruido, o una gotera que solo aparece con el agua abierta.`}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="brand" size="xl" disabled={pending} onClick={submit}>
          {progress
            ? `Subiendo ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
            : pending
              ? "Enviando…"
              : "Reportar el incidente"}
        </Button>
        <Button variant="ghost" size="xl" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-status-rejected">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What this party can do about an incident that already exists.
 *
 * One form with several submits, not one form per action: the message, the files and the button are
 * the same three things whatever the button says, and splitting them would mean choosing which of the
 * forms gets the file picker.
 *
 * The transitions come from the domain — this renders what it is handed and never decides who may do
 * what. `updateIncident` checks the same rule again against the stored thread, so a client that posts
 * a move it was not offered is refused by the record rather than by the markup.
 */
function IncidentActions({
  leaseId,
  incidentId,
  state,
  transitions,
}: {
  readonly leaseId: string;
  readonly incidentId: string;
  readonly state: IncidentState;
  readonly transitions: readonly IncidentState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { picked, pick, drop, clear, uploadAll } = usePickedFiles(INCIDENT_PICKER);

  function send(movedTo: IncidentState | null) {
    setError(null);

    /*
     * El único aviso que se da antes de llamar al servidor, porque es el único que evita un viaje de
     * subida entero para nada: decir "sigue roto" obliga a decir qué sigue roto. La acción lo
     * comprueba igual — esto es cortesía, no la regla.
     */
    if (movedTo && transitionRequiresNote(state, movedTo) && !note.trim()) {
      setError("Cuéntale qué sigue mal: es lo único que dice qué corregir.");

      return;
    }

    startTransition(async () => {
      try {
        const attachments = await uploadAll((done, total) => setProgress({ done, total }));

        const result = await updateIncident(leaseId, incidentId, { note, attachments, movedTo });
        if (!result.ok) {
          setError(result.message);

          return;
        }

        clear();
        setNote("");
        router.refresh();
      } catch (thrown) {
        setError(uploadError(thrown));
      } finally {
        setProgress(null);
      }
    });
  }

  const noteId = `incident-note-${incidentId}`;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <Label htmlFor={noteId}>
          {state === "awaiting_confirmation" ? "¿Quedó bien?" : "Escribe algo sobre esto"}
        </Label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            state === "awaiting_confirmation"
              ? "Revisé y sigue goteando por el mismo sitio."
              : "Mando al plomero el martes en la mañana."
          }
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          La otra parte lo lee, y queda en el historial con la fecha.
        </p>
      </div>

      <AttachmentPicker
        id={`incident-update-files-${incidentId}`}
        picked={picked}
        onPick={(files) => setError(pick(files))}
        onDrop={drop}
        disabled={pending}
        label="Adjuntar fotos o video"
        hint={PICKER_HINT}
      />

      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => (
          <Button
            key={to}
            variant="brand"
            size="xl"
            data-move-to={to}
            disabled={pending}
            onClick={() => send(to)}
          >
            <WrenchIcon className="size-4" aria-hidden="true" />
            {transitionLabel(state, to)}
          </Button>
        ))}
        {/*
          Y mandar sólo un mensaje, sin mover nada. Es la mitad que hace que "esto no me toca a mí" no
          necesite ser un estado: se escribe, la otra parte lo lee, y el producto guarda el desacuerdo
          en vez de resolverlo.
        */}
        <Button variant="outline" size="xl" disabled={pending} onClick={() => send(null)}>
          <SendIcon className="size-4" aria-hidden="true" />
          {progress
            ? `Subiendo ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
            : pending
              ? "Enviando…"
              : "Enviar mensaje"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-status-rejected">
          {error}
        </p>
      ) : null}
    </div>
  );
}
