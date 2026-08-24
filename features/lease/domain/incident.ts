/**
 * What the tenant reports while the tenancy is running: a leak, a broken boiler, a neighbour's
 * damp coming through the wall.
 *
 * It lives beside `periods` — `leases/{leaseId}/incidents/{incidentId}` — because it has the same
 * shape of life: the tenancy happens once, and the things that go wrong inside it happen an unknown
 * number of times. A month is keyed by the month it *is*; an incident has no natural key, so it gets
 * a generated id. That is the one structural difference between the two subcollections.
 *
 * **Both parties manage it, and the state is a record of what they did — never a verdict on who
 * owes what.** That line is the whole design. Who pays under *Ley 820 de 2003* — the landlord owes
 * the repairs the property needs to stay habitable, the tenant owes the damage they caused — is what
 * decides who pays for a boiler, and a product that computed it would be telling both parties
 * something it does not know. So a landlord who thinks a broken window is the tenant's doing writes
 * that, in a message the tenant reads; there is no button that makes it true. The thread keeps the
 * disagreement instead of adjudicating it.
 */

// ---------------------------------------------------------------------------
// what can be attached
// ---------------------------------------------------------------------------

/**
 * Images and videos, and **video is the reason this module exists at all** rather than reusing the
 * receipt's file rules.
 *
 * A photo answers "is it broken?"; a video answers "it only leaks when the tap runs" and "listen to
 * this noise", which is the half of a repair argument that a still frame cannot carry. Both parties
 * are describing a physical thing to somebody who is not standing in front of it.
 *
 * `video/quicktime` is there because an iPhone records `.mov` by default. Leaving it out would mean
 * rejecting the file most Colombian tenants would actually produce, with a message about formats
 * they have no way to act on.
 */
export const INCIDENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const INCIDENT_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const INCIDENT_CONTENT_TYPES = [
  ...INCIDENT_IMAGE_TYPES,
  ...INCIDENT_VIDEO_TYPES,
] as const;

export type IncidentContentType = (typeof INCIDENT_CONTENT_TYPES)[number];

/** The same 8 MB every other image in this product gets. A phone photo is 2–4 MB. */
export const INCIDENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * 50 MB, which is about a minute of video off a phone at a middling setting.
 *
 * It is a different number from the image limit and not a bigger shared one, because a 50 MB "image"
 * is a mistake nobody makes on purpose, and the cheapest place to stop a mistake is where it is
 * still describable: "un video, hasta 50 MB".
 */
export const INCIDENT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Five files per report.
 *
 * Not a storage budget: it is what keeps a report readable. Twenty photos of the same wall is a
 * report the landlord scrolls past, and the fix for "it needs more explaining" is the description.
 */
export const MAX_INCIDENT_ATTACHMENTS = 5;

export const INCIDENT_TITLE_MIN = 5;
export const INCIDENT_TITLE_MAX = 120;
export const INCIDENT_DESCRIPTION_MIN = 10;
export const INCIDENT_DESCRIPTION_MAX = 2000;

/** One file that came with a report. Written by the server, read through a signed URL. */
export type IncidentAttachment = {
  /** `incidents/{tenantUid}/…` — inside the reporter's own folder, checked on the way in. */
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
};

export function isVideoAttachment(contentType: string): boolean {
  return (INCIDENT_VIDEO_TYPES as readonly string[]).includes(contentType);
}

export function isImageAttachment(contentType: string): boolean {
  return (INCIDENT_IMAGE_TYPES as readonly string[]).includes(contentType);
}

/** The cap that applies to this file, or `0` for a type that is not accepted at all. */
export function attachmentLimit(contentType: string): number {
  if (isImageAttachment(contentType)) return INCIDENT_IMAGE_MAX_BYTES;

  return isVideoAttachment(contentType) ? INCIDENT_VIDEO_MAX_BYTES : 0;
}

/**
 * Why this file cannot be attached, in a sentence the tenant can act on, or `null`.
 *
 * It says **which** limit was hit and what the limit is. "El archivo es muy grande" leaves somebody
 * with a 60 MB video guessing whether to re-record it or give up; "hasta 50 MB" tells them to trim
 * it. Shared by the picker and the action, so the browser and the server cannot disagree about what
 * is acceptable.
 */
export function attachmentProblem(file: { readonly type: string; readonly size: number }): string | null {
  const limit = attachmentLimit(file.type);
  if (limit === 0) {
    return "Solo puedes adjuntar fotos (JPG, PNG o WEBP) o videos (MP4, MOV o WEBM).";
  }
  if (file.size <= 0) return "Ese archivo está vacío.";
  if (file.size > limit) {
    return isVideoAttachment(file.type)
      ? "El video pesa más de 50 MB. Recórtalo o graba uno más corto."
      : "La foto pesa más de 8 MB.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// where the files live
// ---------------------------------------------------------------------------

/**
 * The folder a person's incident files go in.
 *
 * **Keyed by uid and not by tenancy**, and that is forced rather than chosen: Storage rules cannot
 * read Firestore, so "is this person a party to lease X?" is a question they cannot ask. What they
 * *can* check is that the path names the uploader — the same reason `applicants/{userId}` and
 * `properties/{userId}` are shaped this way. The tenancy the file belongs to is recorded in
 * Firestore, where the question can be asked properly, and the landlord reads the file through a
 * URL the server signs for them.
 *
 * One function so the browser that writes the path and the action that checks it cannot drift.
 */
export function incidentFolder(uid: string): string {
  return `incidents/${uid}/`;
}

/**
 * Whether this path is a file in that person's own folder.
 *
 * The `..` check is not paranoia about Cloud Storage — object names are flat there — it is about
 * this string being compared, logged and rendered. A path that resolves differently depending on
 * who is reading it is a path that gets one of those three wrong.
 */
export function isOwnAttachmentPath(path: string, uid: string): boolean {
  return path.startsWith(incidentFolder(uid)) && !path.includes("..");
}

// ---------------------------------------------------------------------------
// the record
// ---------------------------------------------------------------------------

/** Shape persisted in `leases/{leaseId}/incidents/{incidentId}`. */
export type IncidentDoc = {
  readonly title: string;
  readonly description: string;
  readonly attachments: readonly IncidentAttachment[];
  /**
   * Who reported it. The tenant, today — the landlord has no form for this — and stored anyway
   * rather than assumed from the tenancy: the day this product lets an administrator or a second
   * tenant report one, every record written before it would otherwise be attributed to whoever the
   * tenancy's `tenantUid` happens to be by then.
   */
  readonly reporterUid: string;
  /** Denormalized, like `tenantName` on the tenancy: a list must not cost one read per row. */
  readonly reporterName: string;
  /**
   * What happened since, oldest first. The state is derived from it — see `incidentState`.
   *
   * Inline rather than a subcollection: a thread is small and bounded (`MAX_INCIDENT_UPDATES`), and
   * this way a list of incidents is one query instead of one query per incident. It is the same
   * choice the receipt and the verdict already make on a period, and the signatures on an
   * application.
   */
  readonly updates: readonly IncidentUpdate[];
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type Incident = Omit<IncidentDoc, "createdAt" | "updatedAt"> & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// ---------------------------------------------------------------------------
// the life of one incident
// ---------------------------------------------------------------------------

/**
 * Where an incident is.
 *
 * **`awaiting_confirmation` is the state that makes this domain honest, and it is the same shape as
 * the canon.** The landlord says "ya lo arreglé" and that does *not* close it: whether the shower
 * works is something only the person showering can say, exactly as whether the money landed is
 * something only the person whose account it is can say. A repair the landlord can mark finished by
 * themselves is a repair that gets marked finished without being finished.
 *
 * `withdrawn` and `resolved` are both the tenant closing it, and they are kept apart for the reason
 * "rechazada en la entrevista" and "rechazada al recibirla" are: they are different things to have
 * happened. `withdrawn` is "this was not really a problem"; `resolved` is "it got fixed".
 */
export const INCIDENT_STATES = [
  "reported",
  "in_progress",
  "awaiting_confirmation",
  "resolved",
  "withdrawn",
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export const INCIDENT_STATE_LABELS: Readonly<Record<IncidentState, string>> = {
  reported: "Reportado",
  in_progress: "En arreglo",
  awaiting_confirmation: "Por confirmar",
  resolved: "Resuelto",
  withdrawn: "Cerrado por el inquilino",
};

/** Which side wrote something. The role and not the uid: the thread reads "el inquilino". */
export const INCIDENT_PARTIES = ["tenant", "landlord"] as const;
export type IncidentParty = (typeof INCIDENT_PARTIES)[number];

export const INCIDENT_PARTY_LABELS: Readonly<Record<IncidentParty, string>> = {
  tenant: "El inquilino",
  landlord: "El propietario",
};

/**
 * One thing that happened after the report: a message, a state change, or both.
 *
 * **The state change lives on the update rather than only on the incident**, which is what turns the
 * thread into the record: "el propietario lo puso en arreglo — 'mando al plomero el martes'" is one
 * line that says who, when, what and why. An incident whose status was only a field would answer
 * "En arreglo" and nothing else.
 */
export type IncidentUpdate = {
  readonly by: IncidentParty;
  readonly authorUid: string;
  readonly authorName: string;
  /** ISO 8601, from the server's clock. */
  readonly at: string;
  readonly note: string;
  readonly attachments: readonly IncidentAttachment[];
  /** The state this moved the incident to, or `null` when it is only a message. */
  readonly movedTo: IncidentState | null;
};

/** Fifty updates on one incident is a conversation that needs a phone call, not a longer thread. */
export const MAX_INCIDENT_UPDATES = 50;

/**
 * Where the incident is now, **computed from the thread** rather than kept beside it.
 *
 * The same choice `leaseSummary` makes over the periods, and for the same reason: a stored status is
 * a second source of truth, and the day a write lands twice or an update is corrected by hand the
 * field and the thread disagree with no way to tell which is lying. Here the thread is in the same
 * document, so deriving it costs nothing at all.
 */
export function incidentState(incident: IncidentThread): IncidentState {
  const updates = incident.updates ?? [];

  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const moved = updates[index]?.movedTo;
    if (moved) return moved;
  }

  return "reported";
}

/**
 * A thread, **or a document written before there was one**.
 *
 * `updates` is optional here and nowhere else, and it is not sloppiness: every incident reported
 * before this field existed has no such key, and those documents are in the database right now. The
 * converter already defaults it — but a pure function that is only total *because* its one caller is
 * careful is a function waiting for a second caller. The same reasoning as `payout: doc.payout ?? null`
 * on the tenancy: a type that promises a value the database is not forced to hold is a type that lies
 * once.
 *
 * What it cost the first time: `Cannot read properties of undefined (reading 'length')`, thrown from
 * the list, on a page where the only thing wrong was that the incident predated the feature.
 */
export type IncidentThread = { readonly updates?: readonly IncidentUpdate[] };

/** Whether this incident still needs somebody to do something. */
export function isIncidentOpen(state: IncidentState): boolean {
  return state !== "resolved" && state !== "withdrawn";
}

/**
 * What this party may do next.
 *
 * The asymmetry is the point, and each line of it is a decision:
 *
 * - **Only the tenant resolves.** See `awaiting_confirmation` above.
 * - **Only the tenant withdraws**, because it is their report. The same rule the applications
 *   follow: a landlord cannot withdraw somebody else's application.
 * - **The landlord cannot act once they have said it is fixed.** There is nothing left for them to
 *   do but wait, and a button that re-announced the same thing would be a way to nag.
 * - **The tenant can reopen a resolved one.** A leak that comes back is the same leak, and making
 *   them file it again would throw away the history of the first repair.
 * - **Nothing reopens a withdrawn one**, exactly as a withdrawn application is not reopened — they
 *   report again, which is a new thing that happened.
 *
 * There is deliberately **no "this is not my responsibility"** transition. That is the liability
 * question, and it is answered in a message a person reads, not by a state this product invented.
 */
export function allowedTransitions(
  state: IncidentState,
  isLandlord: boolean,
): readonly IncidentState[] {
  if (isLandlord) {
    switch (state) {
      case "reported":
        return ["in_progress", "awaiting_confirmation"];
      case "in_progress":
        return ["awaiting_confirmation"];
      default:
        return [];
    }
  }

  switch (state) {
    case "reported":
      return ["in_progress", "withdrawn"];
    case "in_progress":
      return ["resolved", "withdrawn"];
    case "awaiting_confirmation":
      return ["resolved", "in_progress"];
    case "resolved":
      return ["in_progress"];
    default:
      return [];
  }
}

export function canTransition(
  state: IncidentState,
  to: IncidentState,
  isLandlord: boolean,
): boolean {
  return allowedTransitions(state, isLandlord).includes(to);
}

/**
 * Whether this move has to come with a sentence.
 *
 * **Saying "it is still broken" requires saying what is still broken**, for the reason a rejected
 * receipt requires a reason: the other party has to act on it, and the note is the only thing that
 * says how. Everything else is optional — "resuelto" needs no explanation, and demanding one for a
 * repair that simply worked is a form to fill in for nothing.
 */
export function transitionRequiresNote(from: IncidentState, to: IncidentState): boolean {
  return from === "awaiting_confirmation" && to === "in_progress";
}

/**
 * What to call the button for this move.
 *
 * **It depends on where the incident is coming from, not only on where it is going**, and that is not
 * polish. Three different things all move an incident to `in_progress`: taking it on, saying a repair
 * did not work, and a leak coming back months later. Labelling all three "Está en arreglo" was what
 * the first version did, and it produced a resolved incident offering the tenant a button that
 * claimed somebody was already fixing it — which is the opposite of what pressing it says.
 */
export function transitionLabel(from: IncidentState, to: IncidentState): string {
  if (to === "in_progress") {
    if (from === "awaiting_confirmation") return "Sigue sin arreglar";
    if (from === "resolved") return "Volvió a pasar";

    return "Está en arreglo";
  }

  switch (to) {
    case "awaiting_confirmation":
      return "Ya lo arreglé";
    case "resolved":
      return "Confirmar que quedó arreglado";
    case "withdrawn":
      return "Cerrar el reporte";
    default:
      return "Volver a reportar";
  }
}

/**
 * Every file on an incident: the ones it was reported with, and the ones the thread added.
 *
 * One list because they are signed together — a landlord photographing the repaired pipe is the same
 * kind of thing as the tenant photographing the broken one.
 */
export function allAttachments(
  incident: { readonly attachments?: readonly IncidentAttachment[] } & IncidentThread,
): readonly IncidentAttachment[] {
  return [
    ...(incident.attachments ?? []),
    ...(incident.updates ?? []).flatMap((update) => update.attachments ?? []),
  ];
}

/**
 * The anchor of one incident inside the tenancy page.
 *
 * The same job `periodAnchor` does for a month and `stageAnchor` for a stage: it is what lands a
 * notification about the leak on the leak, instead of at the top of a page with a year of months on
 * it.
 */
export function incidentAnchor(id: string): string {
  return `incidente-${id}`;
}

/**
 * How many files a report carries, said in words rather than in a number beside an icon.
 *
 * It sits in the collapsed header of a report, which is the whole reason it exists: what a click
 * reveals should be the detail, not the news that there is any.
 */
export function attachmentsLabel(attachments: readonly IncidentAttachment[]): string {
  if (attachments.length === 0) return "Sin archivos";

  const videos = attachments.filter((one) => isVideoAttachment(one.contentType)).length;
  const images = attachments.length - videos;

  const parts: string[] = [];
  if (images > 0) parts.push(images === 1 ? "1 foto" : `${images} fotos`);
  if (videos > 0) parts.push(videos === 1 ? "1 video" : `${videos} videos`);

  return parts.join(" · ");
}
