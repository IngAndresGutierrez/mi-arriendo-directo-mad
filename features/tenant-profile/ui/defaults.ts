import { DEFAULT_COUNTRY_ISO } from "@/shared/phone/countries";
import { findCountry } from "@/shared/phone/countries";

import type { TenantProfile } from "../domain/tenant-profile";
import type { TenantDossierInput } from "../validations/tenant-profile";

/** A blank dossier, with the fields a Colombian form should already have decided. */
export function emptyDossier(): TenantDossierInput {
  return {
    documentType: "cc",
    documentNumber: "",
    occupation: "employee",
    employer: "",
    monthlyIncome: "" as unknown as number,
    householdSize: "" as unknown as number,
    hasPets: false,
    petsDescription: "",
    reference: {
      name: "",
      phone: "",
      phoneCountry: DEFAULT_COUNTRY_ISO,
      relationship: "",
    },
    referenceAuthorized: false,
  };
}

/**
 * A stored dossier as the form wants it.
 *
 * The reference's phone comes back from E.164 to the national digits the field shows: `+57` is
 * the country selector's job, and leaving it in the text box makes the number fail its own
 * validation the moment the tenant touches it.
 */
export function toFormValues(profile: TenantProfile): TenantDossierInput {
  const country = findCountry(profile.reference.phoneCountry);
  const national =
    country && profile.reference.phone.startsWith(country.dialCode)
      ? profile.reference.phone.slice(country.dialCode.length)
      : profile.reference.phone;

  return {
    documentType: profile.documentType,
    documentNumber: profile.documentNumber,
    occupation: profile.occupation,
    employer: profile.employer,
    monthlyIncome: profile.monthlyIncome,
    householdSize: profile.householdSize,
    hasPets: profile.hasPets,
    petsDescription: profile.petsDescription,
    reference: {
      name: profile.reference.name,
      phone: national,
      phoneCountry: profile.reference.phoneCountry,
      relationship: profile.reference.relationship,
    },
    /*
     * **`false` even for a stored dossier, and it is asked again on every save.**
     *
     * Unlike the terms — accepted once, at onboarding, and never re-asked — this declaration is
     * about *the phone number currently in the field beside it*, and that field is editable. A tick
     * carried over from six months ago would be a declaration about whoever the reference used to
     * be. Every dossier stored before this field existed also never carried it, so pre-ticking
     * would fabricate a declaration nobody made.
     */
    referenceAuthorized: false,
  };
}
