import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { ApplicationCard, listApplicationsFor } from "@/features/application";
import { requireCompleteProfile } from "@/features/profile";
import { PROPERTIES_ROUTE, TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = {
  title: "Contrato",
  description: "El proceso de tu arriendo, etapa por etapa.",
};

export default async function ContractPage() {
  const user = await requireCompleteProfile();
  const applications = await listApplicationsFor(user.uid);

  const open = applications.filter((application) => application.status === "open");
  const closed = applications.filter((application) => application.status !== "open");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Contrato
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        El proceso de arriendo, de la postulación a la firma. Aquí lo ven las dos partes.
      </p>

      {applications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <FileTextIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Todavía no hay ningún proceso. Empieza postulándote a un inmueble, o espera a que
            alguien se postule a los tuyos.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="accent" size="lg">
              <Link href={PROPERTIES_ROUTE}>Ver inmuebles</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={TENANT_PROFILE_ROUTE}>Llenar mi perfil de inquilino</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {open.length > 0 && (
            <section aria-labelledby="open-heading" className="space-y-4">
              <h2 id="open-heading" className="font-semibold text-foreground">
                En proceso
              </h2>
              <ul className="space-y-4">
                {open.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    viewerUid={user.uid}
                  />
                ))}
              </ul>
            </section>
          )}

          {closed.length > 0 && (
            <section aria-labelledby="closed-heading" className="space-y-4">
              <h2 id="closed-heading" className="font-semibold text-foreground">
                Cerrados
              </h2>
              <ul className="space-y-4">
                {closed.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    viewerUid={user.uid}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
