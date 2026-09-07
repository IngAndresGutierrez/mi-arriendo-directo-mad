import { dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { ArrowRightIcon, CalendarClockIcon, ClipboardListIcon, MapPinIcon } from "lucide-react";

import {
  CollaboratorLogin,
  errandState,
  isOverdue,
  listErrandsForCollaborator,
  sortForCollaborator,
  ERRAND_STATE_LABELS,
  ERRAND_TYPE_LABELS,
} from "@/features/collaboration";
import { collaboratorErrandRoute, HOME_ROUTE } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { BOGOTA_ZONE_NOTE, formatBogotaWeekdayTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = {
  title: "Tus encargos",
};

/**
 * The collaborator's whole product: what they were asked to do.
 *
 * **The login lives on this route rather than on one of its own.** There is exactly one page behind
 * it, so a separate `/colaborador/entrar` would be a URL whose only purpose is to redirect to this
 * one — and somebody arriving from an SMS link with an expired session would bounce between the two.
 * No session means the form; a session means the list.
 *
 * **Somebody signed in as a landlord or a tenant is not shown the form.** They already have an
 * identity, and offering to sign in as somebody else on top of it is how two sessions end up
 * disagreeing. They are told plainly and pointed back at the portal.
 */
export default async function CollaboratorPage() {
  const user = await getSessionUser();

  if (!user) return <CollaboratorLogin common={(await dictionary()).common} />;

  if (user.role !== "collaborator") {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          Esta página es de los colaboradores
        </h1>
        <p className="mt-2 text-muted-foreground">
          Tu cuenta es del portal, así que tus cosas están allá. Si además te encargaron algo, entra
          con el número donde te llegó, desde una sesión cerrada.
        </p>
        <Button asChild variant="accent" size="xl" className="mt-8">
          <Link href={HOME_ROUTE}>Ir a mi portal</Link>
        </Button>
      </>
    );
  }

  const errands = sortForCollaborator(await listErrandsForCollaborator(user.uid));
  const now = new Date();

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Tus encargos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lo que te pidieron hacer. Abre uno para confirmarlo o marcarlo terminado.
      </p>

      {errands.length === 0 ? (
        /*
         * The empty state is not an error and does not apologise. A sporadic collaborator having
         * nothing to do is the normal case most of the time — it is the whole shape of the role —
         * so this says what will happen rather than what is missing.
         */
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <ClipboardListIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Ahora mismo no tienes encargos. Cuando te asignen uno te llega un mensaje por WhatsApp y
            por SMS, y aparece aquí.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {errands.map((errand) => {
            const state = errandState(errand);
            const late = isOverdue(errand, now);

            return (
              <li
                key={errand.id}
                className="relative rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {ERRAND_TYPE_LABELS[errand.type]}
                  </p>
                  {/*
                    The state is a word, never a colour alone: "Confirmado" and "Sin confirmar" have
                    to survive being read out, and a badge that only differs in hue says nothing to
                    somebody who cannot tell those hues apart.
                  */}
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {ERRAND_STATE_LABELS[state]}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-balance text-primary dark:text-foreground">
                  {/* Stretched over the card: four words at the top is a hit area people miss. */}
                  <Link
                    href={collaboratorErrandRoute(errand.id)}
                    className="after:absolute after:inset-0 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {errand.title}
                  </Link>
                </h2>

                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                    {errand.propertyArea}
                  </li>
                  <li className="flex items-center gap-2">
                    <CalendarClockIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span className={late ? "font-medium text-destructive" : undefined}>
                      {formatBogotaWeekdayTime(errand.dueAt)} {BOGOTA_ZONE_NOTE}
                      {late ? " · se pasó la fecha" : ""}
                    </span>
                  </li>
                </ul>

                <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary dark:text-foreground">
                  Ver el encargo
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
