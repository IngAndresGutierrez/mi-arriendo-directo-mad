import { currentLocale, dictionary } from "@/shared/i18n/server";
import { dossierLabels } from "@/features/tenant-profile";
import type { Metadata } from "next";

import {
  ConsentHistory,
  DeleteAccountCard,
  erasureStatus,
  listConsents,
} from "@/features/legal";
import { OwnPaymentScoreCard, paymentScoreFor } from "@/features/lease";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { bogotaToday } from "@/shared/format/date";
import { findCountry } from "@/shared/phone/countries";
import { getTenantProfile, TenantProfileForm } from "@/features/tenant-profile";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).portal;

  return { title: copy.tenantProfileTitle, description: copy.tenantProfileMeta };
}

export default async function TenantProfilePage() {
  const t = (await dictionary()).portal;
  const user = await requireCompleteProfile();

  /*
   * Five independent reads, in parallel. `Promise.all` and not four `await`s: none of them depends
   * on another, and chaining them would make this page as slow as their sum.
   */
  const [dossier, account, consents, erasure, paymentScore] = await Promise.all([
    getTenantProfile(user.uid),
    getProfile(user.uid),
    listConsents(user.uid),
    erasureStatus(user.uid),
    paymentScoreFor(user.uid, bogotaToday(new Date())),
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
        {t.tenantProfileTitle}
      </h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        {t.tenantProfileIntro}{" "}
        <strong className="font-medium text-foreground">
          {t.tenantProfilePrivate}
        </strong>
        {t.tenantProfilePrivateAfter}
      </p>

      <TenantProfileForm
        common={(await dictionary()).common}
        labels={dossierLabels(await currentLocale())}
        dossierCopy={(await dictionary()).dossier}
        profile={dossier}
        account={{
          fullName: account?.fullName ?? "",
          phone: { country: account?.phoneCountry ?? "CO", national },
          // A select with no value shows its placeholder; `null` is not a value it accepts.
          gender: account?.gender ?? undefined,
          locale: account?.locale ?? undefined,
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
          {t.personalDetails}
        </h2>

        {/*
          La nota de cumplimiento, del lado de quien la lleva.

          **Que pueda verla no es una cortesía: es la Ley 1581.** Una calificación que la persona
          calificada no puede consultar ni controvertir es exactamente lo que el hábeas data regula.
          De ahí la ironía del diseño: se le pueden ocultar los pagos al propietario y **no** se le
          puede ocultar la nota al inquilino. Va en "Mis datos" y no arriba porque es eso — un dato
          sobre él, al lado de lo que autorizó y del botón para irse.
        */}
        <OwnPaymentScoreCard score={paymentScore} />
        <ConsentHistory consents={consents} />
        <DeleteAccountCard blocker={erasure} />
      </div>
    </div>
  );
}
