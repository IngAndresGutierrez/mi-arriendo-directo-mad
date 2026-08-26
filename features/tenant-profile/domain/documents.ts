import type { Occupation } from "./tenant-profile";

/**
 * The papers a landlord asks for before handing over keys.
 *
 * Which ones depends on how the person earns: a payslip means nothing to someone independent,
 * and asking an employee for their RUT is asking for a document they may not have. So the list
 * is derived from the occupation already declared in the dossier, and nothing else is shown —
 * a checklist with items that do not apply to you reads as a wall.
 *
 * Nothing here is verified by the platform. These are the documents *as uploaded*; whether a
 * payslip is real is a judgement the landlord makes, and the product does not pretend otherwise.
 */
export const DOCUMENT_KINDS = [
  "id_front",
  "id_back",
  "id_both",
  "employment_letter",
  "payslip",
  "rut",
  "tax_return",
  "bank_statement",
  "chamber_of_commerce",
  "pension_certificate",
  "pension_payslip",
  "study_certificate",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** One line of the checklist: what to upload, and how many. */
export type DocumentRequirement = {
  readonly kind: DocumentKind;
  /** How many files this line expects. Three payslips are three files, not one. */
  readonly count: number;
  /**
   * `true` when it may legitimately not exist — someone who does not file taxes has no tax
   * return, and blocking them on it would be asking for a document that cannot be produced.
   */
  readonly optional: boolean;
};

/**
 * The identity document, asked for in the shape the person happens to have it.
 *
 * A scanner gives you one PDF with both faces; a phone gives you two photos. Both are the same
 * document, and demanding the second shape from someone holding the first means asking them to
 * split a PDF — so the checklist offers the choice and either answer satisfies it.
 */
export const IDENTITY_AS_TWO_FILES: readonly DocumentRequirement[] = [
  { kind: "id_front", count: 1, optional: false },
  { kind: "id_back", count: 1, optional: false },
];

export const IDENTITY_AS_ONE_FILE: readonly DocumentRequirement[] = [
  { kind: "id_both", count: 1, optional: false },
];

/** Which shape the tenant is using, decided by what they have already uploaded. */
export function identityShape(
  documents: readonly { readonly kind: DocumentKind }[],
): "one_file" | "two_files" | null {
  if (countOf(documents, "id_both") > 0) return "one_file";
  if (countOf(documents, "id_front") > 0 || countOf(documents, "id_back") > 0) return "two_files";

  return null;
}

/** Is the identity document covered, whichever shape it came in? */
export function identitySatisfied(
  documents: readonly { readonly kind: DocumentKind }[],
): boolean {
  if (countOf(documents, "id_both") > 0) return true;

  return countOf(documents, "id_front") > 0 && countOf(documents, "id_back") > 0;
}

const BY_OCCUPATION: Readonly<Record<Occupation, readonly DocumentRequirement[]>> = {
  employee: [
    { kind: "employment_letter", count: 1, optional: false },
    { kind: "payslip", count: 3, optional: false },
  ],
  self_employed: [
    { kind: "rut", count: 1, optional: false },
    { kind: "tax_return", count: 1, optional: true },
    { kind: "bank_statement", count: 3, optional: false },
  ],
  business_owner: [
    { kind: "rut", count: 1, optional: false },
    { kind: "chamber_of_commerce", count: 1, optional: false },
    { kind: "bank_statement", count: 3, optional: false },
  ],
  retired: [
    { kind: "pension_certificate", count: 1, optional: false },
    { kind: "pension_payslip", count: 3, optional: false },
  ],
  /*
   * A student has no income of their own, so no income document is asked for. What answers for
   * them is the co-signer, which is a stage of its own further along — pretending a study
   * certificate proves ability to pay would be misleading both sides.
   */
  student: [{ kind: "study_certificate", count: 1, optional: false }],
};

/**
 * The checklist, for one occupation and one shape of identity document.
 *
 * `singleFileId` is the tenant's answer to "do you have it as one file?" — it decides which
 * identity lines are shown, and nothing else.
 */
export function requiredDocuments(
  occupation: Occupation,
  singleFileId = false,
): readonly DocumentRequirement[] {
  const identity = singleFileId ? IDENTITY_AS_ONE_FILE : IDENTITY_AS_TWO_FILES;

  return [...identity, ...BY_OCCUPATION[occupation]];
}

/** A document already uploaded. `path` is what the Storage rules can check. */
export type TenantDocument = {
  readonly id: string;
  readonly kind: DocumentKind;
  /** `applicants/{uid}/…` — always inside the owner's folder. */
  readonly path: string;
  /** The name the file had on the person's computer, so they can tell two apart. */
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
};

/** How many of a kind are already there. */
export function countOf(documents: readonly { readonly kind: DocumentKind }[], kind: DocumentKind): number {
  return documents.filter((document) => document.kind === kind).length;
}

/**
 * What is still missing, in the order the checklist shows it.
 *
 * Optional lines never appear here: the point of the list is what stands between the tenant and
 * the next stage, and something that may not exist cannot be on it.
 */
export function missingDocuments(
  occupation: Occupation,
  documents: readonly { readonly kind: DocumentKind }[],
): readonly DocumentRequirement[] {
  // Whichever shape the identity document came in, it counts: `missingDocuments` answers "what
  // stands between this tenant and the next stage", and a document already there does not.
  const identity = identitySatisfied(documents)
    ? []
    : identityShape(documents) === "one_file"
      ? IDENTITY_AS_ONE_FILE
      : IDENTITY_AS_TWO_FILES.filter((requirement) => countOf(documents, requirement.kind) < 1);

  return [
    ...identity,
    ...BY_OCCUPATION[occupation].filter(
      (requirement) =>
        !requirement.optional && countOf(documents, requirement.kind) < requirement.count,
    ),
  ];
}

/** Is the paperwork done? What the landlord's "continuar" leans on. */
export function documentsComplete(
  occupation: Occupation,
  documents: readonly { readonly kind: DocumentKind }[],
): boolean {
  return missingDocuments(occupation, documents).length === 0;
}

/** `3 de 5 documentos` — progress said in whole files, which is what the person is holding. */
export function documentProgress(
  occupation: Occupation,
  documents: readonly { readonly kind: DocumentKind }[],
): { readonly uploaded: number; readonly required: number } {
  const single = identityShape(documents) === "one_file";
  const lines = requiredDocuments(occupation, single).filter((requirement) => !requirement.optional);

  return {
    required: lines.reduce((total, requirement) => total + requirement.count, 0),
    uploaded: lines.reduce(
      (total, requirement) => total + Math.min(countOf(documents, requirement.kind), requirement.count),
      0,
    ),
  };
}

/**
 * How a landlord has judged one uploaded document.
 *
 * `pending` is the honest default: a document nobody has looked at is not approved, and the
 * gate on advancing the process leans on exactly that distinction.
 */
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  pending: "Sin revisar",
  approved: "Aprobado",
  rejected: "Rechazado",
};

/** What the landlord recorded about one document, kept per application. */
export type DocumentReview = {
  readonly status: ReviewStatus;
  /** Why it was rejected, which is what tells the tenant what to upload instead. */
  readonly note: string;
  /** ISO 8601. */
  readonly at: string;
};

export type DocumentReviews = Readonly<Record<string, DocumentReview>>;

/**
 * The documents that still count, which is not all of them.
 *
 * A rejected file occupies no slot: with three payslips uploaded and one rejected, counting it
 * left the line reading "Completo" with the upload button disabled — so the one thing the tenant
 * had to do, replace it, was the one thing the screen would not let them do.
 */
export function acceptable<T extends { readonly id: string }>(
  documents: readonly T[],
  reviews: DocumentReviews,
): readonly T[] {
  return documents.filter((document) => statusOf(reviews, document.id) !== "rejected");
}

export function reviewOf(reviews: DocumentReviews, documentId: string): DocumentReview | null {
  return reviews[documentId] ?? null;
}

export function statusOf(reviews: DocumentReviews, documentId: string): ReviewStatus {
  return reviews[documentId]?.status ?? "pending";
}

/**
 * Why the process cannot move past the documents yet, or `null` when it can.
 *
 * Three reasons, in the order they have to be dealt with: something is not uploaded, something
 * was rejected and has to be replaced, something has not been looked at. Returning *which* one
 * is the point — a disabled button that does not say why is a button people click twice and then
 * write to support about.
 */
export type DocumentsBlocker =
  | { readonly reason: "missing"; readonly count: number }
  | { readonly reason: "rejected"; readonly count: number }
  | { readonly reason: "unreviewed"; readonly count: number };

export function documentsBlocker(
  occupation: Occupation,
  documents: readonly { readonly id: string; readonly kind: DocumentKind }[],
  reviews: DocumentReviews,
): DocumentsBlocker | null {
  const missing = missingDocuments(occupation, documents);
  if (missing.length > 0) return { reason: "missing", count: missing.length };

  const rejected = documents.filter((document) => statusOf(reviews, document.id) === "rejected");
  if (rejected.length > 0) return { reason: "rejected", count: rejected.length };

  const unreviewed = documents.filter((document) => statusOf(reviews, document.id) === "pending");
  if (unreviewed.length > 0) return { reason: "unreviewed", count: unreviewed.length };

  return null;
}

/** The blocker, in words, addressed to whoever is looking at the button. */
export function documentsBlockerMessage(
  blocker: DocumentsBlocker,
  isLandlord: boolean,
): string {
  const plural = blocker.count === 1;

  switch (blocker.reason) {
    case "missing":
      return isLandlord
        ? `Falta${plural ? "" : "n"} ${blocker.count} documento${plural ? "" : "s"} por subir. El inquilino tiene que completarlo${plural ? "" : "s"} primero.`
        : `Te falta${plural ? "" : "n"} ${blocker.count} documento${plural ? "" : "s"} por subir.`;
    case "rejected":
      return isLandlord
        ? `Rechazaste ${blocker.count} documento${plural ? "" : "s"}. El inquilino debe subirlo${plural ? "" : "s"} de nuevo.`
        : `El propietario rechazó ${blocker.count} documento${plural ? "" : "s"}. Súbelo${plural ? "" : "s"} otra vez.`;
    case "unreviewed":
      return isLandlord
        ? `Te queda${plural ? "" : "n"} ${blocker.count} documento${plural ? "" : "s"} por revisar. Apruébalo${plural ? "" : "s"} o recházalo${plural ? "" : "s"} para continuar.`
        : `El propietario está revisando ${blocker.count} documento${plural ? "" : "s"}.`;
  }
}

/** What a browser may hand over. PDFs because that is what a bank statement arrives as. */
export const DOCUMENT_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

export function isPdf(document: Pick<TenantDocument, "contentType">): boolean {
  return document.contentType === "application/pdf";
}
