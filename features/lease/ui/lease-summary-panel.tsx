import { CalendarRangeIcon, FileCheckIcon } from "lucide-react";

import { clearanceRoute } from "@/shared/auth/routes";
import { formatLongDate } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { formatCOP } from "@/shared/format/money";

import type { ClearanceBlocker } from "../domain/certificate";
import {
  currentTermEnd,
  leaseTermState,
  LEASE_TERM_STATE_LABELS,
  type Lease,
  type LeaseSummary,
} from "../domain/lease";

/**
 * The tenancy as a whole: how long it runs, how much it is, and how much of it has been paid.
 *
 * The four numbers are what somebody comes to this page for once the month in front of them is
 * settled — "¿estoy al día?" is one glance, not an audit of twelve rows.
 *
 * The term dates and the canon are **labelled as coming from the application**, and that is not
 * hedging: the contract governs both, this product does not read it, and presenting either as
 * authoritative would be inventing a figure the two of them never agreed to here.
 */
export function LeaseSummaryPanel({
  lease,
  summary,
  today,
  clearanceProblem,
}: {
  readonly lease: Lease;
  readonly summary: LeaseSummary;
  readonly today: string;
  /**
   * Why the paz y salvo cannot be issued right now, or `null`.
   *
   * Decided by the page from the same months the list renders, and passed in rather than recomputed
   * here: two copies of "is this tenancy up to date?" is the pair whose first divergence would let
   * the button offer a document the endpoint then refuses.
   */
  readonly clearanceProblem: ClearanceBlocker | null;
}) {
  const state = leaseTermState(lease, today);
  const termEnd = currentTermEnd(lease, today);

  return (
    <section
      aria-labelledby="lease-summary-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="lease-summary-heading" className="font-semibold text-primary dark:text-foreground">
          El arriendo
        </h2>
        {/*
          El estado del término, y nunca "terminado": la Ley 820 renueva el arriendo salvo que
          alguien avise, así que cumplirse los meses no es acabarse.
        */}
        <span
          className={
            state === "renewed"
              ? "inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-0.5 text-xs font-medium text-status-pending"
              : "inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-0.5 text-xs font-medium text-status-approved"
          }
        >
          <CalendarRangeIcon className="size-3" aria-hidden="true" />
          {LEASE_TERM_STATE_LABELS[state]}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Canon mensual</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatCOP(lease.monthlyCost)}
            <span className="block text-xs font-normal text-muted-foreground">
              según la postulación
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Empezó el</dt>
          <dd className="mt-0.5 font-medium text-foreground">{formatLongDate(lease.startDate)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {state === "renewed" ? "Término actual, hasta" : "Va hasta"}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatLongDate(termEnd)}
            <span className="block text-xs font-normal text-muted-foreground">
              {lease.months === 6 ? "6 meses" : "1 año"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Meses pagados</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {summary.paid} de {summary.scheduled}
            <span className="block text-xs font-normal text-muted-foreground">
              {formatCOP(summary.totalPaid)} confirmados
            </span>
          </dd>
        </div>
      </dl>

      {summary.overdue > 0 ? (
        <p className="mt-4 rounded-xl bg-status-overdue-bg px-4 py-3 text-sm font-medium text-status-overdue">
          {summary.overdue === 1
            ? `Hay un mes sin pagar: ${formatCOP(summary.totalOverdue)}.`
            : `Hay ${summary.overdue} meses sin pagar: ${formatCOP(summary.totalOverdue)} en total.`}
        </p>
      ) : null}

      {/*
        El paz y salvo, y **lo genera cualquiera de las dos partes desde el registro**.

        Normalmente es un documento que expide el acreedor — lo que significa que también es uno que
        el acreedor puede **retener**, y un inquilino sin nada que mostrarle al siguiente propietario
        no tiene defensa contra eso. Aquí cada mes que lista es una confirmación que el propietario
        ya hizo, así que el certificado no afirma nada nuevo: repite lo que él ya dijo.

        Y el motivo por el que no se puede se dice en la pantalla, no en el enlace: `clearanceBlocker`
        distingue tres —hay mora, hay algo esperando confirmación, o todavía no se ha confirmado
        nada— porque se actúa distinto en cada uno.
      */}
      <div className="mt-4 border-t border-border pt-4">
        {clearanceProblem ? (
          <p className="text-sm text-muted-foreground">
            {clearanceProblem === "overdue"
              ? "El paz y salvo estará disponible cuando no queden canones vencidos."
              : clearanceProblem === "in_review"
                ? "Hay un comprobante esperando la confirmación del propietario. El paz y salvo sale cuando esté confirmado."
                : "Todavía no hay ningún canon confirmado que certificar."}
          </p>
        ) : (
          <Button asChild variant="brand" size="xl">
            <a href={clearanceRoute(lease.id)} target="_blank" rel="noreferrer noopener">
              <FileCheckIcon className="size-4" aria-hidden="true" />
              Descargar el paz y salvo
            </a>
          </Button>
        )}
      </div>

      {state === "renewed" ? (
        /*
          Ley 820 de 2003: el contrato se prorroga por un término igual salvo que una de las partes
          avise en la forma y el plazo que la ley señala. Se dice aquí porque las dos partes tienen
          que saber en qué término están, y **terminarlo no está construido**: el preaviso, su plazo
          y quién puede darlo necesitan una lectura jurídica antes de escribirse en código.
        */
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Se cumplieron los meses iniciales y el arriendo continúa: la Ley 820 de 2003 lo prorroga
          por un término igual salvo que una de las partes avise. Dar ese aviso todavía no se hace
          desde aquí — escríbanle a soporte y lo acompañamos.
        </p>
      ) : null}
    </section>
  );
}
