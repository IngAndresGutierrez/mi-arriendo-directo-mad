import type { Metadata } from "next";

import { PropertyForm } from "@/features/property";
import { requireCompleteProfile } from "@/features/profile";
import { AppSidebar } from "@/shared/shell/app-sidebar";
import { TooltipProvider } from "@/shared/ui/tooltip";

export const metadata: Metadata = {
  title: "Publicar inmueble",
  description: "Publica tu inmueble en miarriendoDIRECTO.com y recibe postulaciones directas.",
};

export default async function PublishPropertyPage() {
  // Publishing needs a complete profile: a tenant has to know who they would be renting from.
  await requireCompleteProfile();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar />

        <main className="min-w-0 flex-1 px-6 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
              Publica tu inmueble
            </h1>
            <p className="mt-1 mb-8 text-sm text-muted-foreground">
              Sin intermediarios: tú publicas, el inquilino se postula y el proceso queda a la
              vista de ambos hasta la firma.
            </p>

            <PropertyForm />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
