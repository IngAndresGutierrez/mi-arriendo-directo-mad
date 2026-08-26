/**
 * Public API of the tenant profile module. Anything not exported here is internal.
 */
export {
  incomeRatioLabel,
  INCOME_RATIO_GUIDE,
  DOCUMENT_TYPES,
  OCCUPATIONS,
  type DocumentType,
  type Occupation,
  type TenantDossier,
  type TenantProfile,
  type TenantReference,
} from "./domain/tenant-profile";
export { tenantDossierSchema, type TenantDossierInput, type TenantDossierValues } from "./validations/tenant-profile";
export { getTenantProfile } from "./data/tenant-profile";
export { saveTenantProfile, type SaveTenantProfileResult } from "./actions/save-tenant-profile";
export { dossierFromForm, toStoredDossier } from "./actions/form-input";
export { TenantProfileForm } from "./ui/tenant-profile-form";
export { DossierFields } from "./ui/dossier-fields";
export { emptyDossier, toFormValues } from "./ui/defaults";
export {
  countOf,
  documentProgress,
  documentsComplete,
  isPdf,
  missingDocuments,
  requiredDocuments,
  type DocumentKind,
  type DocumentRequirement,
  type TenantDocument,
  documentsBlocker,
  documentsBlockerMessage,
  identitySatisfied,
  identityShape,
  statusOf,
  REVIEW_STATUS_LABELS,
  type DocumentReview,
  type DocumentReviews,
  type DocumentsBlocker,
  type ReviewStatus,
} from "./domain/documents";
export { listTenantDocuments, withSignedUrls, type ViewableDocument } from "./data/documents";
export { deleteTenantDocument, recordTenantDocument } from "./actions/documents";
export { DocumentChecklist, type ChecklistDocument } from "./ui/document-checklist";

/** The label records, resolved for one language. Replaces the five `X_LABELS` constants. */
export { dossierLabels, type DossierLabels } from "./domain/labels";
