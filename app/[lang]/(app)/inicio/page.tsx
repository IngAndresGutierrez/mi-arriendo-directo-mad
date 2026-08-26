import { dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { HouseIcon, SparklesIcon } from "lucide-react";

import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { SupportCard } from "@/shared/shell/support-card";

import { listApplicationsFor, RentalsCard } from "@/features/application";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { firstName, greetingForHour, hourInProductTimeZone } from "@/shared/format/greeting";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).portal;

  return { title: copy.homeTitle, description: copy.homeMeta };
}

export default async function HomePage() {
  const t = (await dictionary()).portal;
  const user = await requireCompleteProfile();

  // Independent reads: run them in parallel so the Firestore round trips do not chain.
  const [profile, applications] = await Promise.all([
    getProfile(user.uid),
    listApplicationsFor(user.uid),
  ]);

  // Only the ones still moving: a closed process belongs to the record, not to the home screen.
  const open = applications.filter((application) => application.status === "open");

  // The greeting is computed in Colombian time, not the server's: on Vercel that would be
  // UTC, and at 8 p.m. in Bogotá it would say "Buenos días".
  const greeting = greetingForHour(hourInProductTimeZone(new Date()));
  const name = profile ? firstName(profile.fullName) : "";

  return (
    <>
      <p className="text-sm text-muted-foreground">{t[greeting]}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
        {t.welcomeBackBefore}
        {name ? `, ${name}` : ""} <span aria-hidden="true">👋</span>
      </h1>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <RentalsCard applications={open} viewerUid={user.uid} />
        </div>

        <aside className="space-y-4" aria-label={t.shortcutsAria}>
          <SupportCard firstName={name} />

          {/*
            En pestaña nueva: el catálogo es otro contexto — chrome público, otra mitad del
            producto — y quien está mirando sus procesos abiertos y se va a ver anuncios no ha
            terminado con esta página. Volver debería ser cerrar una pestaña, no rehacer el camino.
          */}
          <NewTabLink
            href={PROPERTIES_ROUTE}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
            >
              <HouseIcon className="size-5" />
            </span>
            <div>
              <p className="font-medium text-foreground">{t.lookingForHome}</p>
              <p className="text-sm text-muted-foreground">{t.browseProperties}</p>
            </div>
          </NewTabLink>

          {/* Static content: it promises no functionality, so it needs no tooltip. */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <SparklesIcon className="size-4 text-accent" aria-hidden="true" />
              {t.tip}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t.tipBody}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
