import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import {
  applicationBlocker,
  getTenantApplicationTo,
  ApplicationForm,
} from "@/features/application";
import { requireCompleteProfile } from "@/features/profile";
import {
  getVisiblePropertyBySlug,
  propertyMonthlyCost,
  publicLocationLabel,
} from "@/features/property";
import { getTenantProfile } from "@/features/tenant-profile";
import { applicationRoute, propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";

export const metadata: Metadata = {
  title: "Postularme",
  /*
   * No `robots` here on purpose: the `(app)` layout says `noindex, nofollow` for the whole group.
   * This page used to carry `{ index: false }` of its own, and metadata is merged **per field** —
   * so its own object replaced the layout's whole one and quietly dropped the `nofollow`, which is
   * how a page meant to be more careful than the rest ended up being less. One place says it now.
   */
};

export default async function ApplyPage(props: PageProps<"/postularme/[slug]">) {
  const { slug } = await props.params;
  const user = await requireCompleteProfile();

  const property = await getVisiblePropertyBySlug(slug, user.uid);
  if (!property) notFound();

  const existing = await getTenantApplicationTo(property.id, user.uid);
  const blocker = applicationBlocker(property, user.uid, existing);

  /*
   * A process this reader is already part of — open, or closed by a rejection — sends them to
   * it rather than to a form. Bouncing them back to the listing with no explanation is how the
   * first version of this behaved, and it read like the button was broken.
   */
  if (existing && (blocker === "already_applied" || blocker === "rejected_before")) {
    redirect(applicationRoute(existing.id));
  }
  if (blocker) redirect(propertyDetailRoute(property.slug));

  const profile = await getTenantProfile(user.uid);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={propertyDetailRoute(property.slug)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Volver al inmueble
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        Postúlate a {property.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {publicLocationLabel(property.area)} · {formatCOP(propertyMonthlyCost(property))} al mes
      </p>

      <p className="mt-6 mb-8 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        {profile
          ? "Tus datos ya están aquí, de tu perfil de inquilino. Revísalos y cambia lo que haga falta antes de enviar."
          : "Llénalo una sola vez: estos datos quedan en tu perfil de inquilino y la próxima postulación empieza contestada."}
      </p>

      <ApplicationForm
        slug={property.slug}
        profile={profile}
        minLeaseMonths={property.minLeaseMonths}
      />
    </div>
  );
}
