import type { Metadata } from "next";
import { HouseIcon, SparklesIcon } from "lucide-react";

import { AppSidebar } from "@/shared/shell/app-sidebar";
import { ComingSoonCard } from "@/shared/ui/coming-soon-card";
import { SupportCard } from "@/shared/shell/support-card";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { ContractsCard, getUserContracts } from "@/features/contract";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { firstName, greetingForHour, hourInProductTimeZone } from "@/shared/format/greeting";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Tu portal en miarriendoDIRECTO.com.",
};

export default async function HomePage() {
  const user = await requireCompleteProfile();

  // Independientes: en paralelo para no encadenar dos viajes a Firestore.
  const [profile, contracts] = await Promise.all([
    getProfile(user.uid),
    getUserContracts(user.uid),
  ]);

  // El saludo se calcula en hora de Colombia, no en la del servidor: en Vercel sería UTC y
  // a las 8 p.m. de Bogotá saludaría "Buenos días".
  const greeting = greetingForHour(hourInProductTimeZone(new Date()));
  const name = profile ? firstName(profile.fullName) : "";

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar />

        <main className="min-w-0 flex-1 px-6 py-8 sm:px-10">
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

              {/* Contenido estático: no promete ninguna función, así que va sin tooltip. */}
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
        </main>
      </div>
    </TooltipProvider>
  );
}
