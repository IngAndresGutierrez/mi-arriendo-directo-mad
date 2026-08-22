/**
 * The tenant's rental dossier: who they are, what they earn, who vouches for them.
 *
 * It lives apart from `users/{uid}` — the account profile — for two reasons. It is far more
 * sensitive (income, identity document), so it is stored where only its owner can read it; and
 * it is *reusable*: a tenant fills it once and every later application starts from it, which is
 * the whole point of it being a profile instead of a form field.
 *
 * An application never points at it. It carries a **snapshot** taken when it was submitted, so
 * a landlord reviewing a dossier sees what was actually declared to them, and editing the
 * profile later cannot silently rewrite history.
 */

export const DOCUMENT_TYPES = ["cc", "ce", "passport"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  cc: "Cédula de ciudadanía",
  ce: "Cédula de extranjería",
  passport: "Pasaporte",
};

export const OCCUPATIONS = ["employee", "self_employed", "business_owner", "student", "retired"] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const OCCUPATION_LABELS: Readonly<Record<Occupation, string>> = {
  employee: "Empleado",
  self_employed: "Independiente",
  business_owner: "Tengo mi propio negocio",
  student: "Estudiante",
  retired: "Pensionado",
};

/** What the employer field is asking for, which depends on how the person earns. */
export const EMPLOYER_LABELS: Readonly<Record<Occupation, string>> = {
  employee: "Dónde trabajas",
  self_employed: "A qué te dedicas",
  business_owner: "Tu negocio",
  student: "Dónde estudias",
  retired: "De dónde recibes tu pensión",
};

export const INCOME_MIN = 0;
/** A ceiling that only catches a typo: nobody's monthly income is a hundred billion pesos. */
export const INCOME_MAX = 100_000_000_000;
export const HOUSEHOLD_MIN = 1;
export const HOUSEHOLD_MAX = 20;

/** Someone who can vouch for the tenant. Not a co-signer: that is a later stage. */
export type TenantReference = {
  readonly name: string;
  /** E.164. */
  readonly phone: string;
  /** ISO of the country the number belongs to — never derived from the number itself. */
  readonly phoneCountry: string;
  readonly relationship: string;
};

/** The dossier itself, without the audit fields. Shared by the form and the snapshot. */
export type TenantDossier = {
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly occupation: Occupation;
  readonly employer: string;
  /** Whole pesos a month. */
  readonly monthlyIncome: number;
  /** How many people would live there, the tenant included. */
  readonly householdSize: number;
  readonly hasPets: boolean;
  /** Only meaningful when `hasPets`; empty otherwise. */
  readonly petsDescription: string;
  readonly reference: TenantReference;
};

/** Shape persisted in `tenantProfiles/{uid}`. */
export type TenantProfileDoc = TenantDossier & {
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
};

/** Shape that crosses to components: serializable. */
export type TenantProfile = TenantDossier & {
  readonly updatedAt: string;
};

/**
 * How many times the declared income covers the monthly cost.
 *
 * Landlords in Colombia ask for three times the canon as a rule of thumb. It is shown, never
 * enforced: the decision is the landlord's, and a hard cut-off here would silently discard
 * people whose situation the number does not describe.
 */
export const INCOME_RATIO_GUIDE = 3;

export function incomeRatio(monthlyIncome: number, monthlyCost: number): number | null {
  if (monthlyCost <= 0 || monthlyIncome <= 0) return null;

  return monthlyIncome / monthlyCost;
}

/** `2.4 veces el canon`, or `null` when there is nothing meaningful to say. */
export function incomeRatioLabel(monthlyIncome: number, monthlyCost: number): string | null {
  const ratio = incomeRatio(monthlyIncome, monthlyCost);
  if (ratio === null) return null;

  const rounded = Math.round(ratio * 10) / 10;

  return `${rounded.toLocaleString("es-CO", { minimumFractionDigits: 1 })} veces el canon`;
}
