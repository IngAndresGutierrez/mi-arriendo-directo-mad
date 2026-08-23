"use client";

import { useState, useTransition } from "react";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils";

import { recordGuaranteePolicy, recordGuaranteeRequested } from "../actions/guarantee";
import {
  guaranteeState,
  GUARANTEE_COVERAGES,
  GUARANTEE_LIMIT_NOTE,
  GUARANTEE_PROVIDER,
  type Guarantee,
} from "../domain/guarantee";

/**
 * The guarantee stage: a rental insurance policy instead of a co-signer.
 *
 * The policy is bought on Sura's site — this product does not sell insurance and takes nothing
 * for pointing at it — so what the panel does is the part that is actually its job: say what the
 * policy answers for, hand over the two pieces of data their form asks for (both already on this
 * screen), and keep the record of what was taken out.
 *
 * The tenant sees the same coverages and the same state. It is their default the policy insures
 * and their inbox Sura writes to, so learning about it from the landlord's phone call would be
 * finding out last about something that is about them.
 */
export function GuaranteePanel({
  applicationId,
  guarantee,
  isLandlord,
  tenantEmail,
  registryNumber,
  readOnly = false,
}: {
  readonly applicationId: string;
  readonly guarantee: Guarantee | null;
  readonly isLandlord: boolean;
  /** The landlord's copy of what Sura asks for. Never rendered on the tenant's side. */
  readonly tenantEmail?: string;
  readonly registryNumber?: string;
  readonly readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [policyNumber, setPolicyNumber] = useState(guarantee?.policyNumber ?? "");
  const [note, setNote] = useState("");
  const state = guaranteeState(guarantee);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "No pudimos guardar el cambio.");
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
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              state === "active"
                ? "bg-status-approved-bg text-status-approved"
                : state === "requested"
                  ? "bg-status-current-bg text-status-current"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {state === "active" && <CheckIcon className="size-3" aria-hidden="true" />}
            {GUARANTEE_PROVIDER.product} · {GUARANTEE_PROVIDER.name}
          </span>
          <span className="text-xs font-medium text-foreground">Sin codeudor</span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {GUARANTEE_COVERAGES.map((coverage) => (
            <li key={coverage} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-status-approved" aria-hidden="true" />
              <span>{coverage}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {GUARANTEE_LIMIT_NOTE}
        </p>

        {guarantee?.policyNumber && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Póliza </span>
            <span className="font-medium text-foreground">{guarantee.policyNumber}</span>
          </p>
        )}
        {guarantee?.note && <p className="mt-1 text-sm text-muted-foreground">{guarantee.note}</p>}
      </div>

      {isLandlord && !readOnly ? (
        <div className="space-y-4">
          {/*
            Los dos datos que pide el formulario de Sura, listos para copiar. Están los dos en
            esta pantalla: el correo llegó con la cuenta del inquilino y la matrícula con el
            anuncio. Describirlos en vez de darlos sería mandar al propietario a buscarlos.
          */}
          <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">Lo que te van a pedir</p>
            <CopyRow label="Correo del inquilino" value={tenantEmail ?? ""} />
            <CopyRow label="Matrícula inmobiliaria" value={registryNumber ?? ""} />
            <Button asChild variant="accent" size="lg" className="mt-1">
              <a href={GUARANTEE_PROVIDER.quoteUrl} target="_blank" rel="noopener noreferrer">
                Cotizar en {GUARANTEE_PROVIDER.name}
                <ExternalLinkIcon aria-hidden="true" />
              </a>
            </Button>
          </div>

          {state === "none" && (
            <div className="space-y-2">
              <Label htmlFor="guarantee-request-note">Nota para el inquilino (opcional)</Label>
              <Input
                id="guarantee-request-note"
                className="h-11"
                placeholder="Ya la solicité, están estudiando el caso."
                value={note}
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={() => run(() => recordGuaranteeRequested(applicationId, { note }))}
              >
                {pending ? "Guardando…" : "Ya la solicité"}
              </Button>
            </div>
          )}

          {state !== "active" && (
            <div className="space-y-2">
              <Label htmlFor="guarantee-policy">Número de la póliza</Label>
              <Input
                id="guarantee-policy"
                className="h-11"
                placeholder="AR-99123"
                value={policyNumber}
                maxLength={40}
                onChange={(event) => setPolicyNumber(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Regístralo cuando {GUARANTEE_PROVIDER.name} expida la póliza. Sin eso el proceso no
                puede avanzar: una solicitud en estudio todavía no es una garantía.
              </p>
              <Button
                type="button"
                variant="accent"
                size="lg"
                disabled={pending || policyNumber.trim().length < 4}
                onClick={() => run(() => recordGuaranteePolicy(applicationId, { policyNumber, note }))}
              >
                {pending ? "Guardando…" : "Registrar la póliza"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        !isLandlord && (
          <p className="text-sm text-muted-foreground">
            {state === "none"
              ? `El propietario tomará una póliza de arrendamiento con ${GUARANTEE_PROVIDER.name}. No necesitas codeudor.`
              : state === "requested"
                ? `La póliza está en estudio. Puede que ${GUARANTEE_PROVIDER.name} te escriba a tu correo para completarlo.`
                : "La póliza quedó activa. El siguiente paso es la firma del contrato."}
          </p>
        )
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** One of Sura's two requirements, with the button that saves retyping it. */
function CopyRow({ label, value }: { readonly label: string; readonly value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede negarse (origen inseguro, permiso denegado): entonces el valor
      // queda a la vista para copiarlo a mano, que es lo que ya se ve arriba.
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          {copied ? "Copiado" : failed ? "Cópialo a mano" : "Copiar"}
        </Button>
      )}
    </div>
  );
}
