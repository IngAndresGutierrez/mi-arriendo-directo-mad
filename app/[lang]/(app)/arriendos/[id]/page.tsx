import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import {
  checkoutBlocker,
  focusMonth,
  getHandovers,
  getLeaseFor,
  handoverView,
  incidentRows,
  leaseSchedule,
  leaseSummary,
  listIncidents,
  listPeriods,
  monthRows,
  HandoverPanel,
  IncidentList,
  LeaseSummaryPanel,
  LeaseTabs,
  LivePeriods,
  MonthList,
  PayoutCard,
} from "@/features/lease";
import { requireCompleteProfile } from "@/features/profile";
import {
  applicationRoute,
  propertyDetailRoute,
  RENTALS_ROUTE,
} from "@/shared/auth/routes";
import { bogotaToday } from "@/shared/format/date";

export const metadata: Metadata = {
  title: "Arriendo en curso",
};

/**
 * One tenancy: the term, where the canon goes, and every month of it.
 *
 * **A non-party is forwarded to the process, not told they are not one.** `getLeaseFor` answers
 * `null` both for "there is no such tenancy" and for "it is not yours", so the two are
 * indistinguishable from here — and a forward to `/contratos/<id>` is also the right answer for the
 * case this route was built to keep serving: every notification sent before the rename points at
 * `/arriendos/<id>#etapa-…`, and a process that has not reached its last stage has no tenancy yet.
 */
export default async function RentalPage(props: PageProps<"/[lang]/arriendos/[id]">) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(id, user.uid);
  if (!lease) redirect(applicationRoute(id));

  const isLandlord = lease.landlordUid === user.uid;
  const today = bogotaToday(new Date());

  /*
   * The months, and the totals over them. `monthRows` is one call rather than three because the
   * three have to agree: the derived calendar, the documents that exist for it, and a signed URL
   * per receipt — and only the server can produce the third.
   */
  const [rows, periods, incidents, actas] = await Promise.all([
    monthRows(lease, today),
    listPeriods(lease.id),
    // Los incidentes son otra subcolección y no dependen de los meses: en paralelo, o la página
    // paga dos viajes de ida y vuelta por lo que puede pedir a la vez.
    listIncidents(lease.id),
    // Y las actas son una tercera, por lo mismo.
    getHandovers(lease.id),
  ]);
  const summary = leaseSummary(leaseSchedule(lease, today), periods, today);
  const focus = focusMonth(rows, isLandlord);
  const reports = await incidentRows(incidents);

  /*
   * Los meses que piden algo, contados aquí y no en el cliente: es la misma cuenta que ya hace
   * `leaseSummary` sobre los mismos documentos, y el rail sólo necesita el número.
   */
  const openMonths = summary.overdue + summary.inReview;

  /*
   * Las dos actas con sus fotos ya firmadas. En paralelo entre ellas: una entrega con doce espacios
   * son setenta URLs que firmar, y encadenadas serían el presupuesto entero de render de la página.
   */
  const [checkinView, checkoutView] = await Promise.all([
    handoverView(actas.checkin),
    handoverView(actas.checkout),
  ]);

  /*
   * El punto del rail: si alguna de las dos actas espera algo de **quien está mirando**. El
   * propietario tiene trabajo mientras haya un borrador o una objeción que responder; el inquilino,
   * mientras haya un acta enviada esperándole. Se calcula desde el mismo `handoverState` que
   * dibujan los paneles, no desde una segunda regla.
   */
  const handoverAlert = [checkinView.state, checkoutView.state].some((state) =>
    isLandlord
      ? state === "draft" || state === "disputed"
      : state === "awaiting_tenant" || state === "disputed",
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Both sides are often here at once: one uploading a receipt, the other confirming it. */}
      <LivePeriods leaseId={lease.id} updatedAt={lease.updatedAt} />

      <Link
        href={RENTALS_ROUTE}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Arriendos
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        {lease.propertyTitle}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLandlord
          ? `${lease.tenantName || "Un inquilino"} · ${lease.propertyCity}`
          : `Tu arriendo · ${lease.propertyCity}`}{" "}
        ·{" "}
        <Link href={propertyDetailRoute(lease.propertySlug)} className="hover:underline">
          ver el anuncio
        </Link>{" "}
        ·{" "}
        {/* El contrato, la entrevista y la póliza viven en el proceso, y la gente vuelve por ellos. */}
        <Link href={applicationRoute(lease.id)} className="hover:underline">
          ver el contrato
        </Link>
      </p>

      {/*
        Tres pestañas, y lo que va en cada una responde a una pregunta distinta: qué es este
        arriendo, si está pagado, y qué se dañó. Los paneles se pasan **ya construidos** — un
        elemento JSX cruza la frontera RSC, una función no —, así que la página sigue siendo la que
        decide qué hay dentro y `LeaseTabs` sólo decide cuál se ve.

        Ojo con el orden y el defecto: "Información" va primera porque es lo que nombra la pantalla,
        pero la pestaña abierta es **Pagos**, que es la pregunta con la que la gente entra aquí.
      */}
      <div className="mt-6">
        <LeaseTabs
          openMonths={openMonths}
          incidentCount={reports.length}
          handoverAlert={handoverAlert}
          info={<LeaseSummaryPanel lease={lease} summary={summary} today={today} />}
          payments={
            <>
              <PayoutCard leaseId={lease.id} payout={lease.payout} isLandlord={isLandlord} />
              <MonthList
                leaseId={lease.id}
                rows={rows}
                focus={focus?.month.id ?? null}
                isLandlord={isLandlord}
              />
            </>
          }
          handover={
            <>
              <HandoverPanel
                leaseId={lease.id}
                kind="checkin"
                view={checkinView}
                isLandlord={isLandlord}
                blocked={false}
              />
              <HandoverPanel
                leaseId={lease.id}
                kind="checkout"
                view={checkoutView}
                isLandlord={isLandlord}
                /* Una devolución se lee al lado de la entrega, así que necesita que exista. */
                blocked={checkoutBlocker(actas.checkin) !== null}
                /*
                  Y arranca con los mismos espacios que la entrega. Es lo que hace que la comparación
                  exista: dos actas que nombran habitaciones distintas no se pueden leer una al lado
                  de la otra. Solo los nombres — el estado y las fotos son lo que se va a volver a
                  mirar.
                */
                seed={(actas.checkin?.areas ?? []).map((area) => area.name)}
              />
            </>
          }
          incidents={
            <IncidentList leaseId={lease.id} rows={reports} isLandlord={isLandlord} />
          }
        />
      </div>
    </div>
  );
}
