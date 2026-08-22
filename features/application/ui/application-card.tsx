import Link from "next/link";
import {
  BuildingIcon,
  CheckIcon,
  EyeIcon,
  ListChecksIcon,
  MinusIcon,
  XIcon,
} from "lucide-react";

import { applicationRoute, propertyDetailRoute } from "@/shared/auth/routes";
import { formatShortDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  applicationCode,
  stageDescription,
  stageIndex,
  stageProgressLabel,
  APPLICATION_STATUS_LABELS,
  STAGES,
  STAGE_LABELS,
  type Application,
} from "../domain/application";

/**
 * How this process looks at a glance: the tint of the icon, the badge on its corner and the word
 * in the chip all say the same thing, so it is legible before anything is read.
 *
 * `active` is not a status — a rental in course is still an open process — but it *is* the one
 * outcome worth celebrating, so it gets the green of a thing that worked instead of the blue of
 * a thing in motion.
 */
type Look = {
  readonly tint: string;
  readonly chip: string;
  readonly label: string;
  readonly badge: typeof CheckIcon | null;
  readonly badgeTint: string;
};

function lookOf(application: Application): Look {
  if (application.status === "rejected") {
    return {
      tint: "bg-destructive/10 text-destructive",
      chip: "bg-destructive/10 text-destructive",
      label: APPLICATION_STATUS_LABELS.rejected,
      badge: XIcon,
      badgeTint: "bg-destructive text-white",
    };
  }
  if (application.status === "withdrawn") {
    return {
      tint: "bg-muted text-muted-foreground",
      chip: "bg-muted text-muted-foreground",
      label: APPLICATION_STATUS_LABELS.withdrawn,
      badge: MinusIcon,
      badgeTint: "bg-muted-foreground text-background",
    };
  }
  if (application.stage === "active") {
    return {
      tint: "bg-status-approved-bg text-status-approved",
      chip: "bg-status-approved-bg text-status-approved",
      label: STAGE_LABELS.active,
      badge: CheckIcon,
      badgeTint: "bg-status-approved text-white",
    };
  }

  return {
    tint: "bg-status-current-bg text-status-current",
    chip: "bg-status-current-bg text-status-current",
    label: APPLICATION_STATUS_LABELS.open,
    badge: null,
    badgeTint: "",
  };
}

/**
 * One process in the list, told from the side that is reading it.
 *
 * A landlord needs to know *who* applied; a tenant already knows, and needs to know *where*. The
 * same card, two sentences — and for the landlord the applicant's name comes first, because with
 * three processes on one property the address is what they have in common.
 *
 * An open one shows the rail: nine stages is too many to name in a row, so the dots carry the
 * position and only the current stage is spelled out, with the sentence that says whose turn it
 * is. A closed one drops the rail — there is no progress to show — and keeps what happened and
 * why, which is the whole reason it is still on the screen.
 */
export function ApplicationCard({
  application,
  viewerUid,
}: {
  readonly application: Application;
  readonly viewerUid: string;
}) {
  const isLandlord = application.landlordUid === viewerUid;
  const isOpen = application.status === "open";
  const look = lookOf(application);
  const Badge = look.badge;

  const meta = [
    isLandlord ? application.tenantName || "Un inquilino" : `En ${application.propertyCity}`,
    isLandlord ? `En ${application.propertyCity}` : null,
    `Postulación #${applicationCode(application.id)}`,
    isOpen
      ? `Inició el ${formatShortDate(application.createdAt)}`
      : `Cerrado el ${formatShortDate(application.updatedAt)}`,
  ].filter((piece): piece is string => Boolean(piece));

  return (
    <li className="flex flex-col rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="relative shrink-0">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-xl",
              look.tint,
            )}
          >
            <BuildingIcon className="size-6" aria-hidden="true" />
          </span>
          {Badge && (
            <span
              className={cn(
                "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full ring-2 ring-card",
                look.badgeTint,
              )}
            >
              <Badge className="size-3" aria-hidden="true" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold text-foreground">
              <Link
                href={propertyDetailRoute(application.propertySlug)}
                className="hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {application.propertyTitle}
              </Link>
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {isLandlord ? "Como propietario" : "Como inquilino"}
            </span>
          </div>

          <p className="mt-0.5 text-sm text-muted-foreground">{meta.join(" · ")}</p>

          <p className="mt-1 font-medium text-foreground">
            {formatCOP(application.monthlyCost)}
            <span className="font-normal text-muted-foreground"> / mes</span>
          </p>
        </div>
      </div>

      {isOpen ? (
        <StageRail stage={application.stage} />
      ) : (
        <div className="mt-4 space-y-1">
          <span
            className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", look.chip)}
          >
            {look.label}
          </span>
          <p className="text-sm text-muted-foreground">
            {application.status === "rejected" ? "Rechazada" : "Retirada"} en la etapa
            {" "}
            <span className="text-foreground">{STAGE_LABELS[application.stage]}</span>.
          </p>
          {application.closingNote && (
            <p className="text-sm text-muted-foreground">
              Motivo: <span className="text-foreground">{application.closingNote}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href={applicationRoute(application.id)}>
            <EyeIcon aria-hidden="true" />
            {isOpen ? "Ver el proceso" : "Ver el detalle"}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href={propertyDetailRoute(application.propertySlug)}>
            <BuildingIcon aria-hidden="true" />
            Ver el inmueble
          </Link>
        </Button>
      </div>

      {isOpen && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
          <ListChecksIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {/* En `active` no hay paso siguiente: el arriendo ya está corriendo, y llamarlo
                "siguiente paso" prometería algo que hacer donde no hay nada. */}
            <span className="font-medium text-foreground">
              {application.stage === "active" ? "Estado: " : "Siguiente paso: "}
            </span>
            {stageDescription(application.stage, isLandlord)}
          </span>
        </p>
      )}
    </li>
  );
}

/**
 * The nine stages as a rail.
 *
 * Naming all nine in a row does not fit on a phone and barely fits on a laptop, so the dots carry
 * the position and the current stage is the one that gets words. Each dot still says what it is
 * to a screen reader: a row of unlabelled circles is decoration, not information.
 */
function StageRail({ stage }: { readonly stage: Application["stage"] }) {
  const current = stageIndex(stage);

  return (
    <div className="mt-4">
      <ol className="flex items-center" aria-label="Etapas del proceso">
        {STAGES.map((entry, index) => {
          const done = index < current;
          const isCurrent = index === current;

          return (
            <li
              key={entry}
              className={cn("flex items-center", index < STAGES.length - 1 && "flex-1")}
            >
              <span
                className={cn(
                  "flex size-3 shrink-0 items-center justify-center rounded-full",
                  done && "bg-accent",
                  isCurrent && "bg-accent ring-3 ring-accent/30",
                  !done && !isCurrent && "bg-border",
                )}
              >
                <span className="sr-only">
                  {`Etapa ${index + 1}, ${STAGE_LABELS[entry]}: ${
                    done ? "completada" : isCurrent ? "en curso" : "pendiente"
                  }`}
                </span>
              </span>
              {index < STAGES.length - 1 && (
                <span
                  className={cn("h-0.5 flex-1", index < current ? "bg-accent" : "bg-border")}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm">
        <span className="font-medium text-foreground">{STAGE_LABELS[stage]}</span>
        <span className="text-muted-foreground"> · {stageProgressLabel(stage)}</span>
      </p>
    </div>
  );
}
