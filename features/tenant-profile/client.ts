/**
 * The half of the tenant profile module a Client Component may import.
 *
 * `index.ts` re-exports the data layer and the Server Action, which are `server-only`; a client
 * bundle that touched them would fail to build. Everything here is the form's own material:
 * the fields, the schema they validate against, and the defaults they start from.
 */
export {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  EMPLOYER_LABELS,
  OCCUPATIONS,
  OCCUPATION_LABELS,
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
