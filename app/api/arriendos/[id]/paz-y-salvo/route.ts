import {
  clearance,
  clearanceBlocker,
  clearancePdf,
  getLeaseFor,
  leaseSchedule,
  listPeriods,
} from "@/features/lease";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { bogotaToday } from "@/shared/format/date";

/**
 * The paz y salvo, generated on demand.
 *
 * **The tenant can produce it themselves, and that is the point of the feature.** A paz y salvo is
 * normally a document the creditor hands over, which means it is also one the creditor can withhold
 * — and a tenant with nothing to show the next landlord has no defence against that. Every month it
 * lists is the landlord's own recorded confirmation, so the certificate asserts nothing new; it
 * restates what they already said, and it can say it to whoever asks.
 *
 * Refused when anything is owed, and `clearanceBlocker` distinguishes the three reasons rather than
 * answering "no": overdue is money to transfer, in review is a landlord to chase, and a tenancy with
 * nothing confirmed yet has nothing to certify. The screen shows the reason; this endpoint just
 * refuses, because a URL somebody typed has nowhere to put an explanation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const user = await requireCompleteProfile();

  const lease = await getLeaseFor(id, user.uid);
  if (!lease) return new Response("No encontrado", { status: 404 });

  const today = bogotaToday(new Date());
  const periods = await listPeriods(lease.id);
  const byId = new Map(periods.map((period) => [period.id, period]));
  const entries = leaseSchedule(lease, today).map((month) => ({
    month,
    stored: byId.get(month.id) ?? null,
  }));

  if (clearanceBlocker(entries, today)) {
    return new Response("No hay paz y salvo mientras haya canones pendientes", { status: 409 });
  }

  const [landlord, tenant] = await Promise.all([
    getProfile(lease.landlordUid),
    getProfile(lease.tenantUid),
  ]);

  const pdf = await clearancePdf(
    clearance({
      leaseId: lease.id,
      entries,
      today,
      propertyTitle: lease.propertyTitle,
      propertyCity: lease.propertyCity,
      landlordName: landlord?.fullName ?? "El arrendador",
      tenantName: lease.tenantName || tenant?.fullName || "El arrendatario",
      issuedAt: new Date().toISOString(),
    }),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="paz-y-salvo-${today}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
