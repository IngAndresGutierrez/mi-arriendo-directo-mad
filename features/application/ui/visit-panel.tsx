"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClockIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  MessageSquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

import { confirmVisit, declineVisit, proposeVisit, recordVisitVerdict } from "../actions/visit";
import {
  visitHostLine,
  visitState,
  visitTime,
  visitWhen,
  type Visit,
  type VisitCopy,
  type VisitOutcome,
} from "../domain/visit";

/**
 * The visit stage, from whichever side is reading.
 *
 * The landlord proposes a day and where to meet; the tenant confirms it or asks for another; and
 * after going, **the tenant** says whether the property is for them, which is what lets the process
 * continue. The visit itself happens at the property — this holds the two things that get lost
 * arranging it over chat: when, and where exactly to turn up.
 */
export function VisitPanel({
  applicationId,
  visit,
  isLandlord,
  suggestedMeetingPoint = "",
  readOnly = false,
  copy,
}: {
  readonly applicationId: string;
  readonly visit: Visit | null;
  readonly isLandlord: boolean;
  /**
   * The address the landlord gave when publishing, to fill the field with.
   *
   * Read on the server from `properties/{id}/private/location` **for the owner alone** and passed
   * only to them — the tenant's copy of this panel never receives it, and what they see is
   * whatever the landlord chose to write. Offering it is not a detail: they typed that address
   * once already, and asking for it again is asking for something the product has.
   */
  readonly suggestedMeetingPoint?: string;
  /** A finished stage keeps its panel, without its controls. */
  readonly readOnly?: boolean;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: VisitCopy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const state = visitState(visit);
  // Proposing again after a decline is the normal path, so the form opens by itself there.
  const [proposing, setProposing] = useState(false);
  // And changing your mind about a flat you have seen is normal too, so it is one click away.
  const [rethinking, setRethinking] = useState(false);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? copy.saveFailed);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  const decided = state === "interested" || state === "not_interested";
  const showProposeForm =
    isLandlord && !readOnly && (state === "none" || state === "declined" || proposing);
  const showVerdictForm = !isLandlord && !readOnly && (state === "confirmed" || rethinking);

  return (
    <div className="space-y-4">
      {visit ? (
        <Appointment visit={visit} isLandlord={isLandlord} copy={copy} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {isLandlord
            ? "{copy.proposeIntroLandlord}"
            : copy.proposeIntroTenant}
        </p>
      )}

      {/* Lo que toca hacer ahora, según quién mira y en qué punto está la visita. */}
      {state === "proposed" && !isLandlord && !readOnly && (
        <TenantAnswer
          copy={copy}
          pending={pending}
          onConfirm={() => run(() => confirmVisit(applicationId))}
          onDecline={(note) => run(() => declineVisit(applicationId, { note }))}
        />
      )}

      {state === "declined" && !isLandlord && !readOnly && (
        <p className="text-sm text-muted-foreground">
          {copy.weToldTheLandlord}
        </p>
      )}

      {state === "proposed" && isLandlord && !readOnly && !proposing && (
        <p className="text-sm text-muted-foreground">
          {copy.awaitingTenant}
        </p>
      )}

      {showVerdictForm ? (
        <VerdictForm
          copy={copy}
          pending={pending}
          again={decided}
          onCancel={rethinking ? () => setRethinking(false) : undefined}
          onSubmit={(values) =>
            run(() => recordVisitVerdict(applicationId, values), () => setRethinking(false))
          }
        />
      ) : (
        !isLandlord &&
        !readOnly &&
        decided && (
          <Button type="button" variant="outline" size="xl" onClick={() => setRethinking(true)}>
            {copy.changeMyAnswer}
          </Button>
        )
      )}

      {state === "confirmed" && isLandlord && !readOnly && !proposing && (
        <p className="text-sm text-muted-foreground">
          {copy.landlordWaitsVerdict}
        </p>
      )}

      {showProposeForm ? (
        <ProposeForm
          copy={copy}
          pending={pending}
          again={state !== "none"}
          suggested={suggestedMeetingPoint}
          previous={visit?.meetingPoint ?? ""}
          onCancel={proposing ? () => setProposing(false) : undefined}
          onSubmit={(values) =>
            run(() => proposeVisit(applicationId, values), () => setProposing(false))
          }
        />
      ) : (
        isLandlord &&
        !readOnly &&
        state !== "none" && (
          <Button type="button" variant="outline" size="xl" onClick={() => setProposing(true)}>
            <CalendarClockIcon aria-hidden="true" />
            {decided ? "Proponer otra visita" : copy.proposeAnother}
          </Button>
        )
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The appointment as it stands: when, where, and what each side still owes the other. */
function Appointment({
  visit,
  isLandlord,
  copy,
}: {
  readonly visit: Visit;
  readonly isLandlord: boolean;
  readonly copy: VisitCopy;
}) {
  const state = visitState(visit);
  const confirmed = state === "confirmed" || state === "interested" || state === "not_interested";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            state === "not_interested"
              ? "bg-destructive/10 text-destructive"
              : confirmed
                ? "bg-status-approved-bg text-status-approved"
                : state === "declined"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-status-current-bg text-status-current",
          )}
        >
          {confirmed && state !== "not_interested" && (
            <CheckIcon className="size-3" aria-hidden="true" />
          )}
          {state === "not_interested"
            ? "Visitada"
            : state === "interested"
              ? copy.visited
              : confirmed
                ? copy.confirmedBadge
                : state === "declined"
                  ? copy.noDay
                  : copy.unconfirmed}
        </span>
      </div>

      <p className="flex items-start gap-2 font-medium text-foreground">
        <CalendarClockIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="first-letter:uppercase">{visitWhen(visit)}</span>
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
        {visitTime(visit.at)} (hora de Colombia)
      </p>

      {/*
        Quién va a abrir la puerta, cuando no es el dueño. Va **arriba del punto de encuentro** a
        propósito: el inquilino está a punto de encontrarse con un desconocido en una dirección, y
        el nombre es lo que convierte eso en una cita en vez de en un mensaje raro. Igual que el
        punto de encuentro, se lee aquí y nunca sale en un correo.
      */}
      {visitHostLine(visit) ? (
        <p className="flex items-start gap-2 text-sm">
          <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-foreground">
            {isLandlord ? "Lo muestra " : "Te lo muestra "}
            <span className="font-medium">{visitHostLine(visit)}</span>
          </span>
        </p>
      ) : null}

      {/*
        El punto de encuentro, que solo vive aquí: es el único campo del proceso que entrega la
        dirección, así que se lee en esta página y detrás de la sesión, y nunca sale en un correo
        ni en la campana. Misma regla que los datos de la cuenta del canon.
      */}
      <p className="flex items-start gap-2 text-sm">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-foreground">{visit.meetingPoint}</span>
      </p>

      {visit.note && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <MessageSquareIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-foreground">{visit.note}</span>
        </p>
      )}

      {state === "declined" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {isLandlord ? "{copy.tenantDeclined}" : "{copy.youAskedAnother}"}
          {visit.declineNote ? ` ${visit.declineNote}` : ""}
        </p>
      )}

      {visit.verdict && (
        <div className="space-y-1 border-t border-border pt-3">
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              visit.verdict.result === "interested" ? "text-status-approved" : "text-destructive",
            )}
          >
            {visit.verdict.result === "interested" ? (
              <ThumbsUpIcon className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ThumbsDownIcon className="size-4 shrink-0" aria-hidden="true" />
            )}
            {isLandlord
              ? visit.verdict.result === "interested"
                ? copy.tenantInterested
                : copy.tenantNotInterested
              : copy.outcomes[visit.verdict.result]}
          </p>
          {visit.verdict.note && (
            <p className="text-sm text-muted-foreground">{visit.verdict.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** The tenant's two answers to a proposal: yes, or not that day. */
function TenantAnswer({
  pending,
  onConfirm,
  onDecline,
  copy,
}: {
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onDecline: (note: string) => void;
  readonly copy: VisitCopy;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");

  if (asking) {
    return (
      <div className="space-y-2">
        <Label htmlFor="visit-decline">{copy.whichDayWorks}</Label>
        <Input
          id="visit-decline"
          className="h-11"
          placeholder={copy.whichDayPlaceholder}
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="xl"
            disabled={pending}
            onClick={() => onDecline(note)}
          >
            {copy.sendAndAskAnother}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xl"
            disabled={pending}
            onClick={() => setAsking(false)}
          >
            {copy.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="accent" size="xl" disabled={pending} onClick={onConfirm}>
        <CheckIcon aria-hidden="true" />
        {pending ? copy.confirming : copy.confirmVisit}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xl"
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {copy.cantThatDay}
      </Button>
    </div>
  );
}

/** The landlord's proposal: a day, an hour and where exactly to meet. */
function ProposeForm({
  pending,
  again,
  suggested,
  previous,
  onCancel,
  onSubmit,
  copy,
}: {
  readonly pending: boolean;
  readonly again: boolean;
  readonly suggested: string;
  readonly previous: string;
  readonly onCancel?: () => void;
  readonly onSubmit: (values: {
    day: string;
    time: string;
    meetingPoint: string;
    note: string;
  }) => void;
  readonly copy: VisitCopy;
}) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  // Proposing again keeps the place: it is the same property, and the day is what changed.
  const [meetingPoint, setMeetingPoint] = useState(previous);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {again ? copy.proposeAnotherTitle : copy.proposeTitle}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="visit-day">Fecha</Label>
          <Input
            id="visit-day"
            type="date"
            className="h-11"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="visit-time">{copy.time}</Label>
          <Input
            id="visit-time"
            type="time"
            className="h-11"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visit-point">{copy.meetingPoint}</Label>
        <Input
          id="visit-point"
          className="h-11"
          placeholder={copy.meetingPointPlaceholder}
          value={meetingPoint}
          maxLength={300}
          onChange={(event) => setMeetingPoint(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {copy.meetingPointHint}
        </p>
        {/*
          La dirección que ya dio al publicar. La escribió una vez y pedírsela otra vez es pedirle
          algo que el producto tiene — pero se ofrece en vez de rellenarse sola, porque "en la
          portería, pregunta por Alberto" es lo que de verdad sirve para llegar.
        */}
        {suggested && suggested !== meetingPoint && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-sm font-medium text-primary hover:bg-transparent hover:underline dark:text-foreground"
            onClick={() => setMeetingPoint(suggested)}
          >
            <MapPinIcon aria-hidden="true" />
            Usar la dirección del inmueble: {suggested}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="visit-note">{copy.message}</Label>
        <Input
          id="visit-note"
          className="h-11"
          placeholder={copy.messagePlaceholder}
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="xl"
          disabled={pending || !day || !time || meetingPoint.trim().length < 10}
          onClick={() => onSubmit({ day, time, meetingPoint, note })}
        >
          <CalendarClockIcon aria-hidden="true" />
          {pending ? copy.sending : copy.proposeAndNotify}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={onCancel}>
            {copy.cancel}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * What the tenant made of the property, which is what moves the stage on — or stops it.
 *
 * Two buttons rather than a select and a submit: it is a two-way question and the answer is the
 * click. The note is optional and shared, and the form says so — a reason the landlord can read is
 * what keeps a "no" from being a door closing in silence, but demanding one before somebody may
 * say no would be a toll on the answer this stage exists to collect.
 */
function VerdictForm({
  pending,
  again,
  onCancel,
  onSubmit,
  copy,
}: {
  readonly pending: boolean;
  readonly again: boolean;
  readonly onCancel?: () => void;
  readonly onSubmit: (values: { result: VisitOutcome; note: string }) => void;
  readonly copy: VisitCopy;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {again ? copy.changeYourAnswer : copy.afterTheVisit}
      </p>

      <div className="space-y-2">
        <Label htmlFor="visit-verdict-note">{copy.whatYouThought}</Label>
        <Input
          id="visit-verdict-note"
          className="h-11"
          placeholder={copy.whatYouThoughtPlaceholder}
          value={note}
          maxLength={600}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {copy.whatYouThoughtHint}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/*
          El único cian de esta vista: es la respuesta que deja seguir el proceso. La otra es una
          decisión igual de legítima, pero no es la acción de la pantalla — y en cian las dos
          serían dos llamadas compitiendo, que es ninguna.
        */}
        <Button
          type="button"
          variant="accent"
          size="xl"
          disabled={pending}
          onClick={() => onSubmit({ result: "interested", note })}
        >
          <ThumbsUpIcon aria-hidden="true" />
          {pending ? copy.saving : copy.interested}
        </Button>
        <Button
          type="button"
          variant="brand"
          size="xl"
          disabled={pending}
          onClick={() => onSubmit({ result: "not_interested", note })}
        >
          <ThumbsDownIcon aria-hidden="true" />
          {copy.notInterested}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={onCancel}>
            {copy.cancel}
          </Button>
        )}
      </div>
    </div>
  );
}
