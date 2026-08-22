import { CheckIcon, ClockIcon, LockIcon } from "lucide-react";

import { stageAnchor } from "@/features/notification/client";
import { cn } from "@/shared/lib/utils";

import {
  isUnbuilt,
  stageDescription,
  stageProgress,
  stageProgressLabel,
  stageState,
  STAGES,
  STAGE_LABELS,
  type Application,
} from "../domain/application";

const STATE_BADGE = {
  done: "Listo",
  current: "En curso",
  pending: "Pendiente",
} as const;

/**
 * The nine stages, with the process's own place in them.
 *
 * Every stage is shown, including the ones that have nothing behind them yet: a tenant needs to
 * know what is coming, and a process with holes in it is worse than one that says which parts
 * are not built. Those carry a note saying they happen off the platform for now — the landlord
 * still records them here, which is what keeps the two people looking at the same thing.
 */
export function StageTimeline({
  application,
  isLandlord,
}: {
  readonly application: Application;
  readonly isLandlord: boolean;
}) {
  const stopped = application.status !== "open";

  return (
    <section aria-label="Etapas del proceso" className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-primary dark:text-foreground">El proceso</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {stageProgressLabel(application.stage)}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STAGES.length}
        aria-valuenow={STAGES.indexOf(application.stage) + 1}
        aria-label="Avance del proceso"
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", stopped ? "bg-muted-foreground/40" : "bg-accent")}
          style={{ width: `${Math.round(stageProgress(application.stage) * 100)}%` }}
        />
      </div>

      <ol className="space-y-3">
        {STAGES.map((stage) => {
          const state = stopped && stageState(stage, application.stage) === "current"
            ? "pending"
            : stageState(stage, application.stage);
          const done = state === "done";
          const current = state === "current";

          return (
            // The anchor a notification links to: `#etapa-<stage>` lands here, not at the top.
            <li key={stage} id={stageAnchor(stage)} className="flex scroll-mt-20 gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-transparent bg-accent text-accent-foreground",
                    current && "border-accent bg-accent/15 text-accent",
                    !done && !current && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-4" /> : STAGES.indexOf(stage) + 1}
                </span>
                {/* The line that makes it read as a sequence rather than a list of cards. */}
                {stage !== STAGES.at(-1) && (
                  <span
                    aria-hidden="true"
                    className={cn("mt-1 w-px flex-1", done ? "bg-accent" : "bg-border")}
                  />
                )}
              </div>

              <div
                className={cn(
                  "mb-1 min-w-0 flex-1 rounded-xl border p-4",
                  current ? "border-accent bg-card" : "border-border bg-card",
                  !done && !current && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-foreground">{STAGE_LABELS[stage]}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      done && "bg-status-approved-bg text-status-approved",
                      current && "bg-accent/15 text-accent",
                      !done && !current && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <CheckIcon className="mr-1 inline size-3" aria-hidden="true" />
                    ) : current ? (
                      <ClockIcon className="mr-1 inline size-3" aria-hidden="true" />
                    ) : null}
                    {STATE_BADGE[state]}
                  </span>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {stageDescription(stage, isLandlord)}
                </p>

                {current && isUnbuilt(stage) ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Esta etapa todavía ocurre por fuera de la plataforma: háblenlo directamente
                      y {isLandlord ? "márcala aquí" : "el propietario la marca aquí"} cuando esté
                      lista.
                    </span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
