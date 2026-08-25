import { formatBogotaTime, formatBogotaWeekdayTime } from "@/shared/format/date";

/**
 * The visit: the tenant goes to see the property before anything else happens.
 *
 * It is the **second** stage, immediately after the application arrives, and that position is the
 * whole point. Nobody should be asked for their identity document, their payslips or an
 * authorisation to search their judicial record for a flat they have not seen — and nobody should
 * discover the building faces a motorway on the day they are handed a contract to sign. The visit
 * is what makes the six stages after it worth walking.
 *
 * The shape is the interview's, with one deliberate difference: **the verdict is the tenant's**.
 * Whether the property is right is something only the person who went to see it can say, exactly
 * as whether the money arrived is something only the person whose account it is can say, and
 * whether the shower works is something only the person showering can say. A landlord who could
 * mark their own property as "le gustó" would be recording an opinion that is not theirs.
 *
 * The call it inherits from the interview: the landlord proposes the time, because they hold the
 * keys, and the tenant confirms — a time only one side knows is a time nobody turns up to.
 */

export const VISIT_OUTCOMES = ["interested", "not_interested"] as const;
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

export const VISIT_OUTCOME_LABELS: Readonly<Record<VisitOutcome, string>> = {
  interested: "Me interesa el inmueble",
  not_interested: "No me interesa el inmueble",
};

/**
 * What the tenant thought, in their own words.
 *
 * The note is optional on the way in and read by both, like the interview's — but here the
 * asymmetry matters: a "no me interesa" with a reason tells the landlord something about their
 * listing, and one without leaves them guessing why nobody stays.
 */
export type VisitVerdict = {
  readonly result: VisitOutcome;
  /** What the tenant made of it. **The landlord reads it too.** */
  readonly note: string;
  /** ISO 8601. */
  readonly at: string;
};

export type Visit = {
  /** The proposed instant, ISO 8601. Stored as an instant, shown in Colombian time. */
  readonly at: string;
  /**
   * Where to meet, in the landlord's words.
   *
   * **This is the one field in the process that gives away the address**, and it is deliberate:
   * the tenant cannot visit a place they cannot find. What keeps it from undoing
   * `properties/{id}/private/location` is where it is *read* — on this page, behind a session,
   * by the two parties — and, above all, that it **never leaves in a notification**. The bell says
   * there is a visit proposed; where it is happens to be on the page. Same rule as the payout
   * account details, and for the same reason: an email is forwarded, quoted and left open.
   *
   * It is the landlord's own sentence rather than the stored address because "en la portería de la
   * torre 2, pregunta por Alberto" is what somebody actually needs to turn up, and the address on
   * its own is not.
   */
  readonly meetingPoint: string;
  /** Anything the landlord wants to add: parking, which buzzer, bring your ID. */
  readonly note: string;
  readonly proposedAt: string;
  /** ISO 8601 when the tenant confirmed, or `null`. */
  readonly confirmedAt: string | null;
  /** ISO 8601 when the tenant asked for another day, or `null`. */
  readonly declinedAt: string | null;
  /** Why that day did not work. The landlord reads it before proposing again. */
  readonly declineNote: string;
  /** What the tenant said after going, or `null` while they have not. */
  readonly verdict: VisitVerdict | null;
  /**
   * Who is going to open the door, when it is not the owner.
   *
   * `null` means the landlord shows it themselves, which is the ordinary case. It is filled in when
   * a **collaborator** arranges the visit — somebody the landlord asked to help with this property —
   * and it exists because the tenant is about to meet a stranger somewhere: a name is the difference
   * between an appointment and a message from a number they do not know. It is a *record*, not a
   * permission; the permission lives in `features/collaboration`.
   */
  readonly shownBy: VisitHost | null;
};

/** Who is showing the property, when it is not the owner. Their name as their profile has it. */
export type VisitHost = {
  readonly uid: string;
  readonly name: string;
};

/**
 * Where the arrangement stands, for the header line and for what to render.
 *
 * The two verdicts are **two states and not one** — the same call the incidents make by keeping
 * `withdrawn` apart from `resolved`. "Fue y le interesó" and "fue y no le interesó" are opposite
 * things to have happened: one lets the process continue and the other stops it, and a single
 * `visited` state would force every reader to go and look inside to find out which.
 */
export type VisitState =
  | "none"
  | "proposed"
  | "declined"
  | "confirmed"
  | "interested"
  | "not_interested";

export function visitState(visit: Visit | null): VisitState {
  if (!visit) return "none";
  if (visit.verdict) return visit.verdict.result;
  if (visit.confirmedAt) return "confirmed";
  if (visit.declinedAt) return "declined";

  return "proposed";
}

/**
 * The state in a few words, for the fold's header.
 *
 * Third person, because both parties read the same line and the fold is what stands between them
 * and the news: a header that said "Te interesó" would be addressing one of the two readers.
 */
export const VISIT_STATE_LABELS: Readonly<Record<VisitState, string>> = {
  none: "Sin agendar",
  proposed: "Esperando confirmación",
  declined: "Hay que proponer otro día",
  confirmed: "Agendada",
  interested: "Visita hecha · sí le interesa",
  not_interested: "Visita hecha · no le interesa",
};

/**
 * Why the process cannot move past the visit.
 *
 * Four answers, and the button says which one — the same shape as the documents, the records
 * searches and the interview, because a "Continuar" that does nothing and does not say why is the
 * thing this product keeps refusing to ship.
 *
 * **`not_interested` is the answer this stage exists for.** The other three are "not yet"; this
 * one is "no". It is not turned into an automatic rejection or withdrawal: ending the process is a
 * decision with a name on it, both parties already have a button for it, and a tenant who saw the
 * flat on a grey Tuesday and thought better of it by Thursday should not have had the process
 * closed underneath them by a verdict they can still change.
 */
export type VisitBlocker = "not_proposed" | "not_confirmed" | "no_verdict" | "not_interested" | null;

export function visitBlocker(visit: Visit | null): VisitBlocker {
  switch (visitState(visit)) {
    case "none":
      return "not_proposed";
    case "proposed":
    case "declined":
      return "not_confirmed";
    case "confirmed":
      return "no_verdict";
    case "not_interested":
      return "not_interested";
    default:
      return null;
  }
}

export function visitBlockerMessage(blocker: VisitBlocker, isLandlord: boolean): string | null {
  switch (blocker) {
    case "not_proposed":
      return isLandlord
        ? "Propón un día y un punto de encuentro para la visita antes de continuar."
        : "El propietario todavía no ha propuesto un día para conocer el inmueble.";
    case "not_confirmed":
      return isLandlord
        ? "El inquilino aún no confirma el día de la visita."
        : "Confirma el día de la visita para que el proceso pueda seguir.";
    case "no_verdict":
      return isLandlord
        ? "Después de la visita, el inquilino tiene que decir si el inmueble le interesa."
        : "Después de la visita, dinos si el inmueble te interesa para poder continuar.";
    case "not_interested":
      return isLandlord
        ? "Al inquilino no le interesó el inmueble, así que el proceso no sigue. Puedes rechazar la postulación o proponer otra visita."
        : "Dijiste que el inmueble no te interesa, así que el proceso no sigue. Si cambiaste de opinión, actualízalo aquí; si no, puedes retirar tu postulación.";
    default:
      return null;
  }
}

/**
 * Who the tenant is meeting, in words. `null` when it is the owner and there is nothing to explain.
 *
 * One formatter so the panel, the list and the notification cannot end up describing the same
 * person three ways — and it says *"en nombre del propietario"* rather than naming the landlord,
 * because what the tenant needs is the relationship, not a second name to keep track of.
 */
export function visitHostLine(visit: Pick<Visit, "shownBy">): string | null {
  if (!visit.shownBy?.name) return null;

  return `${visit.shownBy.name}, en nombre del propietario`;
}

/**
 * Has the proposed time already gone by?
 *
 * Used to tell "todavía no ha pasado" from "ya fue y falta decir qué le pareció": asking somebody
 * what they thought of a flat they have not visited yet is asking about nothing.
 *
 * A visit has no fixed length — the interview's half hour is a call, this is somebody walking
 * through a flat — so what counts as "already happened" is the hour it was set for.
 */
export function visitHasPassed(visit: Visit, now: Date): boolean {
  const at = new Date(visit.at).getTime();

  return !Number.isNaN(at) && at <= now.getTime();
}

/**
 * The slot in words, in Colombian time: `jueves 10 de septiembre, 3:00 p. m.`
 *
 * One formatter for the panel, the bell and the email, so the three cannot disagree about when
 * somebody is expected at a door — which, for the one piece of information this stage exists to
 * carry, would be the worst possible bug.
 */
export function visitWhen(visit: Pick<Visit, "at">): string {
  return formatBogotaWeekdayTime(visit.at);
}

/** `3:00 p. m.`, Colombian time. */
export function visitTime(at: string): string {
  return formatBogotaTime(at);
}
