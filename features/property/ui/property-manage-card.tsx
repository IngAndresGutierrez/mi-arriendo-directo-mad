"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, LinkIcon, PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react";

import { assignErrandRoute, editPropertyRoute, propertyDetailRoute } from "@/shared/auth/routes";
import { formatCOP } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { cn } from "@/shared/lib/utils";

import { deleteProperty } from "../actions/manage-property";
import {
  propertyMonthlyCost,
  publicLocationLabel,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "../domain/property";

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
export function PropertyManageCard({ property }: { readonly property: Property }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const cover = property.photos[0];
  const path = propertyDetailRoute(property.slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Tu navegador no nos dejó copiar el enlace. Ábrelo y cópialo desde la barra.");
    }
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteProperty(property.id);
      if (!result.ok) {
        setError(result.message ?? "No pudimos eliminar el inmueble.");
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
            {PROPERTY_STATUS_LABELS[property.status]}
          </span>
          <span className="text-xs text-muted-foreground">
            {PROPERTY_TYPE_LABELS[property.type]}
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
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="secondary" size="lg" onClick={copyLink}>
            {copied ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={editPropertyRoute(property.id)}>
              <PencilIcon aria-hidden="true" />
              Editar
            </Link>
          </Button>
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
          <Button asChild variant="brand" size="lg">
            <Link href={assignErrandRoute(property.id)}>
              <UserPlusIcon aria-hidden="true" />
              Encargar
            </Link>
          </Button>
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
        </div>

        {error && (
          <p role="alert" className="pt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Eliminar este inmueble?"
        description={
          <>
            Se elimina <strong className="text-foreground">{property.title}</strong> con sus fotos
            y su enlace deja de funcionar. No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar inmueble"
        onConfirm={remove}
      />
    </li>
  );
}
