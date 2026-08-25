import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ErrandForm } from "@/features/collaboration";
import { requireCompleteProfile } from "@/features/profile";
import { getOwnedProperty } from "@/features/property";

export const metadata: Metadata = {
  title: "Encargar algo",
};

/**
 * Where a landlord hands a job to somebody else.
 *
 * **It hangs off the property, not off a collaborators section**, because that is how the decision
 * actually happens: you are looking at a flat that needs photos, or a viewing you cannot attend, and
 * the errand is about *that*. The same reasoning that keeps "Publicar" out of the menu — publishing
 * is something you do to your properties, not a separate place.
 *
 * `getOwnedProperty` is the authorization and it runs before anything renders: a landlord who is not
 * the owner gets the same 404 as a property that does not exist. The Server Action checks it again
 * against the real document, because a page guard protects the screen and not the endpoint.
 */
export default async function AssignErrandPage(props: PageProps<"/mis-inmuebles/[id]/encargar">) {
  const user = await requireCompleteProfile();
  const { id } = await props.params;

  const property = await getOwnedProperty(id, user.uid);
  if (!property) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        Encargar algo de este inmueble
      </h1>

      <div className="mt-4">
        <ErrandForm propertyId={property.id} propertyTitle={property.title} />
      </div>
    </div>
  );
}
