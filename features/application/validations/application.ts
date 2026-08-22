import { z } from "zod";

import { LEASE_TERMS, type LeaseTerm } from "@/features/property/client";

/** What the application form adds on top of the reusable dossier. */
export const applicationDetailsSchema = z.object({
  desiredMoveIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha."),
  leaseMonths: z.coerce
    .number()
    .refine((value): value is LeaseTerm => LEASE_TERMS.includes(value as LeaseTerm), {
      message: "Elige 6 meses o 1 año.",
    }),
  message: z.string().trim().max(600, "Resúmelo en menos palabras.").default(""),
});

/**
 * The move-in date has to be a day that has not passed.
 *
 * Compared as calendar days in `YYYY-MM-DD`, never as instants: the server runs in UTC and
 * "today" in Bogotá is five hours behind it, so an instant comparison rejects a perfectly valid
 * "today" for five hours every night.
 */
export function validateDesiredMoveIn(day: string, today: Date): { ok: true } | { ok: false; error: string } {
  const bogotaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(today);

  return day >= bogotaToday
    ? { ok: true }
    : { ok: false, error: "Elige una fecha de hoy en adelante." };
}
