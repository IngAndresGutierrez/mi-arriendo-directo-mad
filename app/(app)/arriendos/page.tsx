import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react";

import { LeaseCard, listLeasesFor, listPeriods } from "@/features/lease";
import { requireCompleteProfile } from "@/features/profile";
import {
  CONTRACTS_ROUTE,
  PROPERTIES_ROUTE,
  RENTALS_ROUTE,
  SUPPORT_ROUTE,
} from "@/shared/auth/routes";
import { bogotaToday } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = {
  title: "Arriendos",
  description: "Los arriendos en curso, mes a mes: lo que se pagó y lo que falta.",
};

/**
 * The tenancies someone is part of, on either side.
 *
 * This is the other half of the product. `/contratos` is the negotiation that ends in a signed
 * contract; this is the year that follows it, and the question it answers is not "¿vamos a hacer
 * esto?" but "¿está pagado este mes?".
 *
 * The URL used to forward here to `/contratos`, because the nine-stage process lived at this path
 * and every notification sent up to then pointed at it. That is why the forward was a 307 written in
 * the page and never a rule in `next.config.ts`: this file is the one that had to replace it.
 */
export default async function RentalsPage() {
  const user = await requireCompleteProfile();
  const listing = await listLeasesFor(user.uid);
  const leases = listing.ok ? listing.leases : [];

  /*
   * The months of every tenancy, in parallel. Awaited one after another this would be one round trip
   * per tenancy before the page could render — and the aggregate is computed from the months rather
   * than kept as a counter, precisely so there is no second number that can disagree with them.
   */
  const periods = await Promise.all(leases.map((lease) => listPeriods(lease.id)));
  // Read once, on the server, and passed down: a browser clock is the one thing on this page that
  // neither party controls, and "vencido" is a word that has to mean the same for both of them.
  const today = bogotaToday(new Date());

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Arriendos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Los arriendos que ya están andando, mes a mes. Aquí lo ven las dos partes.
      </p>

      {!listing.ok ? (
        /*
          **"No pudimos" y "no tienes" son dos respuestas distintas**, y confundirlas es el peor bug
          que este producto ya envió una vez: la tarjeta de inicio leía una colección que nada
          escribía y le decía "todavía no tienes contratos" a alguien con tres procesos abiertos. Un
          fallo de lectura no se dibuja como un vacío.

          Tampoco como una pantalla de error de Next: la causa normal es un índice compuesto recién
          desplegado, que existe y tarda unos minutos en poder usarse — una ventana que trae consigo
          *cada* índice nuevo que este producto añada.
        */
        <div
          role="alert"
          className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center"
        >
          <TriangleAlertIcon className="size-8 text-status-pending" aria-hidden="true" />
          <div className="max-w-md space-y-1">
            <p className="font-medium text-foreground">No pudimos cargar tus arriendos</p>
            <p className="text-sm text-muted-foreground">
              Fue un problema nuestro, no tuyo, y no le pasó nada a tu información. Vuelve a cargar
              la página en un momento; si sigue igual, escríbenos.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="accent" size="xl">
              <Link href={RENTALS_ROUTE}>Volver a intentar</Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href={SUPPORT_ROUTE}>Escribir a soporte</Link>
            </Button>
          </div>
        </div>
      ) : leases.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <CalendarClockIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Todavía no tienes ningún arriendo en curso. Un arriendo empieza aquí cuando el proceso
            llega a su última etapa y el propietario confirma el primer canon.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="accent" size="xl">
              <Link href={CONTRACTS_ROUTE}>Ver mis contratos</Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href={PROPERTIES_ROUTE}>Ver inmuebles</Link>
            </Button>
          </div>
        </div>
      ) : (
        /*
          Uno por fila: la barra del término y los dos números que importan — pagados y sin pagar —
          dejan de leerse en media columna, y son justo lo que trae a alguien a esta pantalla.
        */
        <ul className="mt-8 space-y-4">
          {leases.map((lease, index) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              periods={periods[index] ?? []}
              viewerUid={user.uid}
              today={today}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
