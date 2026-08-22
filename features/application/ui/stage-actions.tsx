"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Label } from "@/shared/ui/label";

import { advanceApplication, rejectApplication, withdrawApplication } from "../actions/advance";
import {
  canAdvance,
  canClose,
  nextStage,
  STAGE_LABELS,
  type Application,
} from "../domain/application";

/**
 * What each side can do with the process, from where it stands.
 *
 * The landlord moves it forward one stage at a time — the button names the stage it would move
 * to, because "Continuar" alone does not say what you are agreeing to. Rejecting and withdrawing
 * both go through a confirmation: they end the process for both people, and the reject dialog
 * asks for a reason, which is the difference between a rejection someone can learn from and a
 * door closing in silence.
 */
export function StageActions({
  application,
  isLandlord,
}: {
  readonly application: Application;
  readonly isLandlord: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"reject" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "No pudimos actualizar el proceso.");
        setConfirming(null);
        return;
      }
      setConfirming(null);
      setReason("");
      router.refresh();
    });
  }

  if (application.status !== "open") return null;

  const target = nextStage(application.stage);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {isLandlord && canAdvance(application) && target ? (
          <Button
            type="button"
            variant="accent"
            size="xl"
            disabled={pending}
            onClick={() => run(() => advanceApplication(application.id))}
          >
            Continuar a “{STAGE_LABELS[target]}”
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        ) : null}

        {canClose(application) ? (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={() => setConfirming(isLandlord ? "reject" : "withdraw")}
          >
            <XIcon aria-hidden="true" />
            {isLandlord ? "Rechazar postulación" : "Retirar mi postulación"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming === "reject"}
        onOpenChange={(open) => (open ? undefined : setConfirming(null))}
        title="¿Rechazar esta postulación?"
        description={
          <>
            El proceso se detiene en la etapa{" "}
            <strong className="text-foreground">{STAGE_LABELS[application.stage]}</strong> y el
            inquilino verá que lo rechazaste. No se puede deshacer.
            <span className="mt-3 block space-y-1.5">
              <Label htmlFor="reason" className="font-normal">
                Motivo (opcional, lo lee el inquilino)
              </Label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Por ejemplo: ya arrendé el inmueble."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </span>
          </>
        }
        confirmLabel="Rechazar postulación"
        pendingLabel="Rechazando…"
        onConfirm={() => run(() => rejectApplication(application.id, reason))}
      />

      <ConfirmDialog
        open={confirming === "withdraw"}
        onOpenChange={(open) => (open ? undefined : setConfirming(null))}
        title="¿Retirar tu postulación?"
        description="El propietario verá que la retiraste y el proceso se detiene. Si cambias de opinión tendrás que hablar con él directamente."
        confirmLabel="Retirar postulación"
        pendingLabel="Retirando…"
        onConfirm={() => run(() => withdrawApplication(application.id))}
      />
    </div>
  );
}
