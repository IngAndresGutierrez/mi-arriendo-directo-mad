"use client";

import { useLiveRefresh } from "@/shared/lib/use-live-refresh";

/**
 * Keeps the tenancy page current while the other party is on it.
 *
 * Both sides are often here at once — one uploading a receipt, the other confirming it — and the
 * whole point of this screen is that they are looking at the same record.
 *
 * **It watches the tenancy, not the months.** A subscription per month would be twelve listeners
 * for a page somebody has open for a minute, so every write inside a month nudges its parent's
 * `updatedAt` and this reads that one field. The snapshot is a signal, never the data: what is on
 * screen comes from the server, including the signed URLs, which the client could not produce.
 */
export function LivePeriods({
  leaseId,
  updatedAt,
}: {
  readonly leaseId: string;
  readonly updatedAt: string;
}) {
  useLiveRefresh(`leases/${leaseId}`, String(Date.parse(updatedAt)));

  return null;
}
