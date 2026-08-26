import { dossierLabels } from "@/features/tenant-profile";
import { currentLocale } from "@/shared/i18n/server";
import { formatCOP } from "@/shared/format/money";
import {
  incomeRatioLabel,
  type TenantDossier,
} from "@/features/tenant-profile";

/**
 * What the tenant declared, as the landlord reads it.
 *
 * This is the snapshot stored inside the application, not the tenant's live profile: it is what
 * was said *to this landlord*, and editing the profile afterwards cannot change it.
 *
 * The income multiple is shown because it is the first thing a landlord works out on paper, and
 * doing the arithmetic for them beats them doing it wrong. It is a fact, not a verdict: nothing
 * in the product refuses anyone for it.
 */
export async function DossierSummary({
  dossier,
  monthlyCost,
  showSensitive,
}: {
  readonly dossier: TenantDossier;
  readonly monthlyCost: number;
  /** The identity document is only for the landlord, never for a third party. */
  readonly showSensitive: boolean;
}) {
  const labels = dossierLabels(await currentLocale());
  const ratio = incomeRatioLabel(dossier.monthlyIncome, monthlyCost);

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {showSensitive ? (
        <Row label="Documento">
          {labels.documentTypes[dossier.documentType]} {dossier.documentNumber}
        </Row>
      ) : null}
      <Row label="Ocupación">
        {labels.occupations[dossier.occupation]} · {dossier.employer}
      </Row>
      <Row label="Ingresos declarados">
        {formatCOP(dossier.monthlyIncome)}
        {ratio ? <span className="text-muted-foreground"> · {ratio}</span> : null}
      </Row>
      <Row label="Personas que vivirían ahí">{dossier.householdSize}</Row>
      <Row label="Mascotas">{dossier.hasPets ? dossier.petsDescription : "No tiene"}</Row>
      {showSensitive ? (
        <Row label="Referencia">
          {dossier.reference.name} ({dossier.reference.relationship}) · {dossier.reference.phone}
        </Row>
      ) : null}
    </dl>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}
