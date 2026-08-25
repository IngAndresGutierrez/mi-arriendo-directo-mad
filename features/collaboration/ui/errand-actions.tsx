"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormAlert } from "@/shared/form/form-alert";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

import { acceptErrand, completeErrand, declineErrand } from "../actions/errand";
import { availableActions, type Errand } from "../domain/errand";

/**
 * What the collaborator can do with one errand.
 *
 * **The buttons come from `availableActions`, the same function the Server Action checks.** That is
 * the point of it returning a list rather than the screen deciding for itself: a control the server
 * would refuse is a lie, and two copies of "when may this be accepted?" are two things that drift.
 *
 * Once it is closed this renders nothing at all — not a row of disabled buttons. A control that no
 * longer changes anything is the same lie as a "Continuar" that does not continue, which is why the
 * process page strips the buttons off a finished stage instead of greying them.
 */
export function ErrandActions({ errand }: { readonly errand: Errand }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<"decline" | "complete" | null>(null);
  const [note, setNote] = useState("");

  const actions = availableActions(errand);
  if (actions.length === 0) return null;

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "No pudimos guardarlo.");
        return;
      }
      setAsking(null);
      setNote("");
      router.refresh();
    });
  }

  if (asking) {
    const declining = asking === "decline";

    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <Label htmlFor="errand-note" className="block">
          {declining ? "¿Por qué no puedes?" : "¿Algo que contar? (opcional)"}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {declining
            ? "Una frase basta. Al propietario le sirve para buscar otra opción a tiempo."
            : "Si pasó algo que el propietario deba saber, escríbelo aquí."}
        </p>

        {/*
          A plain `<textarea>`, like every other note field in this product. `radix-nova` ships no
          textarea, and adding one through `shadcn add` rewrites the dependencies of what it touches
          — which is how `button.tsx` silently lost its `accent` variant once before.
        */}
        <textarea
          id="errand-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={isPending}
          className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="accent"
            size="xl"
            disabled={isPending || (declining && note.trim().length < 4)}
            onClick={() =>
              run(() =>
                declining
                  ? declineErrand({ errandId: errand.id, reason: note })
                  : completeErrand({ errandId: errand.id, note, evidence: [] }),
              )
            }
          >
            {declining ? "Rechazar el encargo" : "Marcar terminado"}
          </Button>
          <Button variant="outline" size="xl" disabled={isPending} onClick={() => setAsking(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="mt-3 flex flex-wrap gap-3">
        {actions.includes("accept") && (
          /*
            One `accent` per view, and on this screen it is confirming: that is what the landlord is
            waiting for and what the message asked the person to do. Rechazar is a real control and
            not furniture, so it is `brand` rather than `outline`.
          */
          <Button
            variant="accent"
            size="xl"
            disabled={isPending}
            onClick={() => run(() => acceptErrand({ errandId: errand.id }))}
          >
            Confirmar que voy
          </Button>
        )}

        {actions.includes("complete") && (
          <Button variant="accent" size="xl" disabled={isPending} onClick={() => setAsking("complete")}>
            Marcar terminado
          </Button>
        )}

        {actions.includes("decline") && (
          <Button variant="brand" size="xl" disabled={isPending} onClick={() => setAsking("decline")}>
            No puedo
          </Button>
        )}
      </div>
    </div>
  );
}
