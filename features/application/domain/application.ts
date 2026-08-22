import type { LeaseTerm } from "@/features/property/client";
import type { DocumentReviews, TenantDossier } from "@/features/tenant-profile/client";

/**
 * The ten stages a rental goes through, in order.
 *
 * The landlord moves the process forward one stage at a time — there is no automatic
 * progression, because every one of these is a decision someone makes off the platform and then
 * records here.
 *
 * There is deliberately **no deposit stage**. Ley 820 de 2003 forbids cash deposits on urban
 * housing leases in Colombia; what stands in for it is `guarantee` — a co-signer or an insurance
 * policy — which is a stage precisely because it is the legal way to do this.
 */
export const STAGES = [
  "submitted",
  "tenant_data",
  "background_check",
  "document_review",
  "interview",
  "guarantee",
  "approved",
  "contract_signature",
  "first_payment",
  "active",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  submitted: "Postulación recibida",
  tenant_data: "Datos y documentos del inquilino",
  background_check: "Validación de expedientes",
  document_review: "Revisión de documentos",
  interview: "Entrevista con el propietario",
  guarantee: "Codeudor o póliza",
  approved: "Postulación aprobada",
  contract_signature: "Firma del contrato",
  first_payment: "Primer canon",
  active: "Arriendo en curso",
};

/**
 * What is happening, in the second person — and there are two second persons.
 *
 * Both sides read this same screen, so one set of words cannot serve them: "el propietario te
 * contactará" is instructions for the tenant and gibberish for the landlord, who is the one who
 * has to make the call. Each role gets the sentence that tells *them* what to do next.
 */
export const STAGE_DESCRIPTIONS: Readonly<Record<Stage, string>> = {
  submitted: "El propietario ya tiene tu postulación y los datos que declaraste.",
  tenant_data: "Sube tu documento de identidad y el soporte de tus ingresos.",
  background_check:
    "Con tu autorización se revisan tus antecedentes judiciales, multas de tránsito y sanciones disciplinarias.",
  document_review: "El propietario está revisando lo que enviaste.",
  interview: "El propietario te contactará para conocerte, por llamada o en persona.",
  guarantee: "Definan juntos la garantía: un codeudor o una póliza de arrendamiento.",
  approved: "El propietario aceptó tu postulación. Sigue la firma.",
  contract_signature: "Firmen el contrato de arrendamiento por 6 o 12 meses.",
  first_payment: "Paga el primer canon para recibir el inmueble.",
  active: "El arriendo está en curso. Aquí verás tus pagos y tu contrato.",
};

/** The same nine stages, addressed to the landlord. */
export const STAGE_DESCRIPTIONS_LANDLORD: Readonly<Record<Stage, string>> = {
  submitted: "Revisa lo que declaró el inquilino y decide si sigues con él.",
  tenant_data: "Pídele su documento de identidad y el soporte de sus ingresos.",
  background_check:
    "Consulta sus antecedentes judiciales, de tránsito y disciplinarios, y marca el resultado.",
  document_review: "Revisa los documentos que te envió.",
  interview: "Contáctalo para conocerlo, por llamada o en persona.",
  guarantee: "Definan juntos la garantía: un codeudor o una póliza de arrendamiento.",
  approved: "Aceptaste la postulación. Sigue la firma del contrato.",
  contract_signature: "Firmen el contrato de arrendamiento por 6 o 12 meses.",
  first_payment: "Confirma que recibiste el primer canon.",
  active: "El arriendo está en curso. Aquí verás los pagos y el contrato.",
};

/** The description for whoever is reading. */
export function stageDescription(stage: Stage, isLandlord: boolean): string {
  return isLandlord ? STAGE_DESCRIPTIONS_LANDLORD[stage] : STAGE_DESCRIPTIONS[stage];
}

/**
 * Stages that do nothing yet beyond being visible.
 *
 * They are shown because a process with holes in it is worse than one that says which parts are
 * not built: the tenant needs to know what is coming. What they do not have is an interface of
 * their own — no upload, no signature, no payment. The landlord still advances past them, which
 * is how a process that happens over WhatsApp gets recorded here in the meantime.
 */
export const UNBUILT_STAGES: readonly Stage[] = [
  "background_check",
  "document_review",
  "interview",
  "guarantee",
  "contract_signature",
  "first_payment",
];

export function isUnbuilt(stage: Stage): boolean {
  return UNBUILT_STAGES.includes(stage);
}

/**
 * How a process ended, or that it has not.
 *
 * `completed` is not a status: reaching `active` is what "it worked" looks like, and a rental in
 * course is not a finished process. `rejected` and `withdrawn` both stop it, and both keep the
 * stage they stopped at — "rechazada en la entrevista" is a different story from "rechazada al
 * recibirla", and the two people involved deserve to see which one happened.
 */
export const APPLICATION_STATUSES = ["open", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  open: "En proceso",
  rejected: "Rechazada",
  withdrawn: "Retirada",
};

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
   * What the landlord decided about each uploaded document, keyed by its id.
   *
   * Kept here and not on the document: a payslip approved by one landlord is not approved for
   * the next, and a verdict written onto the tenant's own profile would follow them everywhere.
   */
  readonly documentReviews: DocumentReviews;
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

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** `Paso 4 de 9`. */
export function stageProgressLabel(stage: Stage): string {
  return `Paso ${stageIndex(stage) + 1} de ${STAGES.length}`;
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

export function stageState(stage: Stage, current: Stage): StageState {
  const difference = stageIndex(stage) - stageIndex(current);

  return difference < 0 ? "done" : difference === 0 ? "current" : "pending";
}

/**
 * May the landlord move this process forward?
 *
 * Only while it is open, and never past the last stage — `active` is where it stays. A closed
 * process is not resumed: the tenant applies again, which is honest about what happened.
 */
export function canAdvance(application: Pick<Application, "status" | "stage">): boolean {
  return application.status === "open" && nextStage(application.stage) !== null;
}

/** May it still be stopped? Once the rental is in course, stopping it is a termination. */
export function canClose(application: Pick<Application, "status" | "stage">): boolean {
  return application.status === "open" && application.stage !== "active";
}

/** The stage a stopped process stopped at, for a sentence like "rechazada en la entrevista". */
export function closedAtLabel(application: Pick<Application, "status" | "stage">): string | null {
  if (application.status === "open") return null;

  return `${APPLICATION_STATUS_LABELS[application.status]} en la etapa "${STAGE_LABELS[application.stage]}"`;
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
