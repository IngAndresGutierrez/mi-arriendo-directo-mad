import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRightIcon, LockIcon, MapPinIcon } from "lucide-react";

import {
  getPropertyLocation,
  getVisibleProperty,
  getVisiblePropertyBySlug,
  propertyIdFromSlug,
  propertyMonthlyCost,
  publicLocationLabel,
  PropertyFacts,
  PropertyGallery,
  PropertyPriceCard,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "@/features/property";
import { applicationBlocker, getTenantApplicationTo } from "@/features/application";
import { PROPERTIES_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { getSessionUser } from "@/shared/auth/session";

type DetailProps = PageProps<"/inmuebles/[slug]">;

/**
 * Resolves the property behind a URL segment.
 *
 * The slug alone is the address now. Two older shapes still resolve, and are redirected rather
 * than served: `<slug>-<id>` from when the id was appended, and a bare `<id>` from before slugs
 * existed. A link that was already pasted somewhere must not rot.
 */
async function resolve(segment: string): Promise<{ property: Property; canonical: string } | null> {
  const viewer = await getSessionUser();
  const viewerUid = viewer?.uid ?? null;

  const bySlug = await getVisiblePropertyBySlug(segment, viewerUid);
  const legacyId = bySlug
    ? null
    : (propertyIdFromSlug(segment) ?? (/^[A-Za-z0-9]{20}$/.test(segment) ? segment : null));

  const property = bySlug ?? (legacyId ? await getVisibleProperty(legacyId, viewerUid) : null);
  if (!property) return null;

  return { property, canonical: propertyDetailRoute(property.slug) };
}

export async function generateMetadata(props: DetailProps): Promise<Metadata> {
  const { slug } = await props.params;
  const found = await resolve(slug);

  if (!found) return { title: "Inmueble no disponible" };

  const { property, canonical } = found;
  const where = publicLocationLabel(property.area);
  const bathrooms = property.bathrooms === 1 ? "1 baño" : `${property.bathrooms} baños`;
  const description =
    `${PROPERTY_TYPE_LABELS[property.type]} en ${where} por ` +
    `${formatCOP(propertyMonthlyCost(property))} al mes. ` +
    `${property.bedrooms} hab · ${bathrooms} · ${property.areaM2} m².`;

  // Shared into WhatsApp or a Facebook group, the preview card is the listing: the cover photo
  // and this line are what someone decides on before the page even opens.
  return {
    title: property.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: canonical,
      title: property.title,
      description,
      images: property.photos.slice(0, 1).map((photo) => ({ url: photo.url })),
    },
  };
}

export default async function PropertyDetailPage(props: DetailProps) {
  const { slug } = await props.params;
  const found = await resolve(slug);

  if (!found) notFound();
  const { property, canonical } = found;

  // One property, one address: a stale or hand-typed slug is redirected instead of served, so
  // search engines and shared links converge on the same URL.
  if (slug !== property.slug) permanentRedirect(canonical);

  const viewer = await getSessionUser();
  const isOwner = viewer?.uid === property.landlordUid;
  const location = isOwner ? await getPropertyLocation(property.id, viewer.uid) : null;

  // What the apply button should say, decided here because it needs the session and the
  // reader's own application — neither of which belongs inside a presentational card.
  const existing = viewer ? await getTenantApplicationTo(property.id, viewer.uid) : null;
  const apply = applyStateFor(property, viewer?.uid ?? null, existing);

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

          {/* Someone who liked this one is usually looking in that city, not at that one. */}
          <Link
            href={`${PROPERTIES_ROUTE}?city=${encodeURIComponent(property.area.city)}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-foreground"
          >
            Ver más arriendos en {property.area.city}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>

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

        <PropertyPriceCard
          property={property}
          applyState={apply.state}
          applicationId={apply.applicationId}
        />
      </div>
    </article>
  );
}

/** Which of the five things the apply button is, for this reader. */
function applyStateFor(
  property: Property,
  viewerUid: string | null,
  existing: { readonly id: string; readonly status: string } | null,
): {
  readonly state: "anonymous" | "own" | "open" | "closed" | "can_apply";
  readonly applicationId?: string;
} {
  if (!viewerUid) return { state: "anonymous" };

  const blocker = applicationBlocker(property, viewerUid, existing as never);
  if (blocker === "own_property") return { state: "own" };
  if (blocker === "already_applied" && existing) {
    return { state: "open", applicationId: existing.id };
  }
  if (blocker === "closed_before") return { state: "closed" };

  return { state: "can_apply" };
}
