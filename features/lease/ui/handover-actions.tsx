"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlusIcon, PlusIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";

import { formatBytes } from "@/shared/format/bytes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

import {
  acceptHandover,
  objectHandover,
  saveHandoverDraft,
  submitHandover,
} from "../actions/handover";
import {
  AREA_CONDITIONS,
  AREA_CONDITION_LABELS,
  MAX_AREA_PHOTOS,
  MAX_HANDOVER_AREAS,
  MAX_OBJECTION_PHOTOS,
  OBJECTION_NOTE_MAX,
  SUGGESTED_AREAS,
  availableHandoverActions,
  handoverFolder,
  handoverPhotoProblem,
  type AreaCondition,
  type HandoverArea,
  type HandoverKind,
  type HandoverState,
} from "../domain/handover";
import { uploadError, usePickedFiles, type Picked } from "./use-picked-files";

/**
 * What each party can do to this acta, and the forms behind it.
 *
 * **The list comes from the domain, not from this component** — `availableHandoverActions` — and the
 * Server Action asks the same function before it writes. That is the rule an errand's
 * `availableActions` already states: a control the server would refuse is a lie, and two copies of
 * "when may this be accepted?" drift, with the button drifting first.
 */
export function HandoverActions({
  leaseId,
  kind,
  state,
  isLandlord,
  areas,
  seed,
}: {
  readonly leaseId: string;
  readonly kind: HandoverKind;
  readonly state: HandoverState;
  readonly isLandlord: boolean;
  readonly areas: readonly HandoverArea[];
  /** The rooms a fresh acta starts with — the check-in's, on a devolución. */
  readonly seed: readonly string[];
}) {
  const [editing, setEditing] = useState(false);
  const [objecting, setObjecting] = useState(false);

  const allowed = availableHandoverActions(state, isLandlord ? "landlord" : "tenant");
  if (allowed.length === 0) return null;

  if (editing) {
    return (
      <HandoverEditor
        leaseId={leaseId}
        kind={kind}
        areas={areas}
        seed={seed}
        onDone={() => setEditing(false)}
      />
    );
  }

  if (objecting) {
    return <ObjectionForm leaseId={leaseId} kind={kind} onDone={() => setObjecting(false)} />;
  }

  return (
    <div className="mt-5 space-y-3">
      {/*
        El estado vacío del propietario vive aquí y no en el panel: este componente es el único que
        sabe si el editor está abierto, y "todavía no hay espacios" encima de un editor con dos
        espacios escritos contradice lo que la persona está viendo.
      */}
      {isLandlord && areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay espacios en el acta. Agrégalos y envíasela al inquilino.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
      {allowed.includes("draft") ? (
        <Button variant="brand" size="xl" onClick={() => setEditing(true)}>
          <PlusIcon aria-hidden="true" />
          {areas.length === 0 ? "Redactar el acta" : "Editar el acta"}
        </Button>
      ) : null}
      {allowed.includes("submit") ? <SubmitToTenant leaseId={leaseId} kind={kind} areas={areas} /> : null}
      {allowed.includes("accept") ? <AcceptButton leaseId={leaseId} kind={kind} /> : null}
      {allowed.includes("object") ? (
        <Button variant="brand" size="xl" onClick={() => setObjecting(true)}>
          Poner observaciones
        </Button>
      ) : null}
      </div>
    </div>
  );
}

/**
 * The one cyan button of this panel, and which action gets it depends on who is looking.
 *
 * For the landlord it is sending the acta — the whole point of writing one is that the other party
 * reads it — and for the tenant it is accepting. They are never on screen at the same time, because
 * the two parties never see the same controls.
 */
function SubmitToTenant({
  leaseId,
  kind,
  areas,
}: {
  readonly leaseId: string;
  readonly kind: HandoverKind;
  readonly areas: readonly HandoverArea[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /*
   * An acta with no areas cannot be sent, and the button says so rather than being hidden: a
   * landlord who has not written anything yet needs to know that sending is what comes *after*, not
   * that the product forgot to offer it. `aria-disabled` and not `disabled`, the project's rule, so
   * the reason underneath stays reachable.
   */
  const empty = areas.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="accent"
        size="xl"
        aria-disabled={empty || pending}
        className={empty ? "opacity-60" : undefined}
        onClick={
          empty
            ? undefined
            : () =>
                start(async () => {
                  const result = await submitHandover(leaseId, kind);
                  if (!result.ok) {
                    setError(result.message);

                    return;
                  }
                  router.refresh();
                })
        }
      >
        <SendIcon aria-hidden="true" />
        {pending ? "Enviando…" : "Enviar al inquilino"}
      </Button>
      {empty ? (
        <p className="text-xs text-muted-foreground">Agrega al menos un espacio antes de enviarla.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AcceptButton({ leaseId, kind }: { readonly leaseId: string; readonly kind: HandoverKind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="accent"
        size="xl"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await acceptHandover(leaseId, kind);
            if (!result.ok) {
              setError(result.message);

              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Guardando…" : "Aceptar el acta"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// the landlord's editor
// ---------------------------------------------------------------------------

/** One area while it is being written: the stored shape plus the files not yet uploaded. */
type DraftArea = {
  readonly id: string;
  name: string;
  condition: AreaCondition;
  note: string;
  /** Already in the bucket, from a previous save. */
  kept: readonly HandoverArea["photos"][number][];
};

const HANDOVER_PICKER = {
  max: MAX_AREA_PHOTOS,
  problemOf: handoverPhotoProblem,
  folderOf: handoverFolder,
  tooMany: (room: number) =>
    room === 0
      ? `Ya hay ${MAX_AREA_PHOTOS} fotos en este espacio, que es el máximo.`
      : `Hasta ${MAX_AREA_PHOTOS} fotos por espacio.`,
} as const;

/**
 * Writing the acta: the rooms, how each was found, and the photos.
 *
 * **The whole acta is saved at once**, not area by area. An acta is one document that one person
 * agrees to, so a half-saved one is a version the tenant could be looking at while the landlord is
 * still writing it — and `saveHandoverDraft` recomputes the fingerprint on every write, so a save
 * per area would invalidate the tenant's acceptance several times over a single sitting.
 */
function HandoverEditor({
  leaseId,
  kind,
  areas,
  seed,
  onDone,
}: {
  readonly leaseId: string;
  readonly kind: HandoverKind;
  readonly areas: readonly HandoverArea[];
  /**
   * The rooms this acta starts with when it has none of its own.
   *
   * For a **devolución** these are the check-in's, and that is the whole point of the format: an
   * acta that names different rooms than the one it is compared against is an acta that compares
   * nothing. Empty for a check-in, which starts from the menu.
   */
  readonly seed: readonly string[];
  readonly onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<readonly DraftArea[]>(() =>
    areas.length > 0
      ? areas.map((area) => ({ ...area, kept: [...area.photos] }))
      : seed.map((name) => newArea(name)),
  );
  /*
   * **One registry per editor, in a ref, not a module constant.** The first version put the `Map` at
   * module scope, which is a bug with two names: the check-in and the check-out editors can be open
   * on the same page, and area ids are unique per acta but the map is not — so one acta's save would
   * upload the other's photos. In a ref because nothing renders from it; holding functions in state
   * would re-render every area each time one registered.
   */
  const uploaders = useRef<Map<string, Uploader>>(new Map());

  function update(id: string, change: Partial<DraftArea>) {
    setDraft((all) => all.map((area) => (area.id === id ? { ...area, ...change } : area)));
  }

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-border bg-background p-4">
      <ul className="space-y-4">
        {draft.map((area) => (
          <AreaEditor
            key={area.id}
            area={area}
            disabled={pending}
            onChange={(change) => update(area.id, change)}
            onRemove={() => setDraft((all) => all.filter((one) => one.id !== area.id))}
            uploaders={uploaders}
          />
        ))}
      </ul>

      {draft.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empieza por el primer espacio. Puedes elegir uno de los habituales o escribir el nombre que
          quieras.
        </p>
      ) : null}

      {/*
        **Elegir el espacio de una lista, no escribirlo en un campo vacío.**

        La primera versión era un `<input list="…">` con un `<datalist>` detrás, que es lo peor de las
        dos cosas: en pantalla se ve un campo de texto vacío, y las sugerencias solo aparecen si por
        casualidad empiezas a teclear el nombre exacto. Nadie sabe que están.

        Y aquí la consistencia de los nombres no es estética: la devolución se lee **al lado** de la
        entrega, así que "Habitación principal" en una y "Alcoba" en la otra es una comparación que no
        se puede hacer. Un menú hace que lo habitual sea lo consistente, y "Otro espacio" deja escribir
        un patio o un depósito sin pelear con el control.
      */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            disabled={pending || draft.length >= MAX_HANDOVER_AREAS}
          >
            <PlusIcon aria-hidden="true" />
            Agregar espacio
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          {SUGGESTED_AREAS.map((name) => (
            <DropdownMenuItem
              key={name}
              onSelect={() => setDraft((all) => [...all, newArea(name)])}
            >
              {name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Con el nombre vacío, el campo de la tarjeta nueva es donde se escribe. */}
          <DropdownMenuItem onSelect={() => setDraft((all) => [...all, newArea("")])}>
            Otro espacio…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          variant="brand"
          size="xl"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                /*
                 * Uploads first, then one write. The order matters: the action refuses an acta whose
                 * photos are not in the bucket, so a write that raced the uploads would be refused
                 * with a message about files the person can see on their screen.
                 */
                const payload = [];
                for (const area of draft) {
                  const uploader = uploaders.current.get(area.id);
                  const fresh = uploader ? await uploader() : [];
                  payload.push({
                    id: area.id,
                    name: area.name,
                    condition: area.condition,
                    note: area.note,
                    photos: [...area.kept, ...fresh],
                  });
                }

                const result = await saveHandoverDraft(leaseId, kind, { areas: payload });
                if (!result.ok) {
                  setError(result.message);

                  return;
                }
                onDone();
                router.refresh();
              } catch (thrown) {
                setError(uploadError(thrown));
              }
            })
          }
        >
          {pending ? "Guardando…" : "Guardar el acta"}
        </Button>
        <Button variant="ghost" size="xl" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One area's upload function, registered by the child and called once by the save. */
type Uploader = () => Promise<HandoverArea["photos"][number][]>;
type UploaderRegistry = { current: Map<string, Uploader> };

function newArea(name: string): DraftArea {
  return { id: crypto.randomUUID(), name, condition: "good", note: "", kept: [] };
}

function AreaEditor({
  area,
  disabled,
  onChange,
  onRemove,
  uploaders,
}: {
  readonly area: DraftArea;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<DraftArea>) => void;
  readonly onRemove: () => void;
  readonly uploaders: UploaderRegistry;
}) {
  const { picked, pick, drop, uploadAll } = usePickedFiles(HANDOVER_PICKER);
  const [pickError, setPickError] = useState<string | null>(null);

  /*
   * Registered in an effect, never during render. The first version called `register(...)` in the
   * body, which is a side effect in a render pass — it happens to work and it is exactly what
   * React's rules forbid, because a render can run twice. The cleanup is what keeps a removed area
   * from leaving its uploader behind for the save to call.
   */
  useEffect(() => {
    const registry = uploaders.current;
    const upload: Uploader = () => uploadAll(() => {});
    registry.set(area.id, upload);

    return () => {
      registry.delete(area.id);
    };
  }, [uploaders, area.id, uploadAll]);

  return (
    <li data-slot="handover-area" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor={`area-${area.id}`}>Espacio</Label>
          {/*
            Un campo de texto y nada más — sin `list`, que es lo que lo hacía parecer un selector sin
            serlo. Aquí se corrige un nombre o se escribe el de un espacio que no está en el menú.
          */}
          <Input
            id={`area-${area.id}`}
            value={area.name}
            disabled={disabled}
            placeholder="Cocina"
            onChange={(event) => onChange({ name: event.target.value })}
            className="mt-1.5"
          />
        </div>
        <Button
          variant="ghost"
          size="lg"
          disabled={disabled}
          aria-label={`Quitar ${area.name || "el espacio"}`}
          onClick={onRemove}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </div>

      {/*
        Un `radiogroup` y no un `select`: son tres opciones y la que importa —"con daños"— tiene que
        estar a la vista, no detrás de un despliegue. Es la que se discute seis meses después.
      */}
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-foreground">Cómo está</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {AREA_CONDITIONS.map((condition) => (
            <label
              key={condition}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors",
                /*
                  El input va `sr-only` — accesible y navegable — pero entonces **el foco no se ve
                  en ninguna parte**: el anillo lo dibujaría el input, que no ocupa espacio. Sin
                  esto, quien navega con el teclado puede cambiar el estado de un espacio sin saber
                  en cuál está. Lo destapó Playwright al negarse a hacer clic en el input oculto.
                */
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                area.condition === condition
                  ? "border-brand-panel bg-secondary text-secondary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name={`condition-${area.id}`}
                value={condition}
                checked={area.condition === condition}
                disabled={disabled}
                onChange={() => onChange({ condition })}
                className="sr-only"
              />
              {AREA_CONDITION_LABELS[condition]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3">
        <Label htmlFor={`note-${area.id}`}>Detalle (opcional)</Label>
        <textarea
          id={`note-${area.id}`}
          rows={2}
          value={area.note}
          disabled={disabled}
          placeholder="Rayón de 10 cm en la puerta del mueble bajo."
          onChange={(event) => onChange({ note: event.target.value })}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </div>

      <PhotoPicker
        id={`fotos-${area.id}`}
        picked={picked}
        keptCount={area.kept.length}
        disabled={disabled}
        onPick={(files) => setPickError(pick(files))}
        onDrop={drop}
      />
      {pickError ? (
        <p role="alert" className="mt-1.5 text-sm text-destructive">
          {pickError}
        </p>
      ) : null}
    </li>
  );
}

/** The pick button and the previews. Photos only — see `HANDOVER_PHOTO_TYPES`. */
function PhotoPicker({
  id,
  picked,
  keptCount,
  disabled,
  onPick,
  onDrop,
}: {
  readonly id: string;
  readonly picked: readonly Picked[];
  readonly keptCount: number;
  readonly disabled: boolean;
  readonly onPick: (files: FileList | null) => void;
  readonly onDrop: (target: Picked) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-3 space-y-2">
      {picked.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {picked.map((one) => (
            <li key={one.preview} className="overflow-hidden rounded-lg border border-border">
              <Image
                src={one.preview}
                alt={one.file.name}
                width={320}
                height={240}
                unoptimized
                className="aspect-4/3 w-full bg-muted object-cover"
              />
              <div className="flex items-center justify-between gap-1 p-2">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {formatBytes(one.file.size)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Quitar ${one.file.name}`}
                  onClick={() => onDrop(one)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        data-slot="handover-photos"
        onChange={(event) => {
          onPick(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="lg"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlusIcon aria-hidden="true" />
        Agregar fotos
      </Button>
      <p className="text-xs text-muted-foreground">
        Hasta {MAX_AREA_PHOTOS} por espacio, de 8 MB cada una.
        {keptCount > 0 ? ` Ya hay ${keptCount} guardada${keptCount === 1 ? "" : "s"}.` : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the tenant's answer
// ---------------------------------------------------------------------------

const OBJECTION_PICKER = {
  max: MAX_OBJECTION_PHOTOS,
  problemOf: handoverPhotoProblem,
  folderOf: handoverFolder,
  tooMany: (room: number) =>
    room === 0
      ? `Ya adjuntaste ${MAX_OBJECTION_PHOTOS} fotos, que es el máximo.`
      : `Hasta ${MAX_OBJECTION_PHOTOS} fotos.`,
} as const;

/** What the tenant writes when the acta does not match what they see. */
function ObjectionForm({
  leaseId,
  kind,
  onDone,
}: {
  readonly leaseId: string;
  readonly kind: HandoverKind;
  readonly onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { picked, pick, drop, clear, uploadAll } = usePickedFiles(OBJECTION_PICKER);

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-border bg-background p-4">
      <div>
        <Label htmlFor="acta-observaciones">Qué no coincide</Label>
        <textarea
          id="acta-observaciones"
          rows={4}
          maxLength={OBJECTION_NOTE_MAX}
          value={note}
          disabled={pending}
          placeholder="La grieta del lavamanos del baño principal ya estaba cuando recibí el apartamento, y en el acta aparece como en buen estado."
          onChange={(event) => setNote(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Queda con la fecha y lo lee el propietario. Nombra el espacio del que hablas.
        </p>
      </div>

      <PhotoPicker
        id="acta-observaciones-fotos"
        picked={picked}
        keptCount={0}
        disabled={pending}
        onPick={(files) => setError(pick(files))}
        onDrop={drop}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="brand"
          size="xl"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const photos = await uploadAll(() => {});
                const result = await objectHandover(leaseId, kind, { note, photos });
                if (!result.ok) {
                  setError(result.message);

                  return;
                }
                clear();
                onDone();
                router.refresh();
              } catch (thrown) {
                setError(uploadError(thrown));
              }
            })
          }
        >
          {pending ? "Enviando…" : "Enviar observaciones"}
        </Button>
        <Button variant="ghost" size="xl" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
