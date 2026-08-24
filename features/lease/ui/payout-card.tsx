"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, LandmarkIcon, PencilIcon } from "lucide-react";

import {
  payoutShape,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  type Payout,
  type PayoutMethod,
} from "@/features/application/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { saveLeasePayout } from "../actions/payout";

/**
 * Where the canon goes, every month.
 *
 * The tenancy inherits it from the first canon, so this is rarely empty and almost never new — what
 * it is for is month seven, when the landlord changes banks. That matters more than it sounds: the
 * alternative is telling the tenant a new account number over WhatsApp, which is the one message in
 * this whole product a stranger would most like to send in somebody else's name.
 *
 * **These details never leave in an email.** A message carrying somebody's account number is the
 * shape of every payment scam there is, and ours would arrive from a domain the tenant trusts. The
 * bell says the account changed; the account is read here, behind the session.
 */
export function PayoutCard({
  leaseId,
  payout,
  isLandlord,
}: {
  readonly leaseId: string;
  readonly payout: Payout | null;
  readonly isLandlord: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [method, setMethod] = useState<PayoutMethod>(payout?.method ?? "nequi");
  const [phone, setPhone] = useState(payout?.phone ?? "");
  const [key, setKey] = useState(payout?.key ?? "");
  const [accountType, setAccountType] = useState(payout?.accountType || "savings");
  const [accountNumber, setAccountNumber] = useState(payout?.accountNumber ?? "");
  const [bankName, setBankName] = useState(payout?.bankName ?? "");
  const [holderName, setHolderName] = useState(payout?.holderName ?? "");
  const [holderDocument, setHolderDocument] = useState(payout?.holderDocument ?? "");
  const [note, setNote] = useState(payout?.note ?? "");

  const shape = payoutShape(method);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveLeasePayout(leaseId, {
        method,
        ...(shape.phone ? { phone } : {}),
        ...(shape.key ? { key } : {}),
        ...(shape.account ? { accountType, accountNumber } : {}),
        ...(shape.bankName ? { bankName } : {}),
        holderName,
        ...(shape.holderDocument ? { holderDocument } : {}),
        note,
      });

      if (!result.ok) {
        setError(result.message);

        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="payout-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payout-heading" className="font-semibold text-primary dark:text-foreground">
            Por dónde se paga
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLandlord
              ? "El inquilino ve estos datos para transferirte cada mes."
              : "Transfiere a esta cuenta y sube el comprobante del mes."}
          </p>
        </div>

        {isLandlord && !editing ? (
          /* `brand` y no `accent`: la acción de esta pantalla es el mes, no cambiar de banco. */
          <Button variant="brand" size="xl" onClick={() => setEditing(true)}>
            <PencilIcon className="size-4" aria-hidden="true" />
            {payout ? "Cambiar la cuenta" : "Indicar la cuenta"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-4 rounded-xl border border-border bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payout-method">Cómo quieres recibirlo</Label>
              <select
                id="payout-method"
                value={method}
                onChange={(event) => setMethod(event.target.value as PayoutMethod)}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {PAYOUT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {PAYOUT_METHOD_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            {shape.phone ? (
              <div>
                <Label htmlFor="payout-phone">Número de la cuenta {PAYOUT_METHOD_LABELS[method]}</Label>
                <Input
                  id="payout-phone"
                  inputMode="numeric"
                  placeholder="3001234567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1.5"
                />
              </div>
            ) : null}

            {shape.key ? (
              <div>
                <Label htmlFor="payout-key">Tu llave Bre-B</Label>
                <Input
                  id="payout-key"
                  placeholder="@tullave"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  className="mt-1.5"
                />
              </div>
            ) : null}

            {shape.bankName ? (
              <div>
                <Label htmlFor="payout-bank">Nombre del banco</Label>
                <Input
                  id="payout-bank"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  className="mt-1.5"
                />
              </div>
            ) : null}

            {shape.account ? (
              <>
                <div>
                  <Label htmlFor="payout-account-type">Tipo de cuenta</Label>
                  <select
                    id="payout-account-type"
                    value={accountType}
                    onChange={(event) =>
                      setAccountType(event.target.value as (typeof ACCOUNT_TYPES)[number])
                    }
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {ACCOUNT_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {ACCOUNT_TYPE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="payout-account">Número de la cuenta</Label>
                  <Input
                    id="payout-account"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(event) => setAccountNumber(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </>
            ) : null}

            {/*
              El titular es un campo propio y no se lee del perfil: la cuenta puede ser de la pareja,
              de una inmobiliaria o de una sociedad, y un inquilino que transfiere a un nombre que no
              coincide con la pantalla es un inquilino que cree que lo estafaron.
            */}
            <div>
              <Label htmlFor="payout-holder">A nombre de</Label>
              <Input
                id="payout-holder"
                value={holderName}
                onChange={(event) => setHolderName(event.target.value)}
                className="mt-1.5"
              />
            </div>
            {/*
              El documento, **solo cuando el método es una transferencia bancaria**: a un Nequi, un
              Daviplata o una llave Bre-B se paga con el número o la llave, y la app enseña el nombre
              de quien recibe antes de confirmar. Pedirlo ahí sería guardar una cédula que nadie al
              otro lado va a usar, y el dato que no se guarda es el que no se puede filtrar.
            */}
            {shape.holderDocument ? (
              <div>
                <Label htmlFor="payout-holder-document">Documento del titular</Label>
                <Input
                  id="payout-holder-document"
                  placeholder="CC 1053812345"
                  value={holderDocument}
                  onChange={(event) => setHolderDocument(event.target.value)}
                  className="mt-1.5"
                />
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="payout-note">Nota para el inquilino (opcional)</Label>
            <Input
              id="payout-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1.5"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-status-rejected">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="xl" onClick={save} disabled={pending}>
              {pending ? "Guardando…" : "Guardar la cuenta"}
            </Button>
            <Button
              variant="ghost"
              size="xl"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : payout ? (
        <dl className="mt-4 space-y-2 rounded-xl bg-muted p-4">
          <Row
            label="Método"
            value={
              payout.method === "other_bank"
                ? payout.bankName
                : PAYOUT_METHOD_LABELS[payout.method]
            }
          />
          {payout.phone ? <Row label="Número" value={payout.phone} copyable /> : null}
          {payout.key ? <Row label="Llave Bre-B" value={payout.key} copyable /> : null}
          {payout.accountType ? (
            <Row label="Tipo de cuenta" value={ACCOUNT_TYPE_LABELS[payout.accountType]} />
          ) : null}
          {payout.accountNumber ? (
            <Row label="Número de cuenta" value={payout.accountNumber} copyable />
          ) : null}
          <Row label="A nombre de" value={payout.holderName} />
          {payout.holderDocument ? (
            <Row label="Documento del titular" value={payout.holderDocument} />
          ) : null}
          {payout.note ? <Row label="Nota" value={payout.note} /> : null}
        </dl>
      ) : (
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {isLandlord
            ? "Indica por dónde quieres recibir el canon: sin eso el inquilino no puede pagar."
            : "El propietario todavía no ha indicado por dónde recibir el canon."}
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <LandmarkIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          No verificamos estos datos con ningún banco y no procesamos el pago: la transferencia
          ocurre entre ustedes. Comprueba el nombre del titular antes de transferir.
        </span>
      </p>
    </section>
  );
}

/**
 * One line of the account, with a copy button on the values that get retyped into a bank app.
 *
 * The clipboard can refuse — an insecure origin, a withheld permission — so a failure leaves the
 * value on screen, which it already was: the button is a convenience, never the only way to read it.
 */
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
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium text-foreground">
        <span className="break-all">{value}</span>
        {copyable ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Copiar ${label.toLowerCase()}`}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(value)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </dd>
    </div>
  );
}
