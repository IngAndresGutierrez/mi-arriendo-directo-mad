import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import {
  focusMonth,
  getLeaseFor,
  leaseSchedule,
  leaseSummary,
  listPeriods,
  monthRows,
  LeaseSummaryPanel,
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
export default async function RentalPage(props: PageProps<"/arriendos/[id]">) {
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
  const [rows, periods] = await Promise.all([monthRows(lease, today), listPeriods(lease.id)]);
  const summary = leaseSummary(leaseSchedule(lease, today), periods, today);
  const focus = focusMonth(rows, isLandlord);

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

      <div className="mt-6 space-y-6">
        <LeaseSummaryPanel lease={lease} summary={summary} today={today} />
        <PayoutCard leaseId={lease.id} payout={lease.payout} isLandlord={isLandlord} />
        <MonthList
          leaseId={lease.id}
          rows={rows}
          focus={focus?.month.id ?? null}
          isLandlord={isLandlord}
        />
      </div>
    </div>
  );
}
