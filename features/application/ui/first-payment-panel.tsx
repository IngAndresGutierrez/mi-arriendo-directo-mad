"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanknoteIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatBytes } from "@/shared/format/bytes";
import { formatBogotaDateTime, formatShortDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";

import { recordReceiptVerdict, savePayout, uploadReceipt } from "../actions/payout";
import {
  firstPaymentState,
  payoutShape,
  receiptFileProblem,
  verdictApplies,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  RECEIPT_CONTENT_TYPES,
  type FirstPayment,
  type PaymentReceipt,
  type PayoutMethod,
} from "../domain/payout";

/**
 * The first canon.
 *
 * **This product does not move the money and says so.** The landlord writes where to receive it, the
 * tenant transfers from their own bank and uploads the proof, and the landlord confirms it arrived.
 * What this stage keeps is the part that gets lost in a chat thread: where to pay, and the proof
 * that it happened, side by side.
 *
 * The amount shown is the one from the application, labelled as such: the contract is what governs
 * the canon and this product does not read it, so presenting a figure as authoritative would be
 * inventing one.
 */
export function FirstPaymentPanel({
  applicationId,
  payment,
  receipt,
  monthlyCost,
  isLandlord,
  readOnly = false,
}: {
  readonly applicationId: string;
  readonly payment: FirstPayment | null;
  /** The same receipt with a link signed for the next hour, or `null`. */
  readonly receipt: (PaymentReceipt & { readonly url: string }) | null;
  /** What the listing said when the tenant applied. A reference, not the contract. */
  readonly monthlyCost: number;
  readonly isLandlord: boolean;
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const state = firstPaymentState(payment);
  const payout = payment?.payout ?? null;
  const verdict = verdictApplies(payment) ? payment?.verdict : null;

  // --- el formulario del propietario ---
  const [method, setMethod] = useState<PayoutMethod>(payout?.method ?? "nequi");
  const [phone, setPhone] = useState(payout?.phone ?? "");
  const [key, setKey] = useState(payout?.key ?? "");
  const [accountType, setAccountType] = useState(payout?.accountType || "savings");
  const [accountNumber, setAccountNumber] = useState(payout?.accountNumber ?? "");
  const [bankName, setBankName] = useState(payout?.bankName ?? "");
  const [holderName, setHolderName] = useState(payout?.holderName ?? "");
  const [holderDocument, setHolderDocument] = useState(payout?.holderDocument ?? "");
  const [payoutNote, setPayoutNote] = useState(payout?.note ?? "");
  const [editing, setEditing] = useState(false);

  // --- el formulario del inquilino ---
  const [amount, setAmount] = useState(String(monthlyCost));
  const [paidOn, setPaidOn] = useState("");
  const [receiptNote, setReceiptNote] = useState("");

  // --- el rechazo ---
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const shape = payoutShape(method);

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
    body.set("note", receiptNote);

    run(async () => {
      const result = await uploadReceipt(applicationId, body);
      if (inputRef.current) inputRef.current.value = "";
      return result;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              state === "confirmed"
                ? "inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-0.5 text-xs font-medium text-status-approved"
                : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {state === "confirmed" ? (
              <CheckIcon className="size-3" aria-hidden="true" />
            ) : (
              <BanknoteIcon className="size-3" aria-hidden="true" />
            )}
            Primer canon
          </span>
          <span className="text-xs font-medium text-foreground">
            El pago es directo entre ustedes
          </span>
        </div>

        {/*
          El monto, etiquetado como referencia. El contrato es lo que manda sobre el canon y este
          producto no lo lee: presentar una cifra como autoritativa sería inventarla.
        */}
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Canon según la postulación: </span>
          <span className="font-medium text-foreground">{formatCOP(monthlyCost)}</span>
        </p>

        {payout ? (
          <dl className="mt-3 space-y-2 rounded-lg bg-muted p-3">
            <Row label="Método" value={payout.method === "other_bank" ? payout.bankName : PAYOUT_METHOD_LABELS[payout.method]} />
            {payout.phone && <Row label="Número" value={payout.phone} copyable />}
            {payout.key && <Row label="Llave Bre-B" value={payout.key} copyable />}
            {payout.accountType && (
              <Row label="Tipo de cuenta" value={ACCOUNT_TYPE_LABELS[payout.accountType]} />
            )}
            {payout.accountNumber && <Row label="Número de cuenta" value={payout.accountNumber} copyable />}
            <Row label="A nombre de" value={payout.holderName} />
            <Row label="Documento del titular" value={payout.holderDocument} />
            {payout.note && <Row label="Nota" value={payout.note} />}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLandlord
              ? "Escribe por dónde quieres recibir el primer canon. El inquilino verá estos datos para transferirte."
              : "El propietario va a indicar por dónde recibir el primer canon."}
          </p>
        )}

        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          No verificamos estos datos con ningún banco y no procesamos el pago: la transferencia
          ocurre entre ustedes. Comprueba el nombre del titular antes de transferir.
        </p>
      </div>

      {/* --- el comprobante --- */}
      {receipt && (
        <div className="space-y-2 rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">Comprobante</p>
          <a
            className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
            href={receipt.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileTextIcon className="size-4 shrink-0 text-brand-panel dark:text-brand-panel-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{receipt.fileName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(receipt.bytes)}</span>
            <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
          </a>
          <p className="text-sm text-muted-foreground">
            {formatCOP(receipt.amount)} · pagado el {formatShortDate(receipt.paidOn)} · subido el{" "}
            {formatBogotaDateTime(receipt.uploadedAt)}
          </p>
          {receipt.note && <p className="text-sm text-muted-foreground">{receipt.note}</p>}
          {verdict && (
            <p
              className={
                verdict.status === "confirmed"
                  ? "text-sm font-medium text-status-approved"
                  : "text-sm font-medium text-destructive"
              }
            >
              {verdict.status === "confirmed"
                ? `El propietario confirmó que recibió el canon el ${formatBogotaDateTime(verdict.at)}.`
                : `Rechazado: ${verdict.reason}`}
            </p>
          )}
        </div>
      )}

      {/* --- el propietario pone o corrige sus datos --- */}
      {isLandlord && !readOnly && (editing || !payout) && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Por dónde quieres recibirlo</p>

          <div className="space-y-2">
            <Label htmlFor="payout-method">Método</Label>
            <select
              id="payout-method"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={method}
              onChange={(event) => setMethod(event.target.value as PayoutMethod)}
            >
              {PAYOUT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {PAYOUT_METHOD_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          {shape.phone && (
            <Field
              id="payout-phone"
              label="Número de celular"
              hint="El que tienes registrado, 10 dígitos empezando por 3."
              value={phone}
              onChange={setPhone}
              inputMode="numeric"
            />
          )}
          {shape.key && (
            <Field
              id="payout-key"
              label="Tu llave Bre-B"
              hint="Puede ser un @alias, tu celular, tu correo o tu documento."
              value={key}
              onChange={setKey}
            />
          )}
          {shape.bankName && (
            <Field id="payout-bank" label="Nombre del banco" value={bankName} onChange={setBankName} />
          )}
          {shape.account && (
            <>
              <div className="space-y-2">
                <Label htmlFor="payout-account-type">Tipo de cuenta</Label>
                <select
                  id="payout-account-type"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={accountType}
                  onChange={(event) => setAccountType(event.target.value as (typeof ACCOUNT_TYPES)[number])}
                >
                  {ACCOUNT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {ACCOUNT_TYPE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="payout-account"
                label="Número de cuenta"
                value={accountNumber}
                onChange={setAccountNumber}
                inputMode="numeric"
              />
            </>
          )}

          {/*
            El titular se pide siempre y no se lee del perfil: la cuenta puede ser de un cónyuge, de
            una inmobiliaria o de una empresa, y un inquilino que transfiere a un nombre que no
            coincide con lo que decía la pantalla es un inquilino que cree que lo estafaron.
          */}
          <Field id="payout-holder" label="A nombre de" value={holderName} onChange={setHolderName} />
          <Field
            id="payout-holder-doc"
            label="Documento del titular"
            hint="Como lo pide tu banco: tipo y número."
            value={holderDocument}
            onChange={setHolderDocument}
          />
          <Field
            id="payout-note"
            label="Nota para el inquilino (opcional)"
            value={payoutNote}
            onChange={setPayoutNote}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              size="xl"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await savePayout(applicationId, {
                    method,
                    ...(shape.phone ? { phone } : {}),
                    ...(shape.key ? { key } : {}),
                    ...(shape.bankName ? { bankName } : {}),
                    ...(shape.account ? { accountType, accountNumber } : {}),
                    holderName,
                    holderDocument,
                    note: payoutNote,
                  });
                  if (result.ok) setEditing(false);
                  return result;
                })
              }
            >
              {pending ? "Guardando…" : "Guardar los datos de pago"}
            </Button>
            {payout && (
              <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {isLandlord && !readOnly && payout && !editing && (
        <Button type="button" variant="brand" size="xl" disabled={pending} onClick={() => setEditing(true)}>
          Cambiar los datos de pago
        </Button>
      )}

      {/* --- el inquilino sube su comprobante --- */}
      {!isLandlord && !readOnly && payout && state !== "confirmed" && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">
            {state === "rejected" ? "Sube otro comprobante" : "Sube tu comprobante"}
          </p>
          <Field
            id="receipt-amount"
            label="Cuánto transferiste"
            value={amount}
            onChange={setAmount}
            inputMode="numeric"
          />
          <div className="space-y-2">
            <Label htmlFor="receipt-date">Fecha del pago</Label>
            <Input
              id="receipt-date"
              type="date"
              className="h-11"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </div>
          <Field
            id="receipt-note"
            label="Nota (opcional)"
            value={receiptNote}
            onChange={setReceiptNote}
          />
          <input
            ref={inputRef}
            id="receipt-file"
            type="file"
            className="sr-only"
            accept={RECEIPT_CONTENT_TYPES.join(",")}
            disabled={pending}
            onChange={(event) => onPick(event.target.files)}
          />
          <Button
            type="button"
            variant="accent"
            size="xl"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon aria-hidden="true" />
            {pending ? "Subiendo…" : "Adjuntar la captura y enviar"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Una captura de la transferencia, o el PDF del banco. Hasta 8 MB.
          </p>
        </div>
      )}

      {/* --- el propietario responde --- */}
      {isLandlord && !readOnly && receipt && !verdict && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">¿Llegó el dinero?</p>
          <p className="text-sm text-muted-foreground">
            Compruébalo en tu cuenta, no solo en la captura: una transferencia puede reversarse o irse
            a otra llave y verse bien en la foto.
          </p>
          {rejecting ? (
            <>
              <Field
                id="verdict-reason"
                label="Qué tiene que corregir"
                value={reason}
                onChange={setReason}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="brand"
                  size="xl"
                  disabled={pending || reason.trim().length < 10}
                  onClick={() =>
                    run(() => recordReceiptVerdict(applicationId, { status: "rejected", reason }))
                  }
                >
                  {pending ? "Guardando…" : "Rechazar el comprobante"}
                </Button>
                <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={() => setRejecting(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="accent"
                size="xl"
                disabled={pending}
                onClick={() => run(() => recordReceiptVerdict(applicationId, { status: "confirmed" }))}
              >
                <CheckIcon aria-hidden="true" />
                {pending ? "Guardando…" : "Sí, lo recibí"}
              </Button>
              <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={() => setRejecting(true)}>
                <XIcon aria-hidden="true" />
                No llegó
              </Button>
            </div>
          )}
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

/** One line of the payout, with the copy button where the value is worth copying exactly. */
function Row({
  label,
  value,
  copyable = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2" data-slot="payout-row">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span className="break-all">{value}</span>
        {copyable && (
          <button
            type="button"
            aria-label={`Copiar ${label}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // El portapapeles puede negarse; el valor ya está a la vista para copiarlo a mano.
              }
            }}
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
}

/** Label + input with the ARIA already wired, so no form here repeats it by hand. */
function Field({
  id,
  label,
  hint,
  value,
  onChange,
  inputMode,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly inputMode?: "numeric" | "text";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-11"
        inputMode={inputMode}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={value}
        maxLength={300}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
