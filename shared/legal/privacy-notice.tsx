import Link from "next/link";
import { InfoIcon } from "lucide-react";

import { PRIVACY_ROUTE } from "@/shared/auth/routes";
import { CONTROLLER_NAME, PRIVACY_CONTACT_EMAIL } from "./controller";

/**
 * The **aviso de privacidad**: what has to be on screen wherever personal data is collected.
 *
 * Decreto 1074 de 2015 (art. 2.2.2.25.3.2) requires the Responsable to inform the titular of the
 * existence of its política de tratamiento, how to reach it, and the purposes the data will be put
 * to — *"a más tardar al momento de la recolección"*. Not on a page somewhere; at the point of
 * collection. Its minimum content (art. 2.2.2.25.3.3) is the Responsable's identity and contact
 * details plus that purpose.
 *
 * **The purpose is a prop, and that is the whole design.** One generic sentence repeated on five
 * screens is not an aviso de privacidad — it is a disclaimer. What makes this comply is that the
 * form asking for a payslip says what a payslip is for, in the place it is being asked for.
 *
 * It is deliberately not a tooltip and not behind a link. This is the *information* duty; a duty
 * discharged only for people who hover is not discharged.
 *
 * A plain Server Component: it renders the same text for everybody and has nothing to hydrate.
 * It lives in `shared/` rather than in `features/legal/` because four different feature modules
 * collect data and therefore render it, and one of them is `features/application`, which
 * `features/legal` itself depends on — inside a feature this would be a dependency cycle.
 */
export function PrivacyNotice({
  purpose,
  className,
}: {
  /**
   * What *this* screen's data is for, in es-CO, as a sentence that completes "…se usan para".
   * Specific: "evaluar tu postulación", not "prestar el servicio".
   */
  readonly purpose: string;
  readonly className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-brand-panel/25 bg-brand-panel/[0.04] p-4 dark:border-brand-panel-muted/25 dark:bg-brand-panel-muted/[0.06] ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <InfoIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-brand-panel dark:text-brand-panel-muted"
        />
        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tratamiento de tus datos.</strong>{" "}
            {CONTROLLER_NAME} es responsable de los datos que entregues aquí. Se usan para{" "}
            {purpose}.
          </p>
          <p>
            Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta
            autorización, escribiendo a{" "}
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
            . Lo demás está en la{" "}
            <Link
              href={PRIVACY_ROUTE}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Política de tratamiento de datos personales
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
