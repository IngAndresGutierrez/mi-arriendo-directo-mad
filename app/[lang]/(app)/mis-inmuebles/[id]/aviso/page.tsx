import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";

import { requireCompleteProfile } from "@/features/profile";
import {
  getOwnedProperty,
  posterBlocker,
  posterContent,
  PosterActions,
  propertyLabels,
} from "@/features/property";
import { MY_PROPERTIES_ROUTE } from "@/shared/auth/routes";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { currentLocale, dictionary } from "@/shared/i18n/server";
import { OG_COP } from "@/shared/brand/og";
import { metadataOrigin } from "@/shared/lib/site-url";
import { Button } from "@/shared/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const copy = (await dictionary()).poster;

  return { title: copy.title, description: copy.meta };
}

/**
 * Where a landlord makes the notice for one of their listings.
 *
 * It hangs off the property rather than living in a section of its own — the same reasoning that
 * keeps "Publicar" out of the menu and puts "Encargar" under `/mis-inmuebles/<id>`: making a notice
 * is something you do *to* a listing, and the decision happens while looking at that listing.
 *
 * **A blocked listing is answered here, not with a 404.** The image endpoint does answer 404,
 * because an endpoint has nothing to explain to; this screen belongs to the person who owns the
 * listing, and "publícalo primero" is the one thing they need to know. Sending them to a
 * not-found page for a property they can see two clicks away would be telling them something
 * untrue about their own listing.
 */
export default async function RentalNoticePage(
  props: PageProps<"/[lang]/mis-inmuebles/[id]/aviso">,
) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  // Ownership is decided by the read, not by the URL: a stranger gets the same answer as somebody
  // asking about a listing that does not exist.
  const property = await getOwnedProperty(id, user.uid);
  if (!property) notFound();

  const copy = (await dictionary()).poster;
  const locale = await currentLocale();
  const blocker = posterBlocker(property);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={MY_PROPERTIES_ROUTE}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {copy.backToProperties}
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        {copy.title}
      </h1>
      <p className="mt-1 truncate text-sm text-muted-foreground">{property.title}</p>

      {blocker ? (
        /*
          The listing has no public page, so its code would open a 404 for everybody who scanned it
          — and its owner would never find out, because for them the link works. Stated with the
          reason and the way out, in `brand` rather than in red: a draft is not a mistake, it is a
          step that has not happened yet.
        */
        <div className="mt-8 rounded-2xl border border-brand-panel/30 bg-secondary p-6">
          <h2 className="font-semibold text-brand-panel">
            {blocker === "draft" ? copy.blockedDraftTitle : copy.blockedUnavailableTitle}
          </h2>
          <p className="mt-2 text-sm text-secondary-foreground">
            {blocker === "draft" ? copy.blockedDraft : copy.blockedUnavailable}
          </p>
          <Button asChild variant="brand" size="xl" className="mt-5">
            <Link href={MY_PROPERTIES_ROUTE}>{copy.goToProperties}</Link>
          </Button>
        </div>
      ) : (
        <>
          {/*
            The privacy statement is on the screen and not in a tooltip, because it is the thing a
            landlord would otherwise go looking for — "¿esto lleva mi dirección?" — and because it
            is the reason the notice is shaped the way it is. Same call as the note beside the
            guarantee switch.
          */}
          <p className="mt-4 mb-8 flex gap-2 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{copy.lead}</span>
          </p>

          <PosterActions
            propertyId={property.id}
            slug={property.slug}
            /*
              The caption comes from the same `posterContent` the image route calls, with the same
              canonical origin — so the link on the square, the link in the code on the printed
              sheet and the link in the text a landlord pastes are one value, not three.
            */
            shareText={
              posterContent(property, {
                locale,
                labels: propertyLabels(locale),
                origin: metadataOrigin(),
                money: OG_COP,
              }).shareText
            }
            copy={copy}
          />
        </>
      )}
    </div>
  );
}
