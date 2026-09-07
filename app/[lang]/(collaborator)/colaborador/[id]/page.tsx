import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, CalendarClockIcon, MapPinIcon, PhoneIcon } from "lucide-react";

import {
  errandState,
  ErrandActions,
  getErrandFor,
  isOverdue,
  ERRAND_STATE_LABELS,
  ERRAND_TYPE_LABELS,
} from "@/features/collaboration";
import { COLLABORATOR_ROUTE } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { BOGOTA_ZONE_NOTE, formatBogotaWeekdayTime } from "@/shared/format/date";

export const metadata: Metadata = {
  title: "Encargo",
};

/**
 * One errand, from the side of the person who has to do it.
 *
 * **A non-party gets a 404, the same answer as an errand that does not exist** — the rule
 * `/contratos/<id>` already follows, and the reason is that the two must be indistinguishable. If
 * "no eres parte" and "no existe" read differently, the difference is a way of confirming that a
 * given id is real.
 *
 * What is on screen is deliberately narrow: the job, where, when, and who to call. No tenant, no
 * dossier, no process. Delegating who opens a door is not delegating who gets the apartment, and the
 * safest way to keep that true is for the data never to arrive here — which is why the errand
 * carries its own copies of the title and the area rather than reaching into the property.
 */
export default async function CollaboratorErrandPage(props: PageProps<"/[lang]/colaborador/[id]">) {
  const user = await getSessionUser();
  // No session at all is not a 404: it is somebody who followed the link from their SMS after the
  // cookie expired, and the front door knows how to let them back in.
  if (!user) redirect(COLLABORATOR_ROUTE);

  const { id } = await props.params;
  const errand = await getErrandFor(id, user.uid);
  if (!errand || errand.collaboratorUid !== user.uid) notFound();

  const state = errandState(errand);
  const late = isOverdue(errand, new Date());

  return (
    <>
      {/* A real link, not `history.back()`: this page is reached from a text message. */}
      <Link
        href={COLLABORATOR_ROUTE}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Todos tus encargos
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{ERRAND_TYPE_LABELS[errand.type]}</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          {ERRAND_STATE_LABELS[state]}
        </span>
      </div>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        {errand.title}
      </h1>

      <ul className="mt-5 space-y-2 text-sm text-foreground">
        <li className="flex items-center gap-2">
          <MapPinIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {errand.propertyTitle} · {errand.propertyArea}
        </li>
        <li className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={late ? "font-medium text-destructive" : undefined}>
            {formatBogotaWeekdayTime(errand.dueAt)} {BOGOTA_ZONE_NOTE}
            {late ? " · se pasó la fecha" : ""}
          </span>
        </li>
      </ul>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Qué hay que hacer</h2>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
          {errand.description}
        </p>
      </div>

      <ErrandActions errand={errand} />

      {/*
        What was decided, kept on screen after the buttons are gone. A record that disappears the
        moment it stops being actionable is a record nobody can check — the same reason a finished
        stage keeps its panel folded shut rather than vanishing.
      */}
      {errand.declineReason ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Dijiste que no podías: <span className="text-foreground">{errand.declineReason}</span>
        </p>
      ) : null}
      {errand.completionNote ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Contaste: <span className="text-foreground">{errand.completionNote}</span>
        </p>
      ) : null}
      {errand.cancelReason ? (
        <p className="mt-6 text-sm text-muted-foreground">
          El propietario lo canceló: <span className="text-foreground">{errand.cancelReason}</span>
        </p>
      ) : null}

      {/*
        A phone number, because everything that goes wrong here goes wrong in the street: a gate that
        will not open, somebody who has not arrived. `tel:` rather than a copy button — this screen is
        being read on a phone, where a number is something you press.
      */}
      <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <PhoneIcon className="size-4 shrink-0" aria-hidden="true" />
        ¿Algo no cuadra? Escríbele a quien te lo encargó.
      </p>
    </>
  );
}
