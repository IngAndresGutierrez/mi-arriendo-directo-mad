import type { Metadata } from "next";
import { HouseIcon, SparklesIcon } from "lucide-react";

import { AppShell } from "@/shared/shell/app-shell";
import { ComingSoonCard } from "@/shared/ui/coming-soon-card";
import { SupportCard } from "@/shared/shell/support-card";

import { ContractsCard, getUserContracts } from "@/features/contract";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { firstName, greetingForHour, hourInProductTimeZone } from "@/shared/format/greeting";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Tu portal en miarriendoDIRECTO.com.",
};

export default async function HomePage() {
  const user = await requireCompleteProfile();

  // Independent reads: run them in parallel so the Firestore round trips do not chain.
  const [profile, contracts] = await Promise.all([
    getProfile(user.uid),
    getUserContracts(user.uid),
  ]);

  // The greeting is computed in Colombian time, not the server's: on Vercel that would be
  // UTC, and at 8 p.m. in Bogotá it would say "Buenos días".
  const greeting = greetingForHour(hourInProductTimeZone(new Date()));
  const name = profile ? firstName(profile.fullName) : "";

  return (
    <AppShell>
      <p className="text-sm text-muted-foreground">{greeting}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        Bienvenido de nuevo{name ? `, ${name}` : ""} <span aria-hidden="true">👋</span>
      </h1>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <ContractsCard contracts={contracts} />
        </div>

        <aside className="space-y-4" aria-label="Atajos y ayuda">
          <SupportCard firstName={name} />

          <ComingSoonCard label="El catálogo de inmuebles llegará pronto">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
              >
                <HouseIcon className="size-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">¿Buscas un nuevo hogar?</p>
                <p className="text-sm text-muted-foreground">Explora los inmuebles disponibles</p>
              </div>
            </div>
          </ComingSoonCard>

          {/* Static content: it promises no functionality, so it needs no tooltip. */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <SparklesIcon className="size-4 text-accent" aria-hidden="true" />
              Consejo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ten tu cédula y tu certificado laboral a mano: con los documentos al día, una
              postulación se aprueba en minutos.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
