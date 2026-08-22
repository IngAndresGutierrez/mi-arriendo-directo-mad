import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { applicationRoute, propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import {
  closedAtLabel,
  stageProgressLabel,
  APPLICATION_STATUS_LABELS,
  STAGE_LABELS,
  type Application,
} from "../domain/application";

const STATUS_STYLES = {
  open: "bg-status-current-bg text-status-current",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
} as const;

/**
 * One process in the list, told from the side that is reading it.
 *
 * A landlord needs to know *who* applied; a tenant already knows, and needs to know *where*. The
 * same card, two sentences.
 */
export function ApplicationCard({
  application,
  viewerUid,
}: {
  readonly application: Application;
  readonly viewerUid: string;
}) {
  const isLandlord = application.landlordUid === viewerUid;
  const closed = closedAtLabel(application);

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLES[application.status],
          )}
        >
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
        {application.status === "open" ? (
          <span className="text-xs text-muted-foreground">
            {stageProgressLabel(application.stage)} · {STAGE_LABELS[application.stage]}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{closed}</span>
        )}
      </div>

      <h2 className="mt-2 font-semibold text-foreground">
        <Link href={propertyDetailRoute(application.propertySlug)} className="hover:underline">
          {application.propertyTitle}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">
        {isLandlord
          ? `${application.tenantName || "Un inquilino"} se postuló · ${application.propertyCity}`
          : `Tu postulación · ${application.propertyCity}`}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {formatCOP(application.monthlyCost)}
        <span className="font-normal text-muted-foreground"> al mes</span>
      </p>

      <Link
        href={applicationRoute(application.id)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-foreground"
      >
        Ver el proceso
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}
