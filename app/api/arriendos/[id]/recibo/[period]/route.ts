import {
  getLeaseFor,
  leaseSchedule,
  listPeriods,
  receiptBlocker,
  receiptPdf,
  rentReceipt,
} from "@/features/lease";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { bogotaToday } from "@/shared/format/date";

/**
 * The rent receipt for one month, generated on demand.
 *
 * **Nothing is stored.** The document is derived entirely from the record, so a stored copy would be
 * a second source of truth that a corrected verdict could leave stale — the same reason
 * `leaseSummary` counts the periods instead of keeping counters. Generating it costs one Firestore
 * read and a page of text.
 *
 * ## Who gets it
 *
 * **Both parties**, and the tenant especially: Ley 820 de 2003 puts it on the landlord to give a
 * written receipt with the date, the amount and the period, and in practice that is a WhatsApp
 * "listo, recibido" that survives nothing. `getLeaseFor` answers `null` to a stranger exactly as it
 * does to somebody asking about a tenancy that does not exist, so this inherits that
 * indistinguishability for free.
 *
 * ## Why a month that is not confirmed answers 404
 *
 * A receipt certifies that the money **arrived**, and only the person whose account it is can say
 * that. A month with the transfer uploaded and no verdict looks paid from the tenant's side and is
 * not — so `receiptBlocker` refuses it here, in the endpoint, and not only on the screen: a page
 * guard protects a screen, not a URL somebody can type.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; period: string }> },
): Promise<Response> {
  const { id, period } = await params;
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(id, user.uid);
  if (!lease) return new Response("No encontrado", { status: 404 });

  const today = bogotaToday(new Date());
  const month = leaseSchedule(lease, today).find((one) => one.id === period);
  if (!month) return new Response("No encontrado", { status: 404 });

  const stored = (await listPeriods(lease.id)).find((one) => one.id === period) ?? null;
  if (!stored || receiptBlocker(month, stored, today)) {
    return new Response("No encontrado", { status: 404 });
  }

  const [landlord, tenant] = await Promise.all([
    getProfile(lease.landlordUid),
    getProfile(lease.tenantUid),
  ]);

  const pdf = await receiptPdf(
    rentReceipt({
      leaseId: lease.id,
      month,
      stored,
      propertyTitle: lease.propertyTitle,
      propertyCity: lease.propertyCity,
      landlordName: landlord?.fullName ?? "El arrendador",
      // The lease's own copy, not the profile's: it is what was recorded for this tenancy, and a
      // name corrected in a profile afterwards must not rewrite a receipt already handed over.
      tenantName: lease.tenantName || tenant?.fullName || "El arrendatario",
      issuedAt: new Date().toISOString(),
    }),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      /*
       * `inline`, not `attachment`: the ordinary thing somebody does with a receipt is look at it,
       * and a browser that downloads it instead makes them go and find it. The filename is still
       * offered for when they do save it.
       */
      "Content-Disposition": `inline; filename="recibo-${period}.pdf"`,
      /*
       * `no-store`: the response is decided by who is asking, so a shared cache holding it would be
       * one tenancy's receipt served to the next request through the same proxy.
       */
      "Cache-Control": "private, no-store",
    },
  });
}
