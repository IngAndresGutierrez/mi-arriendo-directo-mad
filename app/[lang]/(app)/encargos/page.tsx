import { dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ClipboardListIcon, MapPinIcon, PhoneIcon, UserIcon } from "lucide-react";

import {
  errandState,
  isOverdue,
  listErrandsForLandlord,
  CancelErrandButton,
  ERRAND_STATE_LABELS,
  ERRAND_TYPE_LABELS,
} from "@/features/collaboration";
import { requireCompleteProfile } from "@/features/profile";
import { NEW_ERRAND_ROUTE } from "@/shared/auth/routes";
import { BOGOTA_ZONE_NOTE, formatBogotaWeekdayTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).portal;

  return { title: copy.errandsTitle, description: copy.errandsIntro };
}

/**
 * The errands a landlord has handed out, and how each one is going.
 *
 * **This is the other half of a feature that shipped with only one.** The collaborator could see
 * and answer their errands from day one; the person who created them could not see anything at all
 * — the query existed and no screen used it — so an accepted errand and an ignored one looked
 * identical from this side. Reported exactly that way.
 *
 * It is a page in the portal and not a section of `/mis-inmuebles` because an errand outlives the
 * decision that created it: you assign it from the property, and then you come back to ask "did
 * Carlos confirm?", which is a question about the errand and not about the flat.
 */
export default async function LandlordErrandsPage() {
  const t = (await dictionary()).portal;
  const user = await requireCompleteProfile();
  const errands = await listErrandsForLandlord(user.uid);
  const now = new Date();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        {t.errandsTitle}
      </h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t.errandsIntro}
        </p>
        {/*
          La segunda puerta al mismo formulario. Desde la tarjeta de un inmueble el inmueble ya está
          decidido; desde aquí se elige. `accent` porque en esta pantalla es *la* acción: lo demás
          son tarjetas de lectura y un botón de cancelar por encargo.
        */}
        <Button asChild variant="accent" size="xl">
          <Link href={NEW_ERRAND_ROUTE}>{t.newErrand}</Link>
        </Button>
      </div>

      {errands.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <ClipboardListIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            {t.errandsEmpty}
          </p>
          <Button asChild variant="brand" size="xl">
            <Link href={NEW_ERRAND_ROUTE}>{t.createErrand}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {errands.map((errand) => {
            const state = errandState(errand);
            const late = isOverdue(errand, now);

            return (
              <li key={errand.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {ERRAND_TYPE_LABELS[errand.type]}
                  </p>
                  {/* La palabra, no solo un color: "Confirmado" tiene que sobrevivir a leerse en voz alta. */}
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {ERRAND_STATE_LABELS[state]}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-balance text-primary dark:text-foreground">
                  {errand.title}
                </h2>

                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <UserIcon className="size-4 shrink-0" aria-hidden="true" />
                    {errand.collaboratorName}
                    {/*
                      El teléfono es `tel:` y no texto suelto: cuando algo se tuerce con un encargo,
                      lo que hace el propietario es llamar, y en un móvil un número es algo que se
                      pulsa. Es el mismo número que él escribió, así que no revela nada nuevo.
                    */}
                    <a
                      href={`tel:${errand.collaboratorPhone}`}
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline dark:text-foreground"
                    >
                      <PhoneIcon className="size-3.5" aria-hidden="true" />
                      {errand.collaboratorPhone}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                    {errand.propertyTitle} · {errand.propertyArea}
                  </li>
                  <li className={late ? "font-medium text-destructive" : undefined}>
                    {formatBogotaWeekdayTime(errand.dueAt)} {BOGOTA_ZONE_NOTE}
                    {late ? t.errandLate : ""}
                  </li>
                </ul>

                {/*
                  Lo que dijo el colaborador, en la tarjeta y no detrás de un clic. El motivo de un
                  rechazo es con lo que el propietario decide qué hacer ahora, y esconderlo convierte
                  la lista en un índice de cosas que hay que abrir una por una.
                */}
                {errand.declineReason ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                    {t.errandDeclined} {errand.declineReason}
                  </p>
                ) : null}
                {errand.completionNote ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                    {t.errandCompleted} {errand.completionNote}
                  </p>
                ) : null}
                {errand.cancelReason ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.errandCancelled} {errand.cancelReason}
                  </p>
                ) : null}

                <CancelErrandButton errand={errand} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
