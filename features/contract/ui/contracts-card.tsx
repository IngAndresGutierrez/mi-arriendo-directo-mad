import { FileTextIcon } from "lucide-react";

import type { ContractSummary } from "../data/contracts";

const CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Keys in English (they are stored values); labels in es-CO (they are copy).
const STATUS_LABEL: Readonly<Record<string, string>> = {
  active: "Vigente",
  ended: "Terminado",
  pending_signature: "Pendiente de firma",
};

/**
 * The user's contracts, from real Firestore data — so the empty state is what every new
 * account sees: the normal case, not an exception.
 */
export function ContractsCard({ contracts }: { contracts: readonly ContractSummary[] }) {
  if (contracts.length === 0) {
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
            <h2 className="font-semibold text-foreground">Todavía no tienes contratos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cuando firmes tu primer arriendo, aparecerá aquí con sus pagos y fechas.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">Tus contratos</h2>
      <ul className="mt-4 divide-y divide-border">
        {contracts.map((contract) => (
          <li key={contract.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {STATUS_LABEL[contract.status] ?? contract.status}
              </p>
              <p className="text-sm text-muted-foreground">
                Canon {CURRENCY.format(contract.rent)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
