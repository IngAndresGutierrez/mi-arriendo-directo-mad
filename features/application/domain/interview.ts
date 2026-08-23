/**
 * The interview: a landlord proposes a time, the tenant confirms, and afterwards the landlord
 * writes down how it went.
 *
 * The call itself happens somewhere else — Google Meet, WhatsApp, a plain phone call — and the
 * product does not pretend otherwise: it has no video of its own and inventing one would be a
 * feature nobody could use. What it does is the part that keeps getting lost between two people
 * arranging something over chat: **a time both agreed on, in writing**, and a note about what
 * came out of it.
 *
 * The tenant confirming is not a formality. A time only the landlord knows is a time nobody
 * shows up to, and the confirmation is what turns a proposal into an appointment — which is why
 * the process does not move on without it.
 */

/** Half an hour: long enough to ask what matters, short enough that people accept it. */
export const INTERVIEW_MINUTES = 30;

export const INTERVIEW_CHANNELS = ["meet", "whatsapp", "phone"] as const;
export type InterviewChannel = (typeof INTERVIEW_CHANNELS)[number];

export const INTERVIEW_CHANNEL_LABELS: Readonly<Record<InterviewChannel, string>> = {
  meet: "Videollamada por Google Meet",
  whatsapp: "Videollamada por WhatsApp",
  phone: "Llamada telefónica",
};

/**
 * Where a Meet is created.
 *
 * `meet.new` is Google's own shortcut: it opens a fresh meeting and hands over its link, which is
 * exactly the errand the landlord has to run before they can fill in the field below. Asking
 * somebody to "pega el enlace" without saying where the link comes from is asking them to go and
 * find out on their own.
 */
export const MEET_CREATE_URL = "https://meet.new";

/** Only a Meet has something to paste; the other two happen on numbers both already have. */
export function channelNeedsLink(channel: InterviewChannel): boolean {
  return channel === "meet";
}

/**
 * How it went, in the landlord's words.
 *
 * Two outcomes rather than a score: this is a conversation, not an exam. And, like a records
 * search, **neither of them blocks the process** — a reservation is something the landlord
 * weighs when they decide, not something the product decides for them. What blocks is not
 * having held the interview.
 */
export const INTERVIEW_RESULTS = ["went_well", "with_reservations"] as const;
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

export const INTERVIEW_RESULT_LABELS: Readonly<Record<InterviewResult, string>> = {
  went_well: "Salió bien",
  with_reservations: "Con reparos",
};

export type InterviewFeedback = {
  readonly result: InterviewResult;
  /** What was said that is worth keeping. **The tenant reads it too.** ISO 8601 in `at`. */
  readonly note: string;
  readonly at: string;
};

export type Interview = {
  /** The proposed instant, ISO 8601. Stored as an instant, shown in Colombian time. */
  readonly at: string;
  readonly channel: InterviewChannel;
  /** The Meet link, for `meet`. Empty for the other channels. */
  readonly link: string;
  /** Anything the landlord wants to add to the invitation. */
  readonly note: string;
  readonly proposedAt: string;
  /** ISO 8601 when the tenant confirmed, or `null`. */
  readonly confirmedAt: string | null;
  /** ISO 8601 when the tenant asked for another time, or `null`. */
  readonly declinedAt: string | null;
  /** Why that time did not work. The landlord reads it before proposing again. */
  readonly declineNote: string;
  readonly feedback: InterviewFeedback | null;
};

/** Where the arrangement stands, for the header line and for what to render. */
export type InterviewState = "none" | "proposed" | "declined" | "confirmed" | "done";

export function interviewState(interview: Interview | null): InterviewState {
  if (!interview) return "none";
  if (interview.feedback) return "done";
  if (interview.confirmedAt) return "confirmed";
  if (interview.declinedAt) return "declined";
  return "proposed";
}

export const INTERVIEW_STATE_LABELS: Readonly<Record<InterviewState, string>> = {
  none: "Sin agendar",
  proposed: "Esperando confirmación",
  declined: "Hay que proponer otro horario",
  confirmed: "Agendada",
  done: "Realizada",
};

/**
 * Why the process cannot move past the interview.
 *
 * Three answers, and the button says which one — the same shape as the documents and the
 * records searches, because "Continuar" that does nothing and does not say why is the thing
 * this product keeps refusing to ship.
 */
export type InterviewBlocker = "not_proposed" | "not_confirmed" | "no_feedback" | null;

export function interviewBlocker(interview: Interview | null): InterviewBlocker {
  const state = interviewState(interview);

  if (state === "none") return "not_proposed";
  if (state === "proposed" || state === "declined") return "not_confirmed";
  if (state === "confirmed") return "no_feedback";
  return null;
}

export function interviewBlockerMessage(blocker: InterviewBlocker, isLandlord: boolean): string | null {
  switch (blocker) {
    case "not_proposed":
      return isLandlord
        ? "Propón una fecha y una hora para la entrevista antes de continuar."
        : "El propietario todavía no ha propuesto una fecha para la entrevista.";
    case "not_confirmed":
      return isLandlord
        ? "El inquilino aún no confirma el horario propuesto."
        : "Confirma el horario propuesto para que el proceso pueda seguir.";
    case "no_feedback":
      return isLandlord
        ? "Después de la entrevista, escribe cómo te fue para poder continuar."
        : "El propietario todavía no ha registrado cómo fue la entrevista.";
    default:
      return null;
  }
}

/** When it ends, so the panel can say "de 3:00 a 3:30". */
export function interviewEndsAt(at: string): string {
  return new Date(new Date(at).getTime() + INTERVIEW_MINUTES * 60_000).toISOString();
}

/**
 * Has the proposed time already gone by?
 *
 * Used to tell "todavía no ha pasado" from "ya pasó y falta escribir cómo fue": the landlord
 * should not be asked for a conclusion about a conversation that has not happened yet.
 */
export function interviewHasPassed(interview: Interview, now: Date): boolean {
  return new Date(interviewEndsAt(interview.at)).getTime() <= now.getTime();
}

/**
 * The slot in words, in Colombian time: `jueves 10 de septiembre, 3:00 p. m.`
 *
 * One formatter for the panel, the bell and the email, so the three cannot disagree about when
 * the call is — which, for the one piece of information this whole stage exists to carry, would
 * be the worst possible bug.
 */
export function interviewWhen(interview: Pick<Interview, "at">): string {
  const instant = new Date(interview.at);
  if (Number.isNaN(instant.getTime())) return "";

  const day = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(instant);

  return `${day}, ${interviewTime(interview.at)}`;
}

/** `3:00 p. m.`, Colombian time. */
export function interviewTime(at: string): string {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return "";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  }).format(instant);
}

/** `3:00 p. m. a 3:30 p. m.` — half an hour, said out loud. */
export function interviewTimeRange(at: string): string {
  return `${interviewTime(at)} a ${interviewTime(interviewEndsAt(at))}`;
}

/** Colombia has no daylight saving, so this is a fixed -05:00 all year. */
const TIME_ZONE = "America/Bogota";
