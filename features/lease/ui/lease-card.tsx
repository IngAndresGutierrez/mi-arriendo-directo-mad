import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ArrowRightIcon, CalendarClockIcon } from "lucide-react";

import { applicationRoute, rentalRoute } from "@/shared/auth/routes";
import { formatShortDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";

import {
  currentTermEnd,
  leaseSchedule,
  leaseSummary,
  leaseTermState,
  LEASE_TERM_STATE_LABELS,
  type Lease,
  type Period,
} from "../domain/lease";

/**
 * One tenancy in the list.
 *
 * What it has to answer at a glance is "¿estoy al día?", so the months paid and the months owed are
 * the two numbers on the card, and a debt says so in red rather than as one more grey line. The
 * stage rail that the process cards carry would be meaningless here: a tenancy has no stages, it has
 * months, and the interesting one is always the current one.
 *
 * It links to both halves of the same story: the tenancy, and the process that produced it — the
 * contract, the interview and the policy live there and people go back for them.
 *
 * **The whole card opens the tenancy**, not just the title. A card whose only target is four words
 * at the top is a card people click three times before finding the hit area, and on a phone the
 * miss is the norm rather than the exception. It is done with the title link stretched over the card
 * (`after:absolute after:inset-0`) and not by wrapping everything in an `<a>`: the card also holds a
 * second link — the process — and an anchor inside an anchor is invalid HTML that browsers repair
 * by dropping one of them. That second link is lifted above the overlay with `relative z-10`, so it
 * keeps its own destination, and there is still exactly one accessible name for the card's own.
 */
export function LeaseCard({
  lease,
  periods,
  viewerUid,
  today,
}: {
  readonly lease: Lease;
  /** The months that have a document. The calendar itself is derived. */
  readonly periods: readonly Period[];
  readonly viewerUid: string;
  readonly today: string;
}) {
  const isLandlord = lease.landlordUid === viewerUid;
  const schedule = leaseSchedule(lease, today);
  const summary = leaseSummary(schedule, periods, today);
  const state = leaseTermState(lease, today);

  return (
    <li className="relative rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={rentalRoute(lease.id)}
            className="group flex items-start gap-2 after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <h2 className="min-w-0 text-lg font-semibold text-balance text-primary group-hover:underline dark:text-foreground">
              {lease.propertyTitle}
            </h2>
            <ArrowRightIcon
              className="mt-1.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLandlord ? `${lease.tenantName || "Un inquilino"} · ` : ""}
            {lease.propertyCity} · {formatCOP(lease.monthlyCost)} al mes
          </p>
        </div>

        <span
          className={
            state === "renewed"
              ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-0.5 text-xs font-medium text-status-pending"
              : "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-0.5 text-xs font-medium text-status-approved"
          }
        >
          <CalendarClockIcon className="size-3" aria-hidden="true" />
          {LEASE_TERM_STATE_LABELS[state]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Meses pagados</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {summary.paid} de {summary.scheduled}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Sin pagar</dt>
          <dd
            className={
              summary.overdue > 0
                ? "mt-0.5 font-medium text-status-overdue"
                : "mt-0.5 font-medium text-foreground"
            }
          >
            {summary.overdue === 0 ? "Ninguno" : `${summary.overdue} · ${formatCOP(summary.totalOverdue)}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {state === "renewed" ? "Término actual, hasta" : "Va hasta"}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatShortDate(currentTermEnd(lease, today))}
          </dd>
        </div>
      </dl>

      {/* Cuánto se ha pagado del término, de un vistazo. */}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-border" role="presentation">
        <div
          className="h-full rounded-full bg-accent"
          style={{
            width: `${summary.scheduled === 0 ? 0 : (summary.paid / summary.scheduled) * 100}%`,
          }}
        />
      </div>

      {summary.inReview > 0 ? (
        <p className="mt-3 text-sm text-status-current">
          {summary.inReview === 1
            ? "Hay un comprobante esperando respuesta."
            : `Hay ${summary.inReview} comprobantes esperando respuesta.`}
        </p>
      ) : null}

      <p className="mt-3 text-sm">
        <Link
          href={applicationRoute(lease.id)}
          // `relative z-10`: por encima de la capa que estira el enlace del título, o este no se
          // podría pulsar nunca — la tarjeta entera se lo tragaría.
          className="relative z-10 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Ver el contrato y el proceso
        </Link>
      </p>
    </li>
  );
}
