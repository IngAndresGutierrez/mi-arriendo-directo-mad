"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { receiptFileProblem, RECEIPT_CONTENT_TYPES } from "@/features/application/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { AmountField } from "@/shared/form/amount-field";
import { formatBytes } from "@/shared/format/bytes";
import { formatBogotaDateTime, formatShortDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import { recordCanonVerdict, uploadCanonReceipt } from "../actions/canon";
import {
  isOpen,
  periodAnchor,
  periodLabel,
  periodTitle,
  PERIOD_STATE_LABELS,
  type Period,
  type PeriodState,
  type ScheduledMonth,
} from "../domain/lease";

/**
 * One month, in the shape that crosses from the server: the calendar entry, whatever document
 * exists for it, its state and a receipt link that already works.
 *
 * Plain objects on purpose — no `Map`, no `Timestamp`, no signing left to do. Working the state out
 * here would mean the client needed today's date in Bogotá, and a browser clock is the one thing on
 * this page that neither party controls.
 */
export type MonthRow = {
  readonly month: ScheduledMonth;
  readonly stored: Period | null;
  readonly state: PeriodState;
  readonly receipt: (Period["receipt"] & { readonly url: string }) | null;
};

const BADGE: Readonly<Record<PeriodState, string>> = {
  upcoming: "bg-muted text-muted-foreground",
  due: "bg-status-pending-bg text-status-pending",
  overdue: "bg-status-overdue-bg text-status-overdue",
  in_review: "bg-status-current-bg text-status-current",
  rejected: "bg-status-rejected-bg text-status-rejected",
  paid: "bg-status-approved-bg text-status-approved",
};

/**
 * The months of the tenancy, newest first.
 *
 * **The month that needs something comes out of the list and sits above it**, with the one cyan
 * button on the page. The rest is the record: rows that fold open to show what was uploaded and
 * what was answered, with their controls in `brand` — because a tenant with three months overdue
 * still has to be able to pay the other two, and three cyan buttons is none.
 *
 * Every row carries the anchor of its own month, so a notification about September lands on
 * September instead of at the top of a page with twelve of them.
 */
export function MonthList({
  leaseId,
  rows,
  focus,
  isLandlord,
}: {
  readonly leaseId: string;
  /** In calendar order, oldest first. This component reverses for display. */
  readonly rows: readonly MonthRow[];
  /** The month that gets the emphasis, decided on the server. `null` when nothing is owed. */
  readonly focus: string | null;
  readonly isLandlord: boolean;
}) {
  const focused = rows.find((row) => row.month.id === focus) ?? null;

  /*
   * El registro va del mes en curso hacia atrás, y **el futuro no se lista fila por fila**.
   *
   * La primera versión ponía los doce meses del término, así que nueve filas de "Por venir" — meses
   * en los que no hay nada que hacer y nada que mirar — se sentaban encima de los dos que se deben.
   * Se muestra hasta el siguiente por vencer, que es el único futuro sobre el que alguien puede
   * actuar (pagar adelantado), y el resto del término se resume en una frase: cuántos meses quedan y
   * hasta cuándo. La cuenta del encabezado sigue siendo la del término completo, porque es el dato.
   */
  const past = rows.filter((row) => row.state !== "upcoming");
  const upcoming = rows.filter((row) => row.state === "upcoming");
  const [next, ...later] = upcoming;
  const listed = [...past, ...(next ? [next] : [])].reverse();

  return (
    <div className="space-y-6">
      {focused ? (
        <section
          id={periodAnchor(focused.month.id)}
          data-month={focused.month.id}
          data-state={focused.state}
          aria-labelledby="focus-month-heading"
          className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 ring-1 ring-accent/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="focus-month-heading"
              className="font-semibold text-primary dark:text-foreground"
            >
              {periodTitle(focused.month.id)}
            </h2>
            <Badge state={focused.state} />
          </div>
          <MonthBody
            leaseId={leaseId}
            row={focused}
            isLandlord={isLandlord}
            emphasis="accent"
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold text-primary dark:text-foreground">Estás al día</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLandlord
              ? "No hay ningún comprobante esperando respuesta ni ningún mes vencido."
              : "No hay ningún mes pendiente de pago. El siguiente aparecerá aquí cuando llegue su fecha."}
          </p>
        </section>
      )}

      <section aria-labelledby="months-heading">
        <h2
          id="months-heading"
          className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Mes a mes ({rows.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {listed.map((row) => (
            <MonthRowItem
              key={row.month.id}
              leaseId={leaseId}
              row={row}
              isLandlord={isLandlord}
              isFocus={row.month.id === focus}
            />
          ))}
        </ul>

        {later.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {later.length === 1
              ? `Queda un mes más del término, hasta ${periodLabel(later[0].month.id)}.`
              : `Quedan ${later.length} meses más del término, hasta ${periodLabel(later[later.length - 1].month.id)}.`}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Badge({ state }: { readonly state: PeriodState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE[state],
      )}
    >
      {PERIOD_STATE_LABELS[state]}
    </span>
  );
}

/**
 * One row of the record, folded shut.
 *
 * The header carries the state, so what a click reveals is the controls and not the news — the same
 * reasoning the stage panels follow. Twelve rows each unfolding on their own would be a page nobody
 * can see the shape of.
 */
function MonthRowItem({
  leaseId,
  row,
  isLandlord,
  isFocus,
}: {
  readonly leaseId: string;
  readonly row: MonthRow;
  readonly isLandlord: boolean;
  readonly isFocus: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `mes-panel-${row.month.id}`;

  return (
    /*
     * `data-month` y `data-state` no son decoración: son cómo un driver pregunta al producto en qué
     * estado quedó un mes en vez de volver a calcularlo. Una aserción que repite la regla es una
     * segunda copia de la regla, y la primera en separarse es la que nadie mira.
     */
    <li
      id={isFocus ? undefined : periodAnchor(row.month.id)}
      data-month={row.month.id}
      data-state={row.state}
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
          <span className="block font-medium text-foreground">{periodTitle(row.month.id)}</span>
          <span className="block text-xs text-muted-foreground">
            {formatCOP(row.stored?.amount ?? row.month.amount)} · vence el{" "}
            {formatShortDate(row.stored?.dueDate ?? row.month.dueDate)}
          </span>
        </span>
        <Badge state={row.state} />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border p-4">
          <MonthBody leaseId={leaseId} row={row} isLandlord={isLandlord} emphasis="brand" />
        </div>
      ) : null}
    </li>
  );
}

/**
 * What can be done about one month, and what already was.
 *
 * The tenant uploads; the landlord answers. Neither can do the other's action, and a month that is
 * settled keeps its record with the buttons gone — a control that no longer changes anything is the
 * same lie as a "Continuar" that does not continue.
 */
function MonthBody({
  leaseId,
  row,
  isLandlord,
  emphasis,
}: {
  readonly leaseId: string;
  readonly row: MonthRow;
  readonly isLandlord: boolean;
  /** `accent` for the one month that owns the screen; `brand` for every other. */
  readonly emphasis: "accent" | "brand";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState(String(row.stored?.amount ?? row.month.amount));
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  /*
   * **El registro se lee del documento, el enlace de la URL firmada.**
   *
   * Firmar una URL puede fallar — un fichero borrado, Cloud Storage caído, un entorno sin cuenta de
   * servicio — y la primera versión de esto colgaba todo el bloque de la firma: cuando fallaba
   * desaparecían el nombre, el monto, la fecha *y el veredicto* del mes, y con ellos la única prueba
   * de que se había pagado. Lo que se pierde cuando no se puede firmar es poder abrir el archivo, y
   * nada más.
   */
  const receipt = row.stored?.receipt ?? null;
  const verdict = row.state === "paid" || row.state === "rejected" ? row.stored?.verdict : null;
  const awaitingAnswer = row.state === "in_review";
  const canUpload = !isLandlord && isOpen(row.state) && row.state !== "in_review";
  const hasReceipt = receipt !== null;

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
    const file = files?.[0];
    if (!file) return;

    const problem = receiptFileProblem({ type: file.type, size: file.size });
    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";

      return;
    }
    if (!paidOn) {
      setError("Escribe la fecha del pago antes de subir el comprobante.");
      if (inputRef.current) inputRef.current.value = "";

      return;
    }

    const body = new FormData();
    body.set("receipt", file);
    body.set("amount", amount);
    body.set("paidOn", paidOn);
    body.set("note", note);

    run(async () => {
      const result = await uploadCanonReceipt(leaseId, row.month.id, body);
      if (inputRef.current) inputRef.current.value = "";

      return result;
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* --- lo que ya pasó --- */}
      {receipt ? (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileTextIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{receipt.fileName}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCOP(receipt.amount)} · pagado el {formatShortDate(receipt.paidOn)} ·{" "}
                {formatBytes(receipt.bytes)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Subido el {formatBogotaDateTime(receipt.uploadedAt)}
              </p>
              {receipt.note ? <p className="mt-2 text-sm text-foreground">{receipt.note}</p> : null}
            </div>
            {/* Un enlace firmado por una hora: el comprobante lleva un número de cuenta. */}
            {row.receipt ? (
              <Button asChild variant="outline" size="xl">
                <a href={row.receipt.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  Ver el comprobante
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                No pudimos abrir el archivo ahora mismo. Recarga en un momento.
              </p>
            )}
          </div>

          {verdict ? (
            <p
              className={cn(
                "mt-3 border-t border-border pt-3 text-sm",
                verdict.status === "confirmed" ? "text-status-approved" : "text-status-rejected",
              )}
            >
              <span className="font-medium">
                {verdict.status === "confirmed"
                  ? "El propietario confirmó que el dinero llegó"
                  : "El propietario rechazó el comprobante"}
              </span>
              {verdict.reason ? <span className="text-foreground"> — {verdict.reason}</span> : null}
              <span className="block text-xs text-muted-foreground">
                {formatBogotaDateTime(verdict.at)}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- el veredicto del propietario --- */}
      {isLandlord && awaitingAnswer ? (
        rejecting ? (
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <div>
              <Label htmlFor={`reason-${row.month.id}`}>Por qué lo rechazas</Label>
              <Input
                id={`reason-${row.month.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Llegaron $200.000 de menos."
                className="mt-1.5"
              />
              {/* El inquilino lo lee: es lo único que le dice qué corregir. */}
              <p className="mt-1.5 text-xs text-muted-foreground">
                El inquilino lee este motivo. Es lo único que le dice qué corregir.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={emphasis}
                size="xl"
                disabled={pending}
                onClick={() =>
                  run(() => recordCanonVerdict(leaseId, row.month.id, { status: "rejected", reason }))
                }
              >
                {pending ? "Guardando…" : "Rechazar el comprobante"}
              </Button>
              <Button variant="ghost" size="xl" disabled={pending} onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={emphasis}
              size="xl"
              disabled={pending}
              onClick={() =>
                run(() => recordCanonVerdict(leaseId, row.month.id, { status: "confirmed" }))
              }
            >
              <CheckIcon className="size-4" aria-hidden="true" />
              {pending ? "Guardando…" : "Confirmar que llegó"}
            </Button>
            <Button variant="outline" size="xl" disabled={pending} onClick={() => setRejecting(true)}>
              <XIcon className="size-4" aria-hidden="true" />
              No llegó
            </Button>
          </div>
        )
      ) : null}

      {/* --- el comprobante del inquilino --- */}
      {canUpload ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/*
              El monto con separadores de miles mientras se escribe: un cero de más aquí es declarar
              diez veces el canon, y es el número que el propietario compara contra su banco. Mismo
              control que el primer canon y que el canon de un anuncio; devuelve dígitos crudos.
            */}
            <AmountField
              id={`amount-${row.month.id}`}
              label="Cuánto transferiste (COP)"
              value={amount}
              onChange={setAmount}
            />
            <div>
              <Label htmlFor={`paid-on-${row.month.id}`}>Fecha del pago</Label>
              <Input
                id={`paid-on-${row.month.id}`}
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`note-${row.month.id}`}>Nota (opcional)</Label>
            <Input
              id={`note-${row.month.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Transferencia desde Bancolombia"
              className="mt-1.5"
            />
          </div>

          <input
            ref={inputRef}
            id={`receipt-${row.month.id}`}
            type="file"
            accept={RECEIPT_CONTENT_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => onPick(event.target.files)}
          />
          <Button asChild variant={emphasis} size="xl" disabled={pending}>
            <label htmlFor={`receipt-${row.month.id}`}>
              <UploadIcon className="size-4" aria-hidden="true" />
              {pending
                ? "Subiendo…"
                : hasReceipt
                  ? "Subir otro comprobante"
                  : "Subir el comprobante"}
            </label>
          </Button>
          <p className="text-xs text-muted-foreground">
            Una imagen o un PDF, hasta 8 MB. El propietario lo revisa y confirma si el dinero llegó.
          </p>
        </div>
      ) : null}

      {/* --- lo que falta, dicho --- */}
      {!canUpload && !awaitingAnswer && row.state === "upcoming" ? (
        <p className="text-sm text-muted-foreground">
          Este mes vence el {formatShortDate(row.stored?.dueDate ?? row.month.dueDate)}.
        </p>
      ) : null}
      {awaitingAnswer && !isLandlord ? (
        <p className="text-sm text-muted-foreground">
          El propietario está revisando tu comprobante.
        </p>
      ) : null}
      {isLandlord && isOpen(row.state) && !awaitingAnswer ? (
        <p className="text-sm text-muted-foreground">
          {row.state === "rejected"
            ? "Rechazaste el comprobante. El inquilino tiene que subir otro."
            : "Falta que el inquilino pague y suba el comprobante."}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-status-rejected">
          {error}
        </p>
      ) : null}
    </div>
  );
}
