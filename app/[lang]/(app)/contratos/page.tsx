import { dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { FileTextIcon } from "lucide-react";

import { ApplicationCard, listApplicationsFor } from "@/features/application";
import { requireCompleteProfile } from "@/features/profile";
import { PROPERTIES_ROUTE, TENANT_PROFILE_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).portal;

  return { title: copy.contractsTitle, description: copy.contractsMeta };
}

export default async function ContractPage() {
  const t = (await dictionary()).portal;
  const user = await requireCompleteProfile();
  const applications = await listApplicationsFor(user.uid);

  const open = applications.filter((application) => application.status === "open");
  const closed = applications.filter((application) => application.status !== "open");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {t.contractsTitle}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.contractsIntro}
      </p>

      {applications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <FileTextIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            {t.contractsEmpty}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="accent" size="lg">
              <Link href={PROPERTIES_ROUTE}>{t.seeProperties}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={TENANT_PROFILE_ROUTE}>{t.fillTenantProfile}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {open.length > 0 && (
            <section aria-labelledby="open-heading" className="space-y-4">
              <h2
                id="open-heading"
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {t.contractsOpen(open.length)}
              </h2>
              {/*
                Uno por fila: la barra de etapas y la frase de "siguiente paso" son lo que
                trae a alguien a esta pantalla, y en media columna la barra deja de leerse.
              */}
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
              <h2
                id="closed-heading"
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {t.contractsClosed(closed.length)}
              </h2>
              {/* Ya no hay nada que hacer en ellos: caben de dos en dos y no compiten con los abiertos. */}
              <ul className="grid gap-4 lg:grid-cols-2">
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
