"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Label } from "@/shared/ui/label";

import { rejectApplication, withdrawApplication } from "../actions/advance";
import { canClose, type Application, type ApplicationCopy } from "../domain/application";
import { AdvanceButton } from "./advance-button";

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
  blockedBecause,
  resolveAt,
  copy,
}: {
  readonly application: Application;
  readonly isLandlord: boolean;
  /**
   * Why the process cannot move on yet, in words. `null` means it can.
   *
   * The reason is computed by whoever knows it — the page — and passed in, because the obstacle
   * lives in another feature's rules and this component's job is to *say* it, not to work it out.
   */
  readonly blockedBecause?: string | null;
  /** The id of the section that has to be dealt with, so the button can point at it. */
  readonly resolveAt?: string;
  /**
   * The process's vocabulary, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: ApplicationCopy;
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

  return (
    /*
      Asidero estable: desde que el botón de seguir vive también al pie de su etapa, un selector
      suelto por "Continuar a" encuentra dos, y los drivers que hablaban de *esta* barra empezaron a
      fallar por ambigüedad. Aquí se dice cuál es esta.
    */
    <div data-slot="stage-actions" className="space-y-3">
      {/*
        The reject button sits at the far end of the row, not beside the primary one: they are
        opposite decisions, and putting them shoulder to shoulder is how somebody ends a process
        with a misplaced click. Same size, though — pushing it away is enough, making it small
        as well would be pretending it is a lesser option than it is.
      */}
      <div className="flex flex-wrap items-center gap-2">
        {/*
          El mismo control que va al pie de la etapa, no una copia: `AdvanceButton` es el único
          sitio donde se decide qué dice el botón y qué pasa al pulsarlo. Aquí arriba se renderiza
          también bloqueado, con el motivo, porque este es el sitio al que se viene a averiguar qué
          falta; al pie de la etapa solo aparece cuando ya se puede seguir.
        */}
        {isLandlord ? (
          <AdvanceButton
            copy={copy}
            application={application}
            blockedBecause={blockedBecause}
            describedById={`${application.id}-blocked`}
          />
        ) : null}

        {canClose(application) ? (
          <Button
            type="button"
            variant="destructive"
            size="xl"
            disabled={pending}
            onClick={() => setConfirming(isLandlord ? "reject" : "withdraw")}
            className="sm:ml-auto"
          >
            <XIcon aria-hidden="true" />
            {isLandlord ? "Rechazar postulación" : "Retirar mi postulación"}
          </Button>
        ) : null}
      </div>

      {/*
        The same sentence as the tooltip, in the page. A tooltip is a hint, not the only copy of
        something someone needs — it does not exist on a touch screen at all. The button beside
        it is what takes them there and marks the spot.
      */}
      {blockedBecause ? (
        <p
          id={`${application.id}-blocked`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
        >
          {blockedBecause}
          {resolveAt ? (
            <button
              type="button"
              onClick={() => pointAtBlocker(resolveAt)}
              className="font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-accent"
            >
              Ver qué falta
            </button>
          ) : null}
        </p>
      ) : null}

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
            <strong className="text-foreground">{copy.stageLabels[application.stage]}</strong> y el
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

/**
 * Takes the person to what is in the way, and makes it obvious which thing it is.
 *
 * Scrolling alone is not enough on a long page: it leaves you looking at a screen that changed
 * without telling you what changed. The outline is the "this one" — three seconds, then gone,
 * because a permanent highlight becomes furniture.
 */
function pointAtBlocker(id?: string): void {
  if (!id) return;

  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("ring-3", "ring-accent", "ring-offset-4", "ring-offset-background");
  window.setTimeout(() => {
    target.classList.remove("ring-3", "ring-accent", "ring-offset-4", "ring-offset-background");
  }, 3000);
}
