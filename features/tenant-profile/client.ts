/**
 * The half of the tenant profile module a Client Component may import.
 *
 * `index.ts` re-exports the data layer and the Server Action, which are `server-only`; a client
 * bundle that touched them would fail to build. Everything here is the form's own material:
 * the fields, the schema they validate against, and the defaults they start from.
 */
export {
  DOCUMENT_TYPES,
  OCCUPATIONS,
  type DocumentType,
  type Occupation,
  type TenantDossier,
  type TenantProfile,
} from "./domain/tenant-profile";
export {
  tenantDossierSchema,
  type TenantDossierInput,
  type TenantDossierValues,
} from "./validations/tenant-profile";
export { DossierFields } from "./ui/dossier-fields";
export { emptyDossier, toFormValues } from "./ui/defaults";
export {
  countOf,
  documentProgress,
  documentsComplete,
  isPdf,
  missingDocuments,
  requiredDocuments,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_MAX_BYTES,
  type DocumentKind,
  type DocumentRequirement,
  type TenantDocument,
  documentsBlocker,
  documentsBlockerMessage,
  identitySatisfied,
  identityShape,
  reviewOf,
  statusOf,
  IDENTITY_AS_ONE_FILE,
  IDENTITY_AS_TWO_FILES,
  REVIEW_STATUS_LABELS,
  type DocumentReview,
  type DocumentReviews,
  type DocumentsBlocker,
  type ReviewStatus,
} from "./domain/documents";
export { deleteTenantDocument, recordTenantDocument } from "./actions/documents";
export { DocumentChecklist, type ChecklistDocument } from "./ui/document-checklist";
export { Verdict } from "./ui/document-checklist";

/** The label records, resolved for one language. Replaces the five `X_LABELS` constants. */
export { dossierLabels, type DossierLabels } from "./domain/labels";
