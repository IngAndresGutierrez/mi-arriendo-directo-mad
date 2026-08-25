/**
 * Encargos: a discrete job on one property, given to one collaborator.
 *
 * **The collaborator is a sporadic figure**, and the whole design follows from that. They are not
 * staff with a portal they live in; they are somebody who shows a flat on Thursday and is not seen
 * again for a month. So an errand carries everything needed to do it — where, when, what, who to
 * call — because the message that announces it may be the only thing they read, and the screen they
 * open exists to answer one question: what am I supposed to do, and by when.
 *
 * Three shapes, like every other domain here: `AssignmentInput` is what the landlord submits,
 * `ErrandDoc` is what lives in Firestore (with `Timestamp`), `Errand` is what the UI gets
 * (serializable, no SDK types).
 */
/**
 * Structural view of a Firestore `Timestamp`. The domain must not import the SDK — it is the one
 * layer that stays testable in milliseconds — and all it needs is the ability to become a `Date`.
 * Declared here rather than shared, exactly as `features/property/domain/property.ts` declares it.
 */
type StoredTimestamp = { toDate(): Date };

/** What the job actually is. Keys in English (they are stored), labels in es-CO (they are copy). */
export const ERRAND_TYPES = ["showing", "photos", "keys", "inspection", "signing", "other"] as const;
export type ErrandType = (typeof ERRAND_TYPES)[number];

export const ERRAND_TYPE_LABELS: Readonly<Record<ErrandType, string>> = {
  showing: "Mostrar el inmueble",
  photos: "Tomar fotos",
  keys: "Entregar o recibir llaves",
  inspection: "Revisar el estado",
  signing: "Acompañar una firma",
  other: "Otro",
};

/**
 * The states an errand passes through.
 *
 * **`accepted` is a state and not a formality**, and it is the same rule the interview stage
 * already pays for: a time only one side knows is a time nobody turns up to. A landlord who has not
 * seen an acceptance has not arranged anything, and the screen says so rather than letting them
 * assume.
 *
 * **`declined` is not a failure state to hide.** A sporadic collaborator who cannot make Thursday
 * needs a way to say so that is cheaper than not showing up, and the landlord needs to find out
 * while there is still time to ask somebody else.
 */
export const ERRAND_STATES = ["assigned", "accepted", "declined", "done", "cancelled"] as const;
export type ErrandState = (typeof ERRAND_STATES)[number];

export const ERRAND_STATE_LABELS: Readonly<Record<ErrandState, string>> = {
  assigned: "Sin confirmar",
  accepted: "Confirmado",
  declined: "Rechazado",
  done: "Terminado",
  cancelled: "Cancelado",
};

/** A file the collaborator attached when closing the errand. Same shape as a property photo. */
export type ErrandEvidence = {
  readonly path: string;
  readonly url: string;
};

export type ErrandDoc = {
  readonly landlordUid: string;
  /** The collaborator's Firebase uid. They sign in with a one-time code, so they have a real account. */
  readonly collaboratorUid: string;
  /**
   * Name and phone **copied onto the errand**, not read from the collaborator's document.
   *
   * The same reasoning as the tenant dossier's snapshot inside an application: the landlord may not
   * read `collaborators/{uid}` — that document belongs to the collaborator and is theirs alone — and
   * a later edit to their profile must not silently rewrite what was agreed on a job already done.
   */
  readonly collaboratorName: string;
  readonly collaboratorPhone: string;

  readonly propertyId: string;
  /** Copied for the same reason, and because a deleted listing must not blank a finished errand. */
  readonly propertyTitle: string;
  readonly propertyArea: string;

  readonly type: ErrandType;
  readonly title: string;
  readonly description: string;
  /** When it has to be done. An instant, shown in Bogotá time — see `shared/format/date`. */
  readonly dueAt: StoredTimestamp;

  readonly createdAt: StoredTimestamp;
  readonly updatedAt: StoredTimestamp;

  /*
   * Timestamps rather than a stored `state` string, and rather than booleans.
   *
   * A stored status is a second source of truth: the day a write lands twice, the field and the
   * history disagree with no way to tell which is lying — the same call `incidentState()` makes over
   * an incident's thread. And *when* something was decided is part of the record both sides read,
   * which is why `waivedAt`, `checksAuthorizedAt` and `completedAt` are all dates elsewhere in this
   * product and none of them is a boolean.
   */
  readonly acceptedAt?: StoredTimestamp;
  readonly declinedAt?: StoredTimestamp;
  readonly declineReason?: string;
  readonly completedAt?: StoredTimestamp;
  readonly completionNote?: string;
  readonly evidence?: readonly ErrandEvidence[];
  readonly cancelledAt?: StoredTimestamp;
  readonly cancelReason?: string;
};

/** What a component receives: same data, every date an ISO string. */
export type Errand = Omit<
  ErrandDoc,
  "dueAt" | "createdAt" | "updatedAt" | "acceptedAt" | "declinedAt" | "completedAt" | "cancelledAt"
> & {
  readonly id: string;
  readonly dueAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acceptedAt?: string;
  readonly declinedAt?: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
};

/** The dates `errandState` reads. Taking the fields rather than the document keeps it pure. */
type Marks = {
  readonly acceptedAt?: string;
  readonly declinedAt?: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
};

/**
 * Where an errand is now, derived from what has happened to it.
 *
 * **The order of these four checks is the whole rule**, and it is the same shape as
 * `guaranteeState`: swapping two of them changes what the screen claims. `cancelled` wins over
 * everything because a landlord calling it off ends it whatever else was recorded; `done` outranks
 * `accepted` because finishing implies having taken it; and `declined` is only reachable while
 * nothing else has happened.
 */
export function errandState(marks: Marks): ErrandState {
  if (marks.cancelledAt) return "cancelled";
  if (marks.completedAt) return "done";
  if (marks.declinedAt) return "declined";
  if (marks.acceptedAt) return "accepted";

  return "assigned";
}

/** An errand nobody can act on any more: the collaborator's screen shows it and offers nothing. */
export function isClosed(marks: Marks): boolean {
  const state = errandState(marks);

  return state === "done" || state === "declined" || state === "cancelled";
}

/**
 * What the collaborator may do right now.
 *
 * Returned as a list rather than four booleans so a screen cannot render a control the server would
 * refuse — the actions check the same thing, and this is what keeps the two from drifting.
 */
export const COLLABORATOR_ACTIONS = ["accept", "decline", "complete"] as const;
export type CollaboratorAction = (typeof COLLABORATOR_ACTIONS)[number];

export function availableActions(marks: Marks): readonly CollaboratorAction[] {
  const state = errandState(marks);

  if (state === "assigned") return ["accept", "decline"];
  /*
   * Once accepted, declining is gone on purpose. Backing out of something you confirmed is a
   * conversation, not a button: the landlord has stopped looking for somebody else on the strength
   * of that acceptance, and a silent `declined` hours later reads to them as a no-show that was
   * recorded. What is left is finishing it, and the phone number is on the screen.
   */
  if (state === "accepted") return ["complete"];

  return [];
}

/**
 * Is this errand overdue?
 *
 * Takes `now` instead of reading the clock, like `validateBirthDate` and `dueReminder`: the
 * interesting cases are the ones that are not true today, and a function that reads the clock cannot
 * be asked about them.
 *
 * A closed errand is never overdue — a job finished late is finished, and colouring it red for ever
 * is telling somebody off for something they already did.
 */
export function isOverdue(errand: Pick<Errand, "dueAt"> & Marks, now: Date): boolean {
  if (isClosed(errand)) return false;

  return Date.parse(errand.dueAt) < now.getTime();
}

/**
 * The encargos a collaborator should see first: what is still open, soonest first.
 *
 * Closed ones keep their place at the bottom rather than disappearing — the same call the process
 * page makes by folding a finished stage shut instead of hiding it. Somebody who wants to check what
 * they were asked to do last month should not have to remember it.
 */
export function sortForCollaborator(assignments: readonly Errand[]): readonly Errand[] {
  return [...assignments].sort((a, b) => {
    const closed = Number(isClosed(a)) - Number(isClosed(b));
    if (closed !== 0) return closed;

    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });
}

/**
 * The one line that reaches the collaborator's phone.
 *
 * **The same words go out on both channels**, which is why this is a function and not two strings
 * written at the two call sites: an SMS and a WhatsApp that describe the same job differently is the
 * bug nobody sees, because nobody receives both and compares them.
 *
 * It carries **what and when and where**, and deliberately not who the tenant is. A message sits in
 * a notification shade on a lock screen; the name of the person whose home this is belongs behind
 * the login, on a page that knows who is reading. That is the same rule the payout notification
 * follows by refusing to put the account number in an email.
 *
 * `link` is absolute because it is going into a text message, where a relative path is not a link at
 * all — it is punctuation.
 */
export function errandMessage(
  errand: Pick<Errand, "title" | "propertyArea">,
  when: string,
  link: string,
): string {
  return `Tienes un encargo en miarriendoDIRECTO: ${errand.title} · ${errand.propertyArea} · ${when}. Míralo y confírmalo aquí: ${link}`;
}
