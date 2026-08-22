import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PropertyForm } from "@/features/property";
import { requireCompleteProfile } from "@/features/profile";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { AppShell } from "@/shared/shell/app-shell";

export const metadata: Metadata = {
  title: "Publicar inmueble",
  description: "Publica tu inmueble en miarriendoDIRECTO.com y recibe postulaciones directas.",
};

export default async function PublishPropertyPage() {
  // Publishing needs a complete profile: a tenant has to know who they would be renting from.
  await requireCompleteProfile();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl">
        {/* Publishing is reached from the list, so it offers the way back to it. */}
        <Link
          href={MY_PROPERTIES_ROUTE}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Mis inmuebles
        </Link>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
          Publica tu inmueble
        </h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Sin intermediarios: tú publicas, el inquilino se postula y el proceso queda a la vista
          de ambos hasta la firma.
        </p>

        <PropertyForm />
      </div>
    </AppShell>
  );
}
