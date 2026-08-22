import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";

import {
  closedAtLabel,
  getApplicationFor,
  DossierSummary,
  StageActions,
  StageTimeline,
} from "@/features/application";
import { requireCompleteProfile } from "@/features/profile";
import { CONTRACT_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { AppShell } from "@/shared/shell/app-shell";

export const metadata: Metadata = {
  title: "Proceso de arriendo",
};

export default async function ApplicationPage(props: PageProps<"/contrato/[id]">) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  // Membership is decided by the read: a stranger gets the same answer as a process that does
  // not exist, so the page cannot even confirm that this id is real.
  const application = await getApplicationFor(id, user.uid);
  if (!application) notFound();

  const isLandlord = application.landlordUid === user.uid;
  const closed = closedAtLabel(application);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href={CONTRACT_ROUTE}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Contrato
        </Link>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
          {application.propertyTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLandlord
            ? `${application.tenantName || "Un inquilino"} se postuló · ${application.propertyCity}`
            : `Tu postulación · ${application.propertyCity}`}{" "}
          ·{" "}
          <Link href={propertyDetailRoute(application.propertySlug)} className="hover:underline">
            ver el anuncio
          </Link>
        </p>

        {closed ? (
          <p className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            {closed}
            {application.closingNote ? (
              <>
                {" — "}
                <span className="text-foreground">{application.closingNote}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-primary dark:text-foreground">La postulación</h2>
            <p className="text-sm text-muted-foreground">
              {formatCOP(application.monthlyCost)} al mes ·{" "}
              {application.leaseMonths === 6 ? "6 meses" : "1 año"} · desde el{" "}
              {new Intl.DateTimeFormat("es-CO", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "America/Bogota",
              }).format(new Date(`${application.desiredMoveIn}T12:00:00Z`))}
            </p>
          </div>

          {/*
            The identity document and the reference's phone are for the landlord alone. The
            tenant already knows them, and rendering them again is one more screen they could be
            standing in front of someone with.
          */}
          <DossierSummary
            dossier={application.dossier}
            monthlyCost={application.monthlyCost}
            showSensitive={isLandlord}
          />

          {application.message ? (
            <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <MessageSquareIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="text-foreground">{application.message}</span>
            </p>
          ) : null}
        </section>

        <div className="mt-6">
          <StageActions application={application} isLandlord={isLandlord} />
        </div>

        <div className="mt-8">
          <StageTimeline application={application} isLandlord={isLandlord} />
        </div>
      </div>
    </AppShell>
  );
}
