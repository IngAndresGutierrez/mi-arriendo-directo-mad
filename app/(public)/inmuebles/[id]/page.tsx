import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LockIcon, MapPinIcon } from "lucide-react";

import {
  getPropertyLocation,
  getVisibleProperty,
  publicLocationLabel,
  PropertyFacts,
  PropertyGallery,
  PropertyPriceCard,
  PROPERTY_STATUS_LABELS,
} from "@/features/property";
import { getSessionUser } from "@/shared/auth/session";

type DetailProps = PageProps<"/inmuebles/[id]">;

export async function generateMetadata(props: DetailProps): Promise<Metadata> {
  const { id } = await props.params;
  const viewer = await getSessionUser();
  const property = await getVisibleProperty(id, viewer?.uid ?? null);

  if (!property) return { title: "Inmueble no disponible" };

  return {
    title: property.title,
    description: `${property.title} en ${publicLocationLabel(property.area)}.`,
  };
}

export default async function PropertyDetailPage(props: DetailProps) {
  const { id } = await props.params;

  // The session is optional here: the catalog is public. It only decides whether this viewer
  // is the owner, which unlocks their own unpublished listing and the exact address.
  const viewer = await getSessionUser();
  const property = await getVisibleProperty(id, viewer?.uid ?? null);

  if (!property) notFound();

  const isOwner = viewer?.uid === property.landlordUid;
  const location = isOwner ? await getPropertyLocation(id, viewer.uid) : null;

  return (
    <article className="space-y-8">
      {isOwner && property.status !== "available" && (
        <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Este anuncio está en <strong>{PROPERTY_STATUS_LABELS[property.status]}</strong>: solo tú
          puedes verlo.
        </p>
      )}

      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary sm:text-4xl dark:text-foreground">
            {property.title}
          </h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
            {publicLocationLabel(property.area)}
            <span className="text-muted-foreground/70">· {property.area.department}</span>
          </p>
          <PropertyFacts property={property} />

          {location && (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-medium text-foreground">{location.line}</strong> — la
                dirección exacta solo la ves tú. El inquilino la recibe cuando apruebes su
                postulación.
              </span>
            </p>
          )}
        </div>

        <PropertyGallery photos={property.photos} title={property.title} />
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary dark:text-foreground">
            Sobre el inmueble
          </h2>
          <p className="text-pretty whitespace-pre-line text-muted-foreground">
            {property.description}
          </p>

          <h2 className="pt-4 text-xl font-semibold text-primary dark:text-foreground">Ubicación</h2>
          <p className="text-muted-foreground">
            {publicLocationLabel(property.area)}, {property.area.department}. Por seguridad, la
            dirección exacta se comparte con el inquilino cuando el propietario aprueba su
            postulación.
          </p>
        </section>

        <PropertyPriceCard property={property} />
      </div>
    </article>
  );
}
