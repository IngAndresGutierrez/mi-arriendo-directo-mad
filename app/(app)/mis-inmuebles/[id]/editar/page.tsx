import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { requireCompleteProfile } from "@/features/profile";
import { getOwnedProperty, getPropertyLocation, PropertyForm } from "@/features/property";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { AppSidebar } from "@/shared/shell/app-sidebar";
import { TooltipProvider } from "@/shared/ui/tooltip";

export const metadata: Metadata = {
  title: "Editar inmueble",
};

export default async function EditPropertyPage(props: PageProps<"/mis-inmuebles/[id]/editar">) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  // Ownership is decided by the read, not by the URL: a stranger gets the same answer as
  // someone asking for a property that does not exist.
  const property = await getOwnedProperty(id, user.uid);
  if (!property) notFound();

  const location = await getPropertyLocation(id, user.uid);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar />

        <main className="min-w-0 flex-1 px-6 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <Link
              href={MY_PROPERTIES_ROUTE}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Mis inmuebles
            </Link>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
              Editar inmueble
            </h1>
            <p className="mt-1 mb-8 text-sm text-muted-foreground">
              Los cambios se ven de inmediato en el anuncio. Si cambias el título o la ciudad, el
              enlace nuevo empieza a funcionar y el anterior sigue llevando aquí.
            </p>

            <PropertyForm property={property} addressLine={location?.line ?? ""} />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
