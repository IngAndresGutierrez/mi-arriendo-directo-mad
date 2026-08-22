import type { Metadata } from "next";

import { requireCompleteProfile } from "@/features/profile";
import { getTenantProfile, TenantProfileForm } from "@/features/tenant-profile";
import { AppShell } from "@/shared/shell/app-shell";

export const metadata: Metadata = {
  title: "Perfil de inquilino",
  description: "Los datos que envías con cada postulación, guardados una sola vez.",
  robots: { index: false },
};

export default async function TenantProfilePage() {
  const user = await requireCompleteProfile();
  const profile = await getTenantProfile(user.uid);

  return (
    <AppShell>
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

        <TenantProfileForm profile={profile} />
      </div>
    </AppShell>
  );
}
