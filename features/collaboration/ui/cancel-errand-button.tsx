"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormAlert } from "@/shared/form/form-alert";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

import { cancelErrand } from "../actions/errand";
import { isClosed, type Errand } from "../domain/errand";

/**
 * The landlord calls an errand off.
 *
 * **It disappears once the errand is closed**, rather than rendering disabled. A control that no
 * longer changes anything is the same lie as a "Continuar" that does not continue — the rule the
 * process page follows by stripping the buttons off a finished stage.
 *
 * **The reason is optional here and required when the collaborator declines**, and the asymmetry is
 * deliberate. A collaborator who backs out leaves a job that still has to be done by somebody, so
 * the landlord needs to know why in order to decide what to do next. A landlord calling something
 * off is exercising their own decision about their own property: making them justify it to the
 * person they are standing down would be asking for a courtesy the product cannot enforce anyway.
 * What they write is sent, so it is worth offering — and not worth demanding.
 */
export function CancelErrandButton({ errand }: { readonly errand: Errand }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isClosed(errand)) return null;

  if (asking) {
    return (
      <div className="mt-4 rounded-xl border border-border p-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <Label htmlFor={`cancel-${errand.id}`} className="block">
          ¿Por qué lo cancelas? (opcional)
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Se lo mandamos por WhatsApp y SMS, para que no vaya en vano.
        </p>

        <textarea
          id={`cancel-${errand.id}`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isPending}
          className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="xl"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await cancelErrand({ errandId: errand.id, reason });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setAsking(false);
                router.refresh();
              });
            }}
          >
            Cancelar el encargo
          </Button>
          <Button variant="outline" size="xl" disabled={isPending} onClick={() => setAsking(false)}>
            Dejarlo como está
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="lg"
      className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={() => setAsking(true)}
    >
      Cancelar el encargo
    </Button>
  );
}
