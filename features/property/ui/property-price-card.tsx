import { CalendarIcon, InfoIcon } from "lucide-react";

import { formatCOP } from "@/shared/format/money";
import { ComingSoonCard } from "@/shared/ui/coming-soon-card";
import { Button } from "@/shared/ui/button";

import { LEASE_TERM_LABELS, propertyMonthlyCost, type Property } from "../domain/property";

/** `2026-12-07` → `7 de diciembre de 2026`, in Colombian time. */
function formatDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * What the tenant actually pays, and what they commit to.
 *
 * The headline is rent + admin fee together, because that is the number that leaves their
 * account every month; the breakdown right below keeps it honest. There is no deposit row:
 * Ley 820 de 2003 forbids cash deposits on urban housing leases, so the product does not have
 * the field to show.
 *
 * The application button is deliberately inert: applications are the next feature, and a
 * button that pretends to work is worse than one that says what it is.
 */
export function PropertyPriceCard({ property }: { readonly property: Property }) {
  const monthly = propertyMonthlyCost(property);

  return (
    <aside className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">Canon mensual</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {formatCOP(monthly)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {property.adminFee > 0
          ? `${formatCOP(property.rent)} + ${formatCOP(property.adminFee)} de administración`
          : "Sin cuota de administración"}
      </p>

      <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Duración mínima</dt>
          <dd className="text-right font-medium text-foreground">
            {LEASE_TERM_LABELS[property.minLeaseMonths]}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="size-4" aria-hidden="true" />
            Disponible desde
          </dt>
          <dd className="text-right font-medium text-foreground">
            {formatDay(property.availableFrom)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <ComingSoonCard label="Las postulaciones abren pronto">
          <Button variant="accent" size="xl" className="w-full">
            Postularme
          </Button>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Podrás postularte, enviar tus documentos y firmar el contrato desde aquí.
          </p>
        </ComingSoonCard>
      </div>
    </aside>
  );
}
