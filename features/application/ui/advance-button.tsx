"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { advanceApplication } from "../actions/advance";
import { canAdvance, nextStage, STAGE_LABELS, type Application } from "../domain/application";

/**
 * The one control that moves the process on, wherever it is rendered.
 *
 * It lives **twice on the page**: at the top, beside "Rechazar postulación", and again at the foot
 * of the stage being worked on — because the answer to "am I done with this step?" is at the bottom
 * of the step, and scrolling back up past eight cards to press a button about the thing you just
 * finished is a scroll that means nothing. Its own component precisely so the two are the *same*
 * control: the label names the stage it moves to, and a copy that drifted from it would be a second
 * button claiming to do the same thing and doing it differently.
 *
 * **The two are not equivalent, though, and the difference is deliberate.** The one at the top is
 * always there, and when the stage is blocked it stays visible and explains why — that is where
 * somebody looks to find out what is missing. The one at the foot of the stage renders **only when
 * the step is done and the process can move on**: a card that ends in a disabled button is a card
 * that ends in a "no", and the reason for the "no" is already written above it.
 *
 * It is also the one place in the product where two `accent` buttons can be on screen at once, and
 * the rule survives it: they are not two calls to action competing for a decision, they are the same
 * call to action within reach twice.
 */
export function AdvanceButton({
  application,
  blockedBecause = null,
  describedById,
}: {
  readonly application: Application;
  /**
   * Why it cannot move on, in words, or `null`.
   *
   * Computed by the page — the obstacle belongs to another feature's rules — and this component's
   * job is to say it, never to work it out.
   */
  readonly blockedBecause?: string | null;
  /** The paragraph repeating the reason, so the blocked button points at it for a screen reader. */
  readonly describedById?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target = nextStage(application.stage);
  if (!canAdvance(application) || !target) return null;

  const label = `Continuar a “${STAGE_LABELS[target]}”`;

  if (blockedBecause) {
    /*
     * `aria-disabled`, not `disabled`: the reason has to stay reachable. A `disabled` button drops
     * out of the tab order and, in several browsers, stops firing hover — so the tooltip explaining
     * why becomes unreachable exactly when someone goes looking for it.
     *
     * What it does *not* do is act on a click. A control announced as unavailable that turns out to
     * do something is its own kind of lie, and assistive technology is not the only thing that
     * believes the announcement — Playwright refuses to click it too. So the way to the blocker is
     * a button of its own, right beside it.
     */
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="accent"
            size="xl"
            aria-disabled="true"
            aria-describedby={describedById}
            className="opacity-50"
          >
            {label}
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {blockedBecause}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="accent"
        size="xl"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await advanceApplication(application.id);
            if (!result.ok) {
              setError(result.message ?? "No pudimos actualizar el proceso.");
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Avanzando…" : label}
        <ArrowRightIcon aria-hidden="true" />
      </Button>

      {/* El fallo se dice donde se pulsó: el otro botón está a nueve tarjetas de aquí. */}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
