import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, LockIcon, MapPinIcon } from "lucide-react";

import {
  getPropertyLocation,
  propertyBreadcrumbJsonLd,
  propertyJsonLd,
  propertyMetaDescription,
  propertyMetaTitle,
  publicLocationLabel,
  PropertyFacts,
  PropertyGallery,
  PropertyPriceCard,
  PropertyZoneMap,
  PROPERTY_STATUS_LABELS,
  resolvePublicProperty,
  type Property,
} from "@/features/property";
import { applicationBlocker, getTenantApplicationTo } from "@/features/application";
import { PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { getSessionUser } from "@/shared/auth/session";
import { metadataOrigin } from "@/shared/lib/site-url";
import { JsonLd } from "@/shared/seo/json-ld";

type DetailProps = PageProps<"/inmuebles/[slug]">;

/**
 * The property behind a URL segment, for whoever is asking.
 *
 * Which URLs resolve to a listing — the slug, and the two older shapes still pasted in messages —
 * is `resolvePublicProperty`, in the property module: the Open Graph image beside this file needs
 * the same answer, and two copies of that rule is two chances for the card a shared link produces
 * to point at a page that no longer exists.
 *
 * What this adds is the reader: an owner may preview a listing that is not `available` yet.
 */
async function resolve(segment: string): Promise<{ property: Property; canonical: string } | null> {
  const viewer = await getSessionUser();

  return resolvePublicProperty(segment, viewer?.uid ?? null);
}

export async function generateMetadata(props: DetailProps): Promise<Metadata> {
  const { slug } = await props.params;
  const found = await resolve(slug);

  // Un anuncio que ya no existe no se indexa: sin esto, la página de "no encontrado" que Next
  // sirve con este `<title>` es una URL más que un buscador guarda y vuelve a visitar.
  if (!found) return { title: "Inmueble no disponible", robots: { index: false, follow: false } };

  const { property, canonical } = found;
  /*
   * **The title and the description are the domain's, not this page's.**
   *
   * Shared into WhatsApp or a Facebook group, the preview card *is* the listing — and what it
   * used to say was the landlord's own headline, which is "HERMOSO APTO REMODELADO 😍" as often as
   * not. `propertyMetaTitle` produces the fact sheet instead: what it is, where, and what it
   * costs, in the same shape for every listing so that six of them pasted into a group chat can
   * be compared. The `<h1>` on the page is still the landlord's words; this is the index card.
   *
   * The image is not listed here on purpose: `opengraph-image.tsx` sits beside this file and Next
   * wires it in, which is what keeps the shared card at a fixed 1200×630 instead of whatever
   * aspect ratio the first photo happened to have.
   */
  const title = propertyMetaTitle(property);
  const description = propertyMetaDescription(property);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { url: canonical, title, description },
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

  const origin = metadataOrigin();

  return (
    <article className="space-y-8">
      {/*
        El anuncio, para una máquina: qué es, dónde queda, cuánto cuesta y que es un arriendo.
        Ni la calle ni la coordenada exacta salen de aquí — ver `domain/seo.ts`, que es donde está
        escrito por qué, y `seo.test.ts`, que es lo que lo comprueba.
      */}
      <JsonLd data={propertyJsonLd(property, `${origin}${canonical}`)} />
      {/* Y el rastro hasta aquí: los mismos dos enlaces que la página ofrece de verdad. */}
      <JsonLd
        data={propertyBreadcrumbJsonLd(property, origin, PROPERTIES_ROUTE, canonical)}
      />

      {/*
        La vuelta al listado, arriba del todo y antes que nada, como en la página de un proceso.
        Es un enlace de verdad y no `history.back()`: a este anuncio se llega tanto desde el
        catálogo como desde un enlace pegado en WhatsApp, y un botón que en el segundo caso saca a
        la persona del sitio —o no hace nada— es peor que uno que siempre lleva al mismo sitio.

        Lo que sí se pierde así son los filtros que hubiera puestos: el catálogo guarda su estado
        entero en la URL, y esta no la lleva. Volver con el gesto del navegador sigue devolviendo la
        búsqueda tal cual estaba.
      */}
      <Link
        href={PROPERTIES_ROUTE}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Volver a los inmuebles
      </Link>

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
                <strong className="font-medium text-foreground">{location.line}</strong>
                {location.registryNumber ? (
                  <>
                    {" · matrícula "}
                    <strong className="font-medium text-foreground">
                      {location.registryNumber}
                    </strong>
                  </>
                ) : null}{" "}
                — solo lo ves tú. El inquilino recibe la dirección cuando apruebes su postulación.
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

          {/*
            The map, when the landlord placed a point. It is not a fallback for the sentence
            above and never replaces it: a listing with no point still says where it is, and a
            reader whose map fails to load reads the same thing. What the circle adds is the
            shape of the neighbourhood, which is the part words are bad at.

            `exact` only for the owner — the same rule as the street on this page, and it comes
            from `private/location`, which nobody else can read anyway.
          */}
          {property.area.approx && (
            <div className="pt-2">
              <PropertyZoneMap approx={property.area.approx} exact={location?.point ?? null} />
            </div>
          )}
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
  readonly state: "anonymous" | "own" | "open" | "rejected" | "can_apply";
  readonly applicationId?: string;
} {
  if (!viewerUid) return { state: "anonymous" };

  const blocker = applicationBlocker(property, viewerUid, existing as never);
  if (blocker === "own_property") return { state: "own" };
  if (blocker === "already_applied" && existing) {
    return { state: "open", applicationId: existing.id };
  }
  if (blocker === "rejected_before") {
    return { state: "rejected", applicationId: existing?.id };
  }

  return { state: "can_apply" };
}
