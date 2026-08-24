import type { Metadata } from "next";

import {
  ConsentHistory,
  DeleteAccountCard,
  erasureStatus,
  listConsents,
} from "@/features/legal";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { findCountry } from "@/shared/phone/countries";
import { getTenantProfile, TenantProfileForm } from "@/features/tenant-profile";

export const metadata: Metadata = {
  title: "Perfil de inquilino",
  description: "Los datos que envías con cada postulación, guardados una sola vez.",
  // El `noindex, nofollow` lo pone el layout de `(app)` para todo el grupo. Repetirlo aquí con solo
  // `index: false` **reemplazaba** el objeto entero y se comía el `nofollow`.
};

export default async function TenantProfilePage() {
  const user = await requireCompleteProfile();

  /*
   * Four independent reads, in parallel. `Promise.all` and not four `await`s: none of them depends
   * on another, and chaining them would make this page as slow as their sum.
   */
  const [dossier, account, consents, erasure] = await Promise.all([
    getTenantProfile(user.uid),
    getProfile(user.uid),
    listConsents(user.uid),
    erasureStatus(user.uid),
  ]);

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
          // A select with no value shows its placeholder; `null` is not a value it accepts.
          gender: account?.gender ?? undefined,
          birthDate: account?.birthDate ?? "",
          address: {
            line: account?.address.line ?? "",
            city: account?.address.city ?? "",
            department: account?.address.department,
          },
        }}
      />

      {/*
        **Where the rights of Ley 1581 actually get exercised.**

        The policy names a channel and its deadlines, and that alone would comply. But the person
        who wants to know what they authorised, or to leave, is *here* — on the one screen that is
        about them — and making them write an email for something the product can answer in a
        render is compliance without the point of it. `#derechos` in the policy links back the
        other way.
      */}
      <div id="mis-datos" className="mt-12 scroll-mt-24 space-y-4 border-t border-border pt-10">
        <h2 className="text-xl font-semibold tracking-tight text-primary dark:text-foreground">
          Tus datos personales
        </h2>

        <ConsentHistory consents={consents} />
        <DeleteAccountCard blocker={erasure} />
      </div>
    </div>
  );
}
