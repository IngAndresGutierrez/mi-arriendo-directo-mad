import type { Metadata } from "next";
import Link from "next/link";
import { BuildingIcon, PlusIcon } from "lucide-react";

import { requireCompleteProfile } from "@/features/profile";
import { listLandlordProperties, PropertyManageCard } from "@/features/property";
import { PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { AppShell } from "@/shared/shell/app-shell";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = {
  title: "Mis inmuebles",
  description: "Gestiona los inmuebles que publicaste en miarriendoDIRECTO.com.",
};

export default async function MyPropertiesPage() {
  const user = await requireCompleteProfile();
  const properties = await listLandlordProperties(user.uid);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-primary dark:text-foreground">
              Mis inmuebles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {properties.length === 0
                ? "Todavía no has publicado ninguno."
                : `${properties.length} ${properties.length === 1 ? "publicado" : "publicados"}.`}
            </p>
          </div>
          {/*
            Publishing lives here, not in the menu: it is what you do to this list, and the
            action belongs next to the thing it changes.
          */}
          <Button asChild variant="accent" size="xl">
            <Link href={PUBLISH_PROPERTY_ROUTE}>
              <PlusIcon aria-hidden="true" />
              Publicar inmueble
            </Link>
          </Button>
        </div>

        {properties.length === 0 ? (
          // First use is the normal case for a new landlord, not an error state.
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <BuildingIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Publica tu primer inmueble y compártelo: el inquilino se postula directamente
              contigo, sin intermediarios.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {properties.map((property) => (
              <PropertyManageCard key={property.id} property={property} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
