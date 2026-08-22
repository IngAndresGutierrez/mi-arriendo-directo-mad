/**
 * Public API of the tenant profile module. Anything not exported here is internal.
 */
export {
  incomeRatioLabel,
  INCOME_RATIO_GUIDE,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  EMPLOYER_LABELS,
  OCCUPATIONS,
  OCCUPATION_LABELS,
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
