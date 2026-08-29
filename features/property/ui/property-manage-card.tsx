"use client";

import type { Dictionary } from "@/shared/i18n";
import type { PropertyLabels } from "../domain/labels";
import { useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { useRouter } from "next/navigation";
import { CheckIcon, LinkIcon, PencilIcon, QrCodeIcon, SendIcon, Trash2Icon, UserPlusIcon } from "lucide-react";

import {
  assignErrandRoute,
  editPropertyRoute,
  propertyDetailRoute,
  propertyPosterRoute,
} from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { deleteProperty, publishDraft } from "../actions/manage-property";
import { posterBlocker } from "../domain/poster";
import {
  propertyMonthlyCost,
  publicLocationLabel,
  publishBlocker,
  type Property,
} from "../domain/property";

/**
 * Cada acción de la tarjeta, con la frase que dice qué hace.
 *
 * **Cinco botones en una fila son cinco palabras sueltas**: "Aviso" no dice que produzca una hoja
 * para imprimir, y "Encargar" no dice que le vaya a escribir a alguien por WhatsApp. El peso visual
 * separa la importancia y **el tooltip separa el significado**, que es lo que de verdad hacía falta.
 *
 * `asChild` sobre el disparador: el botón sigue siendo el botón —o el enlace— y no queda envuelto en
 * un `<span>` que le rompa el foco ni el `<a>` de dentro.
 */
function ActionTip({ text, children }: { readonly text: string; readonly children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-56 text-balance">{text}</TooltipContent>
    </Tooltip>
  );
}

const STATUS_STYLES: Readonly<Record<Property["status"], string>> = {
  available: "bg-status-approved-bg text-status-approved",
  draft: "bg-muted text-muted-foreground",
  rented: "bg-status-current-bg text-status-current",
  inactive: "bg-muted text-muted-foreground",
};

/**
 * One listing in the landlord's own list, with what they can do to it.
 *
 * Copying the link is a first-class action rather than "open it and copy from the bar": sharing
 * the listing is the whole point of publishing it, and the URL is now short enough to be worth
 * handing over directly.
 */
export function PropertyManageCard({
  property,
  labels,
  copy,
}: {
  readonly property: Property;
  /**
   * The listing vocabulary, resolved by the page. A prop because this is a Client Component:
   * importing the dictionary here would put both languages in the browser bundle.
   */
  readonly labels: PropertyLabels;
  /**
   * The form's own words, resolved by the page. A prop and not a dictionary import: this is a
   * Client Component, and importing the dictionary here would put both languages in the bundle.
   */
  readonly copy: Dictionary["propertyForm"];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isPublishing, startPublish] = useTransition();

  const cover = property.photos[0];
  const path = propertyDetailRoute(property.slug);
  /*
   * The same function the Server Action calls before it writes. Two copies of "when may this be
   * published?" — one in the card and one in the endpoint — are two things that drift, and the
   * one that drifts first is the button, which then offers something the server refuses.
   */
  const blocker = publishBlocker(property);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(copy.copyLinkFailed);
    }
  }

  function publish() {
    startPublish(async () => {
      const result = await publishDraft(property.id);
      if (!result.ok) {
        setError(result.message ?? copy.publishDraftFailed);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteProperty(property.id);
      if (!result.ok) {
        setError(result.message ?? copy.deleteFailed);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row">
      <Link
        href={path}
        className="shrink-0 overflow-hidden rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            width={220}
            height={165}
            unoptimized
            className="aspect-4/3 w-full object-cover sm:w-40"
          />
        ) : (
          <span className="flex aspect-4/3 w-full items-center justify-center bg-muted text-xs text-muted-foreground sm:w-40">
            Sin fotos
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              STATUS_STYLES[property.status],
            )}
          >
            {labels.statuses[property.status]}
          </span>
          <span className="text-xs text-muted-foreground">
            {labels.types[property.type]}
          </span>
        </div>

        <h2 className="truncate font-semibold text-foreground">
          <Link href={path} className="hover:underline">
            {property.title}
          </Link>
        </h2>
        <p className="truncate text-sm text-muted-foreground">
          {publicLocationLabel(property.area)}
        </p>
        <p className="text-sm font-medium text-foreground">
          {formatCOP(propertyMonthlyCost(property))}
          <span className="font-normal text-muted-foreground"> al mes</span>
        </p>

        {/*
          Three different weights, because three identical buttons make the eye read them as one
          block and pick by position. Copying the link is the most used one, so it is the filled
          button of the card — but filled in soft purple, not the cyan CTA: the page has exactly
          one of those, "Publicar inmueble", and repeating that cyan once per card made the unique
          action the quietest thing on the screen. Editing stays the outlined secondary, and
          deleting recedes to a plain red word: a solid red button between two others invites the
          click it should discourage, and it asks for confirmation anyway.
        */}
        {/*
          Un solo `TooltipProvider` para la fila entera: envolver cada botón sería montar cinco
          proveedores por tarjeta y, en una lista de seis, treinta.
        */}
        <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {/*
            A draft gets "Publicar" where a listing gets "Copiar enlace", and the swap is not
            cosmetic on either side.

            Publishing is what the card is *for* while the listing is a draft, so it takes the one
            filled slot — the same reasoning that put the link there for a published listing, which
            is the thing you do most with one. Not `accent`: a list of drafts would then be a column
            of cyan buttons, which is the rule the catalogue's cards already follow.

            And the link **goes**, because on a draft it is a dead one. `getVisibleProperty` answers
            `null` to everybody but the owner, so a URL copied here 404s for whoever it is sent to —
            a button that hands over a broken link is worse than no button, and it is the "Continuar
            que no continúa" in another costume.
          */}
          {property.status === "draft" ? (
            <ActionTip
              text={
                blocker === null
                  ? "Lo pone en el catálogo público. A partir de ahí cualquiera puede verlo y postularse."
                  : "Necesita al menos una foto para poder publicarse."
              }
            >
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={blocker === null ? publish : undefined}
              /*
                `aria-disabled`, never `disabled`: a disabled button drops out of the tab order and
                stops firing hover, so the reason beneath it becomes unreachable for exactly the
                people who most need it read out. The click does nothing — a control announced as
                unavailable that turns out to act is its own kind of lie.
              */
              aria-disabled={blocker !== null || isPublishing}
              className={blocker !== null ? "opacity-60" : undefined}
            >
              <SendIcon aria-hidden="true" />
              {isPublishing ? copy.publishingDraft : copy.publishDraft}
            </Button>
            </ActionTip>
          ) : (
            <ActionTip text="Copia la dirección pública del anuncio para pegarla en un chat o en un grupo.">
              <Button type="button" variant="secondary" size="lg" onClick={copyLink}>
                {copied ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
                {copied ? copy.linkCopied : copy.copyLink}
              </Button>
            </ActionTip>
          )}
          {/*
            The rental notice — the listing as a sheet to print and a square to post.

            It appears **only while the listing is public**, decided by `posterBlocker`, the same
            function the screen and the image endpoint use. A notice is a QR code, and a QR code
            printed from a draft opens a 404 for everybody who scans it while still working for its
            owner: offering the button and then explaining that it cannot be used is the "Continuar
            que no continúa" one screen earlier. It sits beside "Copiar enlace" for the same
            reason — both are ways of handing this listing to somebody else.
          */}
          {posterBlocker(property) === null && (
            <ActionTip text="Genera un aviso con código QR: una hoja A4 para imprimir y un cuadrado para redes.">
              <Button asChild variant="soft" size="lg">
                <Link href={propertyPosterRoute(property.id)}>
                  <QrCodeIcon aria-hidden="true" />
                  {copy.notice}
                </Link>
              </Button>
            </ActionTip>
          )}
          <ActionTip text="Cambia el precio, las fotos, la dirección o la matrícula de este anuncio.">
            <Button asChild variant="outline" size="lg">
              <Link href={editPropertyRoute(property.id)}>
                <PencilIcon aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </ActionTip>
          {/*
            Handing a job on this flat to somebody else. It belongs here rather than in a section of
            its own for the same reason "Publicar" is not in the menu: you decide it while looking at
            the property that needs it, not by going somewhere to manage collaborators.

            **`brand` while "Editar" stays `outline`**, and the difference is deliberate rather than
            decorative: the two sat side by side in the same variant and read as one repeated button.
            What separates them is where they reach. Editing changes this listing and nothing else —
            routine, self-contained, undoable by editing again. Encargar leaves the product: it texts
            a real person, creates an account for them and commits them to a time. That is a control
            worth a beat of hesitation, which is exactly the level `brand` exists for.

            Not `accent`: a page of listings is a column of cards, and one cyan button per card is
            six calls to action competing with each other, which is none — the same rule the public
            catalogue follows with its single `outline` per card.
          */}
          <ActionTip text="Le pide a otra persona que muestre el inmueble. Le llega el encargo por WhatsApp y SMS.">
            <Button asChild variant="brand" size="lg">
              <Link href={assignErrandRoute(property.id)}>
                <UserPlusIcon aria-hidden="true" />
                Encargar
              </Link>
            </Button>
          </ActionTip>
          <ActionTip text="Retira el anuncio del catálogo y borra sus fotos. No se puede deshacer.">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setConfirming(true)}
              disabled={isDeleting}
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2Icon aria-hidden="true" />
              Eliminar
            </Button>
          </ActionTip>
        </div>
        </TooltipProvider>

        {/*
          Why the button will not act, said in the page rather than only on the control. What to do
          about it is already on the same row twice — "Editar" to upload them, "Encargar" to send
          somebody to take them — which is the whole point of a draft existing.
        */}
        {blocker === "no_photos" && (
          <p className="pt-1 text-sm text-muted-foreground">{copy.publishDraftNoPhotos}</p>
        )}

        {error && (
          <p role="alert" className="pt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.deleteTitle}
        description={
          <>
            {copy.deleteBefore} <strong className="text-foreground">{property.title}</strong>{" "}
            {copy.deleteAfter}
          </>
        }
        confirmLabel={copy.deleteConfirm}
        onConfirm={remove}
      />
    </li>
  );
}
