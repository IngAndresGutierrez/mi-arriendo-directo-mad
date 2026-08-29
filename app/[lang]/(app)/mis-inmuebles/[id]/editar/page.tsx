import { propertyLabels } from "@/features/property";
import { currentLocale, dictionary } from "@/shared/i18n/server";
import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { requireCompleteProfile } from "@/features/profile";
import { getOwnedProperty, getPropertyLocation, PropertyForm } from "@/features/property";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";

export const metadata: Metadata = {
  title: "Editar inmueble",
};

/*
 * **Sin panel de verificación de propietario, a propósito y por ahora.** El dominio, la acción, las
 * reglas y la cola de `/verificaciones` siguen en pie y probados; lo único que se retiró es el punto
 * de entrada desde este formulario, que es lo que hace que nadie pueda pedirla todavía. Volver a
 * enseñarla es renderizar `VerificationPanel` aquí de nuevo — vive en `@/features/property` con
 * `getVerification`, `verificationState` y `verificationBlocker`.
 */
export default async function EditPropertyPage(props: PageProps<"/[lang]/mis-inmuebles/[id]/editar">) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  // Ownership is decided by the read, not by the URL: a stranger gets the same answer as
  // someone asking for a property that does not exist.
  const property = await getOwnedProperty(id, user.uid);
  if (!property) notFound();

  const location = await getPropertyLocation(id, user.uid);

  return (
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

      <PropertyForm
        labels={propertyLabels(await currentLocale())}
        copy={(await dictionary()).propertyForm}
        property={property}
        addressLine={location?.line ?? ""}
        registryNumber={location?.registryNumber ?? ""}
        // From `private/location`, which only the owner can read — and this page is only ever
        // rendered for them.
        mapPoint={location?.point ?? null}
      />
    </div>
  );
}
