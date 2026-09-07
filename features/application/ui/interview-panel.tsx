"use client";

import type { InterviewCopy } from "../domain/interview";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClockIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  VideoIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/form/select-field";
import { BOGOTA_ZONE_NOTE } from "@/shared/format/date";
import { cn } from "@/shared/lib/utils";

import {
  confirmInterview,
  declineInterview,
  proposeInterview,
  recordInterviewFeedback,
} from "../actions/interview";
import {
  channelNeedsLink,
  interviewState,
  interviewTimeRange,
  interviewWhen,
  INTERVIEW_CHANNELS,
  INTERVIEW_MINUTES,
  INTERVIEW_RESULTS,
  MEET_CREATE_URL,
  type Interview,
  type InterviewChannel,
} from "../domain/interview";

/*
 * Built **per render** from the `copy` prop rather than hoisted to module scope: a module constant
 * cannot be re-evaluated per language, so hoisting would freeze the options in whichever one loaded
 * first. Two `map`s over three and two values.
 */
function channelOptions(copy: InterviewCopy) {
  return INTERVIEW_CHANNELS.map((value) => ({ value, label: copy.channels[value] }));
}

function resultOptions(copy: InterviewCopy) {
  return INTERVIEW_RESULTS.map((value) => ({ value, label: copy.results[value] }));
}

/**
 * The interview stage, from whichever side is reading.
 *
 * The landlord proposes a time and, once it has been confirmed and held, writes down how it
 * went; the tenant confirms it or asks for another one. Everything else about this stage happens
 * on Meet, on WhatsApp or on the phone — the product does not host the call, it holds the
 * agreement about when it is, which is the part that gets lost in a chat thread.
 */
export function InterviewPanel({
  applicationId,
  interview,
  isLandlord,
  readOnly = false,
  copy,
}: {
  readonly applicationId: string;
  readonly interview: Interview | null;
  readonly isLandlord: boolean;
  /** A finished stage keeps its panel, without its controls. */
  readonly readOnly?: boolean;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: InterviewCopy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const state = interviewState(interview);
  // Proposing again after a decline is the normal path, so the form opens by itself there.
  const [proposing, setProposing] = useState(false);

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

  const showProposeForm =
    isLandlord && !readOnly && (state === "none" || state === "declined" || proposing);

  return (
    <div className="space-y-4">
      {interview ? (
        <Appointment interview={interview} isLandlord={isLandlord} copy={copy} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {isLandlord
            ? `Propón una fecha y una hora para hablar ${INTERVIEW_MINUTES} minutos con el inquilino, por videollamada o por teléfono.`
            : `El propietario propondrá una fecha para hablar ${INTERVIEW_MINUTES} minutos contigo. Te avisaremos aquí y por correo.`}
        </p>
      )}

      {/* Lo que toca hacer ahora, según quién mira y en qué punto está la cita. */}
      {state === "proposed" && !isLandlord && !readOnly && (
        <TenantAnswer
          copy={copy}
          pending={pending}
          onConfirm={() => run(() => confirmInterview(applicationId))}
          onDecline={(note) => run(() => declineInterview(applicationId, { note }))}
        />
      )}

      {state === "declined" && !isLandlord && !readOnly && (
        <p className="text-sm text-muted-foreground">
          {copy.weToldTheLandlord}
        </p>
      )}

      {state === "confirmed" && isLandlord && !readOnly && (
        <FeedbackForm
          copy={copy}
          pending={pending}
          onSubmit={(values) => run(() => recordInterviewFeedback(applicationId, values))}
        />
      )}

      {state === "confirmed" && !isLandlord && (
        <p className="text-sm text-muted-foreground">
          {copy.confirmedNote}
        </p>
      )}

      {showProposeForm ? (
        <ProposeForm
          copy={copy}
          pending={pending}
          again={state !== "none"}
          onCancel={proposing ? () => setProposing(false) : undefined}
          onSubmit={(values) =>
            run(() => proposeInterview(applicationId, values), () => setProposing(false))
          }
        />
      ) : (
        isLandlord &&
        !readOnly &&
        state === "proposed" && (
          <Button type="button" variant="outline" size="xl" onClick={() => setProposing(true)}>
            <CalendarClockIcon aria-hidden="true" />{copy.proposeAnotherAction}</Button>
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
  interview,
  isLandlord,
  copy,
}: {
  readonly interview: Interview;
  readonly isLandlord: boolean;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: InterviewCopy;
}) {
  const state = interviewState(interview);
  const confirmed = state === "confirmed" || state === "done";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            confirmed
              ? "bg-status-approved-bg text-status-approved"
              : state === "declined"
                ? "bg-destructive/10 text-destructive"
                : "bg-status-current-bg text-status-current",
          )}
        >
          {confirmed && <CheckIcon className="size-3" aria-hidden="true" />}
          {confirmed ? copy.confirmedBadge : state === "declined" ? copy.noSlotBadge : copy.unconfirmedBadge}
        </span>
        <span className="text-xs text-muted-foreground">
          {copy.channels[interview.channel]} · {INTERVIEW_MINUTES} {copy.minutes}
        </span>
      </div>

      <p className="flex items-start gap-2 font-medium text-foreground">
        <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="first-letter:uppercase">{interviewWhen(interview)}</span>
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
        {interviewTimeRange(interview.at)} {BOGOTA_ZONE_NOTE}
      </p>

      {/*
        El enlace solo aparece una vez confirmada: antes de eso no hay nada a lo que entrar, y
        ofrecerlo invita a intentarlo el día equivocado.
      */}
      {interview.link && confirmed && (
        /*
          El único cian de esta vista, y con razón: es la acción con hora. Como `outline` apenas
          tenía borde sobre el fondo del panel y se leía como una nota al pie, siendo lo que da
          sentido a la etapa. El formulario de la conclusión, que se ve a la vez, va en morado.
        */
        <Button asChild variant="accent" size="xl">
          <a href={interview.link} target="_blank" rel="noopener noreferrer">
            <VideoIcon aria-hidden="true" />{copy.joinCall}<ExternalLinkIcon aria-hidden="true" />
          </a>
        </Button>
      )}
      {!interview.link && channelNeedsLink(interview.channel) === false && (
        <p className="text-sm text-muted-foreground">
          {interview.channel === "whatsapp"
            ? "{copy.whatsappNote}"
            : "{copy.phoneNote}"}
        </p>
      )}

      {interview.note && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-foreground">{interview.note}</span>
        </p>
      )}

      {state === "declined" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {isLandlord ? "Al inquilino no le sirve ese horario." : "Pediste otro horario."}
          {interview.declineNote ? ` ${interview.declineNote}` : ""}
        </p>
      )}

      {interview.feedback && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">
            {copy.results[interview.feedback.result]}
          </p>
          <p className="text-sm text-muted-foreground">{interview.feedback.note}</p>
        </div>
      )}
    </div>
  );
}

/** The tenant's two answers: yes, or not at that time. */
function TenantAnswer({
  pending,
  onConfirm,
  onDecline,
  copy,
}: {
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onDecline: (note: string) => void;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: InterviewCopy;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");

  if (asking) {
    return (
      <div className="space-y-2">
        <Label htmlFor="interview-decline">{copy.whichSlotWorks}</Label>
        <Input
          id="interview-decline"
          className="h-11"
          placeholder={copy.declinePlaceholder}
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xl" disabled={pending} onClick={() => onDecline(note)}>{copy.sendAndAskAnother}</Button>
          <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={() => setAsking(false)}>{copy.cancel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="accent" size="xl" disabled={pending} onClick={onConfirm}>
        <CheckIcon aria-hidden="true" />
        {pending ? copy.confirming : copy.confirmSlot}
      </Button>
      <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={() => setAsking(true)}>{copy.cantThatTime}</Button>
    </div>
  );
}

/** The landlord's proposal: a day, an hour, a channel and — for a Meet — the link. */
function ProposeForm({
  pending,
  again,
  onCancel,
  onSubmit,
  copy,
}: {
  readonly pending: boolean;
  readonly again: boolean;
  readonly onCancel?: () => void;
  readonly onSubmit: (values: {
    day: string;
    time: string;
    channel: InterviewChannel;
    link: string;
    note: string;
  }) => void;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: InterviewCopy;
}) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [channel, setChannel] = useState<InterviewChannel>("meet");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {again ? copy.proposeAnother : `Propón la entrevista de ${INTERVIEW_MINUTES} minutos`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="interview-day">{copy.date}</Label>
          <Input
            id="interview-day"
            type="date"
            className="h-11"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-time">{copy.time}</Label>
          <Input
            id="interview-time"
            type="time"
            className="h-11"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <SelectField
        id="interview-channel"
        label={copy.channelLabel}
        placeholder={copy.channelPlaceholder}
        options={channelOptions(copy)}
        value={channel}
        onValueChange={(value) => setChannel(value as InterviewChannel)}
      />

      {channelNeedsLink(channel) && (
        <div className="space-y-2">
          <Label htmlFor="interview-link">{copy.meetingLink}</Label>
          <Input
            id="interview-link"
            type="url"
            className="h-11"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {/*
              El enlace de crearla, no solo la instrucción: la reunión se hace en Google y volver
              con su enlace es el trámite que hay que hacer antes de poder llenar el campo.
            */}
            <a
              href={MEET_CREATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-foreground"
            >{copy.createMeet}<ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            </a>{" "}
            y pega aquí el enlace. El inquilino lo verá al confirmar.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="interview-note">{copy.message}</Label>
        <Input
          id="interview-note"
          className="h-11"
          placeholder="{copy.declineHint}"
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
          disabled={pending || !day || !time}
          onClick={() => onSubmit({ day, time, channel, link, note })}
        >
          <CalendarClockIcon aria-hidden="true" />
          {pending ? copy.sending : "Proponer y avisar al inquilino"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="xl" disabled={pending} onClick={onCancel}>{copy.cancel}</Button>
        )}
      </div>
    </div>
  );
}

/** How it went, in the landlord's words. The tenant reads it, and the panel says so. */
function FeedbackForm({
  pending,
  onSubmit,
  copy,
}: {
  readonly pending: boolean;
  readonly onSubmit: (values: { result: string; note: string }) => void;
  /**
   * This panel's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary would put both languages in the browser bundle.
   */
  readonly copy: InterviewCopy;
}) {
  const [result, setResult] = useState<string>("went_well");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">{copy.afterTheInterview}</p>

      <SelectField
        id="interview-result"
        label={copy.howDidItGo}
        placeholder={copy.chooseOption}
        options={resultOptions(copy)}
        value={result}
        onValueChange={setResult}
      />

      <div className="space-y-2">
        <Label htmlFor="interview-feedback">{copy.conclusionLabel}</Label>
        <Input
          id="interview-feedback"
          className="h-11"
          placeholder={copy.conclusionPlaceholder}
          value={note}
          maxLength={600}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {copy.conclusionHint}
        </p>
      </div>

      <Button
        type="button"
        /*
          `brand`, no `accent`: este formulario se ve al mismo tiempo que "Entrar a la
          videollamada", y en cian le quitaba el protagonismo justo a la acción con hora. Escribir
          la conclusión desbloquea la etapa, pero se puede hacer después; la llamada no.
          Un solo cian por vista.
        */
        variant="brand"
        size="xl"
        disabled={pending || note.trim().length < 10}
        onClick={() => onSubmit({ result, note })}
      >
        {pending ? copy.saving : copy.saveConclusion}
      </Button>
    </div>
  );
}
