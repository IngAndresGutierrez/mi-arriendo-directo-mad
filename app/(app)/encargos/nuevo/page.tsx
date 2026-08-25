import type { Metadata } from "next";
import Link from "next/link";
import { HouseIcon } from "lucide-react";

import { ErrandForm } from "@/features/collaboration";
import { requireCompleteProfile } from "@/features/profile";
import { listLandlordProperties } from "@/features/property";
import { PUBLISH_PROPERTY_ROUTE } from "@/shared/auth/routes";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = {
  title: "Nuevo encargo",
};

/**
 * Creating an errand without starting from a property.
 *
 * **The second door to the same form.** From a listing's card the property is already decided and
 * the form takes it as given; from here nothing is known, so it opens with a picker. Both post to
 * `createErrand`, which re-checks ownership against the real document either way — a page guard
 * protects the screen, not the endpoint, and this one accepts a `propertyId` the client chose.
 *
 * **Somebody with no listings gets told, not given an empty select.** A dropdown with nothing in it
 * is a form that cannot be completed and does not say why; the honest answer is that there is
 * nothing to delegate yet, and the way out is publishing.
 */
export default async function NewErrandPage() {
  const user = await requireCompleteProfile();
  const properties = await listLandlordProperties(user.uid);

  if (properties.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
          Nuevo encargo
        </h1>
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <HouseIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Un encargo es siempre sobre un inmueble, y todavía no tienes ninguno publicado.
          </p>
          <Button asChild variant="accent" size="xl">
            <Link href={PUBLISH_PROPERTY_ROUTE}>Publicar un inmueble</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        Nuevo encargo
      </h1>

      <div className="mt-4">
        <ErrandForm
          /*
           * Empty, so the select starts unchosen: pre-filling it with the first listing would be the
           * product deciding which flat this is about, and the one mistake that cannot be undone
           * here is sending somebody to the wrong address.
           */
          propertyId=""
          propertyTitle=""
          properties={properties.map((property) => ({ id: property.id, title: property.title }))}
        />
      </div>
    </div>
  );
}
