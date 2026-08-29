import type { Dictionary } from "@/shared/i18n";
import type { LeaseTerm } from "@/features/property/client";
import type { DocumentReviews, TenantDossier } from "@/features/tenant-profile/client";

import type { CheckResults } from "./background-check";
import type { Contract } from "./contract";
import type { FirstPayment } from "./payout";
import type { Guarantee } from "./guarantee";
import type { Interview } from "./interview";
import type { Visit } from "./visit";

/**
 * The eight stages a rental goes through, in order.
 *
 * The landlord moves the process forward one stage at a time — there is no automatic
 * progression, because every one of these is a decision someone makes off the platform and then
 * records here. **Except the last one**, and that is the one deliberate exception: confirming the
 * first canon *is* the decision, and asking the landlord to then press a second button that
 * repeats it was a step that recorded nothing.
 *
 * There is no separate "revisión de documentos" stage either: reviewing them *is* stage two,
 * where each one is approved or rejected, and a stage that repeats what the previous one already
 * settled is a stage everybody clicks through without reading. **`approved` went for exactly that
 * reason**: approving the application and moving it to the signature were one decision recorded
 * twice, and the tenant still learns of it — the notification is sent on landing on
 * `contract_signature`, which is the moment the landlord says "vamos a firmar".
 *
 * And `active` went because it was not a stage at all: it was the tenancy, listed among the steps
 * of the negotiation that produces it. The tenancy has its own page, its own lifetime and twelve
 * months instead of seven steps — `completedAt` is what says the process reached the end.
 *
 * **`visit` is second, and the position is the argument.** The tenant goes to see the property
 * before anybody is asked for an identity document, for payslips, or for permission to search
 * their judicial record — and before the landlord spends any of that on somebody who will walk in
 * and find the building faces a motorway. Everything after it is worth doing only once both people
 * have seen what they are talking about, so it sits as early as it can and still have an
 * application to hang off. Its verdict is the tenant's: see `domain/visit.ts`.
 *
 * There is deliberately **no deposit stage**. Ley 820 de 2003 forbids cash deposits on urban
 * housing leases in Colombia; what stands in for it is `guarantee` — a co-signer or an insurance
 * policy — which is a stage precisely because it is the legal way to do this.
 */
export const STAGES = [
  "submitted",
  "visit",
  "tenant_data",
  "background_check",
  "interview",
  "guarantee",
  "contract_signature",
  "first_payment",
] as const;

export type Stage = (typeof STAGES)[number];

/**
 * Stages that existed once and are still written on documents in the database.
 *
 * Removing a stage from `STAGES` does not remove it from the processes standing on it, nor from
 * the notifications already sent naming it — and a stage the code no longer knows lands as
 * `stageIndex() === -1`, which reads as "before the first step" everywhere it is compared. So the
 * two are mapped to what they became rather than dropped: `approved` was the decision to go to the
 * signature, and `active` was the tenancy already open.
 *
 * `active` maps to the last stage **and the converter marks it completed**, which is the other half
 * of the same fact: a process that had reached it had finished the process.
 */
const LEGACY_STAGES: Readonly<Record<string, Stage>> = {
  approved: "contract_signature",
  active: "first_payment",
};

/** The stage a stored value means today. Anything unknown is the first one, never `undefined`. */
export function normalizeStage(value: unknown): Stage {
  if (typeof value !== "string") return STAGES[0];
  if ((STAGES as readonly string[]).includes(value)) return value as Stage;

  return LEGACY_STAGES[value] ?? STAGES[0];
}

/**
 * **The words for the eight stages live in `shared/i18n/messages`, under `application`.**
 *
 * They used to be `STAGE_LABELS`, `STAGE_DESCRIPTIONS`, `STAGE_DESCRIPTIONS_LANDLORD`,
 * `APPLICATION_STATUS_LABELS` and the three `COMPLETED_*` constants, right here. The keys have not
 * changed and are still the stored stage names; a second language is what moved the words out, and
 * the two `stageDescriptions` lists are still two lists for the reason written below.
 *
 * Everything that read them now takes a `copy: ApplicationCopy` argument. That keeps these
 * functions pure — they still decide *which* sentence, which is what the tests are about — and puts
 * the language at the call site, where a Server Component knows it and a Client Component is handed
 * it.
 */
export type ApplicationCopy = Dictionary["application"];

/**
 * What is happening, in the second person — and there are two second persons.
 *
 * Both sides read this same screen, so one set of words cannot serve them: "el propietario te
 * contactará" is instructions for the tenant and gibberish for the landlord, who is the one who
 * has to make the call. Each role gets the sentence that tells *them* what to do next.
 */


/**
 * What the process reads as once it is over, which is not a stage.
 *
 * The eight stages are the negotiation; what follows is the tenancy, and it lives on another page
 * with its own months. These two sentences are what a card says instead of naming the last stage —
 * "Primer canon" beside a process that finished would read as one still asking for the money.
 */

/** The description for whoever is reading. */
export function stageDescription(stage: Stage, isLandlord: boolean, copy: ApplicationCopy): string {
  return isLandlord ? copy.stageDescriptionsLandlord[stage] : copy.stageDescriptions[stage];
}

/**
 * Where the process stands, in a word, for a card that is not the timeline.
 *
 * A finished process is not "Primer canon": it stopped asking for anything, and the last stage's
 * name beside it would read as a step still pending. This is the one place that decides it, so the
 * home card and the list cannot end up saying two different things.
 */
export function processStageLabel(
  application: Pick<Application, "stage" | "completedAt">,
  copy: ApplicationCopy,
): string {
  return isCompleted(application) ? copy.completedLabel : copy.stageLabels[application.stage];
}

/** And the sentence under it, for whoever is reading. */
export function processDescription(
  application: Pick<Application, "stage" | "completedAt">,
  isLandlord: boolean,
  copy: ApplicationCopy,
): string {
  if (isCompleted(application)) {
    return isLandlord ? copy.completedDescriptionLandlord : copy.completedDescription;
  }

  return stageDescription(application.stage, isLandlord, copy);
}

/**
 * Stages that do nothing yet beyond being visible.
 *
 * They are shown because a process with holes in it is worse than one that says which parts are
 * not built: the tenant needs to know what is coming. What they do not have is an interface of
 * their own — no upload, no signature, no payment. The landlord still advances past them, which
 * is how a process that happens over WhatsApp gets recorded here in the meantime.
 */
/*
 * Vacío, y eso es la noticia: las ocho etapas tienen trabajo en el producto. `contract_signature`
 * salió cuando la firma pasó a hacerse aquí, y `first_payment` cuando el propietario pudo decir por
 * dónde recibir el canon y el inquilino subir su comprobante.
 *
 * Se conserva la constante en vez de borrarla: `isUnbuilt` se consulta en la interfaz para decir en
 * voz alta que algo pasa fuera de la plataforma, y la próxima etapa que se añada la va a necesitar.
 */
export const UNBUILT_STAGES: readonly Stage[] = [];

export function isUnbuilt(stage: Stage): boolean {
  return UNBUILT_STAGES.includes(stage);
}

/**
 * How a process ended, or that it has not.
 *
 * **`completed` is not a status, and it stayed out on purpose.** How a process ended is one thing
 * and whether it ended well is another: `completedAt` is the timestamp that says the eight stages
 * were walked, and a status of its own would be a second field able to disagree with it — the same
 * choice `waivedAt`, `checksAuthorizedAt` and `acceptedClauseAt` already make.
 *
 * `rejected` and `withdrawn` both stop it, and both keep the
 * stage they stopped at — "rechazada en la entrevista" is a different story from "rechazada al
 * recibirla", and the two people involved deserve to see which one happened.
 */
export const APPLICATION_STATUSES = ["open", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];


/** One movement, kept so the process can be read backwards. */
export type StageEvent = {
  readonly stage: Stage;
  /** ISO 8601. */
  readonly at: string;
  /** Who moved it: `landlord`, `tenant`, or `system` for the initial entry. */
  readonly by: "landlord" | "tenant" | "system";
};

export type ApplicationDoc = {
  readonly propertyId: string;
  /** Denormalized so a list of applications does not need one read per property. */
  readonly propertySlug: string;
  readonly propertyTitle: string;
  readonly propertyCity: string;
  /** Monthly cost at the time of applying: the listing may be edited later. */
  readonly monthlyCost: number;
  readonly landlordUid: string;
  readonly tenantUid: string;
  readonly tenantName: string;
  readonly stage: Stage;
  readonly status: ApplicationStatus;
  /** What the tenant declared *to this landlord*, frozen at submission. */
  readonly dossier: TenantDossier;
  readonly desiredMoveIn: string;
  readonly leaseMonths: LeaseTerm;
  readonly message: string;
  /** Why it was rejected, if the landlord wrote a reason. */
  readonly closingNote: string;
  /**
   * When the tenant authorised checking their records, ISO 8601, or `null`.
   *
   * Consulting someone's judicial, traffic and disciplinary record requires their express
   * authorisation — Ley 1581 de 2012 — and the consent given at signup is not it: that one
   * covers processing the data they handed over, not going to look for more. It is recorded per
   * application because it is given to *this* landlord, for *this* process.
   */
  readonly checksAuthorizedAt: string | null;
  /**
   * When the tenant let **this** landlord see their payment-compliance score, ISO 8601, or `null`.
   *
   * A second authorisation and not a reuse of the one above, because they are different
   * disclosures: the records search looks somebody up in public registries, and this shows a
   * landlord a summary of how their tenant paid **other** landlords. Both are finalidades distinct
   * from the signup consent and both are recorded per application, for *this* recipient.
   *
   * A timestamp rather than a boolean, like every other authorisation in this product: *when* it
   * was given is half of what makes it provable, and Decreto 1074 art. 2.2.2.25.2.4 puts that
   * burden on us.
   */
  readonly scoreAuthorizedAt: string | null;
  /**
   * When the process finished, ISO 8601, or `null` while it is still running.
   *
   * Written by `recordReceiptVerdict` the moment the landlord confirms the first canon arrived —
   * the same write that opens the tenancy. There is no eighth stage to advance to: confirming the
   * money *is* the decision, and a button afterwards that only repeated it recorded nothing.
   *
   * **A timestamp, not a boolean**, like `waivedAt` and `checksAuthorizedAt`: *when* it ended is
   * part of the record both parties read, and a bare flag answers "no" identically whether it
   * ended yesterday or is still on stage three.
   *
   * The status stays `open`, which is not a contradiction: an application whose tenancy is running
   * has not been rejected or withdrawn, and it is still the document both parties come back to for
   * the contract they signed.
   */
  readonly completedAt: string | null;
  /**
   * What the landlord decided about each uploaded document, keyed by its id.
   *
   * Kept here and not on the document: a payslip approved by one landlord is not approved for
   * the next, and a verdict written onto the tenant's own profile would follow them everywhere.
   */
  readonly documentReviews: DocumentReviews;
  /** What each records search turned up, keyed by source. Written by the landlord. */
  readonly checkResults: CheckResults;
  /**
   * The visit to the property: when, where they meet, whether the tenant confirmed and what they
   * made of it after going. `null` until the landlord proposes a day, and on every application
   * made before this stage existed.
   */
  readonly visit: Visit | null;
  /**
   * The interview: when, where, whether the tenant confirmed and how it went.
   *
   * `null` until the landlord proposes a time, and on every application made before this stage
   * had an interface of its own.
   */
  readonly interview: Interview | null;
  /**
   * The rental insurance policy that stands in for a deposit — Ley 820 forbids those — and for a
   * co-signer, which is the requirement that stops most applications. `null` until the landlord
   * applies for it.
   */
  readonly guarantee: Guarantee | null;
  /**
   * The lease: the file, and each party's electronic signature over it. `null` until the landlord
   * uploads it — and until both have signed, the stage does not move.
   */
  readonly contract: Contract | null;
  /**
   * The first canon: where the landlord wants it, the tenant's proof that they sent it, and the
   * landlord's answer. `null` until the landlord says where. **This product does not move the
   * money** — the transfer happens in their own banks.
   */
  readonly firstPayment: FirstPayment | null;
  readonly history: readonly StageEvent[];
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type Application = Omit<ApplicationDoc, "createdAt" | "updatedAt"> & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * A short code for one process, to say out loud.
 *
 * The id is what identifies it, but nobody reads twenty characters over WhatsApp to support. Six
 * is enough to find the right one among a handful and it is derived, not stored: there is no
 * counter to keep and no second identifier that could disagree with the first.
 */
export function applicationCode(id: string): string {
  return id.slice(0, 6).toUpperCase();
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/**
 * Has the process finished?
 *
 * One question, one answer, read from one field. It used to be `stage === "active"`, which meant
 * every screen that needed to know had to know the name of the last stage — and the day the last
 * stage changed, each of them was wrong on its own.
 */
export function isCompleted(application: Pick<Application, "completedAt">): boolean {
  return application.completedAt !== null;
}

/**
 * `Paso 4 de 8`, y **`Proceso completado`** cuando ya no queda nada.
 *
 * "Paso 8 de 8" es cierto mientras el propietario todavía no ha confirmado el canon, y deja de
 * serlo en cuanto lo confirma: entonces lo que hay que decir es que se acabó. Se decide por
 * `completedAt` y no por la etapa, que es lo que hace que la última etapa pueda tener trabajo
 * dentro sin leerse como terminada por estar al final de la fila.
 *
 * Lo lee también la tarjeta de `/inicio`, donde queda "Arriendo en curso · Proceso completado": es
 * exactamente lo que alguien necesita saber de un vistazo — ese proceso ya no le pide nada.
 */
export function stageProgressLabel(
  application: Pick<Application, "stage" | "completedAt">,
  copy: ApplicationCopy,
): string {
  if (isCompleted(application)) return copy.processCompleted;

  return `${copy.stepOf} ${stageIndex(application.stage) + 1} ${copy.stepOfSeparator} ${STAGES.length}`;
}

/** How far along, 0 to 1, for the progress bar. */
export function stageProgress(stage: Stage): number {
  return (stageIndex(stage) + 1) / STAGES.length;
}

export function nextStage(stage: Stage): Stage | null {
  return STAGES[stageIndex(stage) + 1] ?? null;
}

/** Where each stage stands relative to the one the process is on. */
export type StageState = "done" | "current" | "pending";

/**
 * Where a stage stands, and **the last one is only finished when the process is**.
 *
 * This used to answer "done" for whichever stage came last, on the grounds that reaching it *was*
 * finishing — true while the last stage was `active`, which asked for nothing. `first_payment` asks
 * for the money, so the same rule would have marked a process as finished the moment it arrived at
 * the step that still had all of its work ahead of it.
 *
 * So it takes the completion instead of guessing it from the position: `completed` comes from
 * `completedAt`, written by the same action that opens the tenancy. A process that never shows as
 * finished is a process nobody can tell apart from one that stalled on its last step, and one that
 * shows as finished early is worse.
 */
export function stageState(stage: Stage, current: Stage, completed = false): StageState {
  const difference = stageIndex(stage) - stageIndex(current);
  if (difference < 0) return "done";
  if (difference > 0) return "pending";

  return completed ? "done" : "current";
}

/**
 * May the landlord move this process forward?
 *
 * Only while it is open, and never past the last stage — there is nothing after `first_payment` to
 * advance to, because what ends the process is confirming the canon and not a button. A closed
 * process is not resumed either: the tenant applies again, which is honest about what happened.
 */
export function canAdvance(application: Pick<Application, "status" | "stage">): boolean {
  return application.status === "open" && nextStage(application.stage) !== null;
}

/** May it still be stopped? Once the tenancy has started, stopping it is a termination. */
export function canClose(
  application: Pick<Application, "status" | "stage" | "completedAt">,
): boolean {
  return application.status === "open" && !isCompleted(application);
}

/** The stage a stopped process stopped at, for a sentence like "rechazada en la entrevista". */
export function closedAtLabel(
  application: Pick<Application, "status" | "stage">,
  copy: ApplicationCopy,
): string | null {
  if (application.status === "open") return null;

  return `${copy.statusLabels[application.status]} ${copy.closedAtStage} "${copy.stageLabels[application.stage]}"`;
}

/**
 * Can this tenant apply to this property?
 *
 * A landlord cannot apply to their own listing, and nobody applies twice to the same one: a
 * second live application would split the conversation in two and neither would be the real one.
 *
 * **A rejection is final.** The landlord already looked at this person and said no; offering
 * them the form again is offering them the same answer with extra steps, and letting them fill
 * it in only to be refused on submit is worse than not offering it.
 *
 * **A withdrawal is not.** The tenant stopped it themselves, and locking them out of a listing
 * for changing their mind would be punishing them for using the button we gave them.
 */
export function applicationBlocker(
  { landlordUid, status }: { readonly landlordUid: string; readonly status: string },
  tenantUid: string,
  existing: Pick<Application, "status"> | null,
): "own_property" | "not_available" | "already_applied" | "rejected_before" | null {
  if (landlordUid === tenantUid) return "own_property";
  if (status !== "available") return "not_available";
  if (existing?.status === "open") return "already_applied";
  if (existing?.status === "rejected") return "rejected_before";

  return null;
}
