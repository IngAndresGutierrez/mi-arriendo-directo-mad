import Link from "next/link";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { applicationRoute, PROPERTIES_ROUTE, CONTRACTS_ROUTE } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";

import {
  processStageLabel,
  stageProgressLabel,
  STAGES,
  stageIndex,
  type Application,
} from "../domain/application";

/** Three is what fits without pushing the shortcuts below the fold; the rest are one click away. */
const SHOWN = 3;

/**
 * The rentals in course, on the home screen.
 *
 * This card used to read a `contracts` collection that nothing writes — signing is not built yet —
 * so it said "todavía no tienes contratos" to somebody with three processes open, which reads as
 * a product that lost their work. What a person has on this platform today *is* the process: the
 * stage it is on and whose turn it is. That is what this shows now.
 */
export function RentalsCard({
  applications,
  viewerUid,
}: {
  /** Open ones only, newest first. The caller filters: what "open" means is the domain's word. */
  readonly applications: readonly Application[];
  readonly viewerUid: string;
}) {
  if (applications.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          >
            <FileTextIcon className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Todavía no tienes contratos en curso</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Postúlate a un inmueble o espera a que alguien se postule a los tuyos: el proceso
              aparecerá aquí, etapa por etapa.
            </p>
          </div>
        </div>
        <Link
          href={PROPERTIES_ROUTE}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-foreground"
        >
          Ver los inmuebles disponibles
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-foreground">Tus contratos en curso</h2>
        {applications.length > SHOWN && (
          <Link
            href={CONTRACTS_ROUTE}
            className="text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Ver los {applications.length}
          </Link>
        )}
      </div>

      <ul className="mt-3 divide-y divide-border">
        {applications.slice(0, SHOWN).map((application) => {
          const isLandlord = application.landlordUid === viewerUid;

          return (
            <li key={application.id} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={applicationRoute(application.id)}
                className="group flex items-start justify-between gap-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground group-hover:underline">
                    {application.propertyTitle}
                  </p>
                  {/* La etapa, no solo el estado: es la única cosa que cambia de un día a otro. */}
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {processStageLabel(application)} · {stageProgressLabel(application)}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatCOP(application.monthlyCost)} al mes ·{" "}
                    {isLandlord ? "Como propietario" : "Como inquilino"}
                  </p>
                </div>
                <ArrowRightIcon
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>

              {/* Cuánto falta, de un vistazo: siete etapas son difíciles de situar con palabras. */}
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-border"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${((stageIndex(application.stage) + 1) / STAGES.length) * 100}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
