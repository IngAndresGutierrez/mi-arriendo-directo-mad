"use client";

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
  INTERVIEW_CHANNEL_LABELS,
  INTERVIEW_MINUTES,
  INTERVIEW_RESULTS,
  INTERVIEW_RESULT_LABELS,
  type Interview,
  type InterviewChannel,
} from "../domain/interview";

const CHANNEL_OPTIONS = INTERVIEW_CHANNELS.map((value) => ({
  value,
  label: INTERVIEW_CHANNEL_LABELS[value],
}));

const RESULT_OPTIONS = INTERVIEW_RESULTS.map((value) => ({
  value,
  label: INTERVIEW_RESULT_LABELS[value],
}));

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
}: {
  readonly applicationId: string;
  readonly interview: Interview | null;
  readonly isLandlord: boolean;
  /** A finished stage keeps its panel, without its controls. */
  readonly readOnly?: boolean;
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
        setError(result.message ?? "No pudimos guardar el cambio.");
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
        <Appointment interview={interview} isLandlord={isLandlord} />
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
          pending={pending}
          onConfirm={() => run(() => confirmInterview(applicationId))}
          onDecline={(note) => run(() => declineInterview(applicationId, { note }))}
        />
      )}

      {state === "declined" && !isLandlord && !readOnly && (
        <p className="text-sm text-muted-foreground">
          Le avisamos al propietario que ese horario no te sirve. Te escribirá con otro.
        </p>
      )}

      {state === "confirmed" && isLandlord && !readOnly && (
        <FeedbackForm
          pending={pending}
          onSubmit={(values) => run(() => recordInterviewFeedback(applicationId, values))}
        />
      )}

      {state === "confirmed" && !isLandlord && (
        <p className="text-sm text-muted-foreground">
          Confirmaste la entrevista. Después de hablar, el propietario escribirá aquí cómo fue.
        </p>
      )}

      {showProposeForm ? (
        <ProposeForm
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
          <Button type="button" variant="outline" size="lg" onClick={() => setProposing(true)}>
            <CalendarClockIcon aria-hidden="true" />
            Proponer otro horario
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
  interview,
  isLandlord,
}: {
  readonly interview: Interview;
  readonly isLandlord: boolean;
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
          {confirmed ? "Confirmada" : state === "declined" ? "Sin horario" : "Sin confirmar"}
        </span>
        <span className="text-xs text-muted-foreground">
          {INTERVIEW_CHANNEL_LABELS[interview.channel]} · {INTERVIEW_MINUTES} minutos
        </span>
      </div>

      <p className="flex items-start gap-2 font-medium text-foreground">
        <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="first-letter:uppercase">{interviewWhen(interview)}</span>
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
        {interviewTimeRange(interview.at)} (hora de Colombia)
      </p>

      {/*
        El enlace solo aparece una vez confirmada: antes de eso no hay nada a lo que entrar, y
        ofrecerlo invita a intentarlo el día equivocado.
      */}
      {interview.link && confirmed && (
        <Button asChild variant="outline" size="lg">
          <a href={interview.link} target="_blank" rel="noopener noreferrer">
            <VideoIcon aria-hidden="true" />
            Entrar a la videollamada
            <ExternalLinkIcon aria-hidden="true" />
          </a>
        </Button>
      )}
      {!interview.link && channelNeedsLink(interview.channel) === false && (
        <p className="text-sm text-muted-foreground">
          {interview.channel === "whatsapp"
            ? "La videollamada será por WhatsApp, al número que registraron."
            : "Será una llamada telefónica al número que registraron."}
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
            {INTERVIEW_RESULT_LABELS[interview.feedback.result]}
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
}: {
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onDecline: (note: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");

  if (asking) {
    return (
      <div className="space-y-2">
        <Label htmlFor="interview-decline">¿Qué horario te sirve?</Label>
        <Input
          id="interview-decline"
          className="h-11"
          placeholder="Entre semana después de las 6 p. m."
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => onDecline(note)}>
            Enviar y pedir otro horario
          </Button>
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => setAsking(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="accent" size="lg" disabled={pending} onClick={onConfirm}>
        <CheckIcon aria-hidden="true" />
        {pending ? "Confirmando…" : "Confirmar el horario"}
      </Button>
      <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => setAsking(true)}>
        No puedo a esa hora
      </Button>
    </div>
  );
}

/** The landlord's proposal: a day, an hour, a channel and — for a Meet — the link. */
function ProposeForm({
  pending,
  again,
  onCancel,
  onSubmit,
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
}) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [channel, setChannel] = useState<InterviewChannel>("meet");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {again ? "Propón otro horario" : `Propón la entrevista de ${INTERVIEW_MINUTES} minutos`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="interview-day">Fecha</Label>
          <Input
            id="interview-day"
            type="date"
            className="h-11"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-time">Hora (Colombia)</Label>
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
        label="Por dónde"
        placeholder="Elige el medio"
        options={CHANNEL_OPTIONS}
        value={channel}
        onValueChange={(value) => setChannel(value as InterviewChannel)}
      />

      {channelNeedsLink(channel) && (
        <div className="space-y-2">
          <Label htmlFor="interview-link">Enlace de la reunión</Label>
          <Input
            id="interview-link"
            type="url"
            className="h-11"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Créala en Google Meet y pega aquí el enlace. El inquilino lo verá al confirmar.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="interview-note">Mensaje (opcional)</Label>
        <Input
          id="interview-note"
          className="h-11"
          placeholder="Si no te sirve, dime qué días puedes."
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={pending || !day || !time}
          onClick={() => onSubmit({ day, time, channel, link, note })}
        >
          <CalendarClockIcon aria-hidden="true" />
          {pending ? "Enviando…" : "Proponer y avisar al inquilino"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

/** How it went, in the landlord's words. The tenant reads it, and the panel says so. */
function FeedbackForm({
  pending,
  onSubmit,
}: {
  readonly pending: boolean;
  readonly onSubmit: (values: { result: string; note: string }) => void;
}) {
  const [result, setResult] = useState<string>("went_well");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">Después de la entrevista</p>

      <SelectField
        id="interview-result"
        label="¿Cómo te fue?"
        placeholder="Elige una opción"
        options={RESULT_OPTIONS}
        value={result}
        onValueChange={setResult}
      />

      <div className="space-y-2">
        <Label htmlFor="interview-feedback">Qué quedó de la conversación</Label>
        <Input
          id="interview-feedback"
          className="h-11"
          placeholder="Quedó de enviar el soporte de ingresos del mes pasado."
          value={note}
          maxLength={600}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          El inquilino también lo lee. Sin esto el proceso no puede avanzar.
        </p>
      </div>

      <Button
        type="button"
        variant="accent"
        size="lg"
        disabled={pending || note.trim().length < 10}
        onClick={() => onSubmit({ result, note })}
      >
        {pending ? "Guardando…" : "Guardar la conclusión"}
      </Button>
    </div>
  );
}
