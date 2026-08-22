import type { Metadata } from "next";

import { getProfile, requireCompleteProfile } from "@/features/profile";
import { findCountry } from "@/shared/phone/countries";
import { getTenantProfile, TenantProfileForm } from "@/features/tenant-profile";

export const metadata: Metadata = {
  title: "Perfil de inquilino",
  description: "Los datos que envías con cada postulación, guardados una sola vez.",
  robots: { index: false },
};

export default async function TenantProfilePage() {
  const user = await requireCompleteProfile();

  // Independent reads: neither half depends on the other.
  const [dossier, account] = await Promise.all([getTenantProfile(user.uid), getProfile(user.uid)]);

  /*
   * The phone comes back from E.164 to the national digits the field shows: `+57` belongs to
   * the country selector, and leaving it in the text box makes the number fail its own
   * validation the moment it is touched.
   */
  const country = account ? findCountry(account.phoneCountry) : undefined;
  const national =
    account && country && account.phone.startsWith(country.dialCode)
      ? account.phone.slice(country.dialCode.length)
      : (account?.phone ?? "");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Perfil de inquilino
      </h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Lo que un propietario necesita saber de ti. Se guarda una vez y viaja contigo a cada
        postulación; ahí podrás revisarlo antes de enviarlo.{" "}
        <strong className="font-medium text-foreground">
          Nadie más que tú puede ver esta página
        </strong>
        : un propietario solo recibe una copia cuando tú te postulas a su inmueble.
      </p>

      <TenantProfileForm
        profile={dossier}
        account={{
          fullName: account?.fullName ?? "",
          phone: { country: account?.phoneCountry ?? "CO", national },
          gender: account?.gender,
          birthDate: account?.birthDate ?? "",
          address: {
            line: account?.address.line ?? "",
            city: account?.address.city ?? "",
            department: account?.address.department,
          },
        }}
      />
    </div>
  );
}
