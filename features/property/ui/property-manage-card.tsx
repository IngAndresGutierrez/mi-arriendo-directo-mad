"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { editPropertyRoute, propertyDetailRoute } from "@/shared/auth/routes";
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

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" size="lg" onClick={copyLink}>
            {copied ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={editPropertyRoute(property.id)}>
              <PencilIcon aria-hidden="true" />
              Editar
            </Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => setConfirming(true)}
            disabled={isDeleting}
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
