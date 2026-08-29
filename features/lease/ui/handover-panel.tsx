import Image from "next/image";
import { CheckCircle2Icon, ClipboardListIcon, MessageSquareWarningIcon } from "lucide-react";

import { formatBogotaDateTime } from "@/shared/format/date";
import { cn } from "@/shared/lib/utils";

import type { HandoverView } from "../data/handover";
import {
  AREA_CONDITION_LABELS,
  HANDOVER_KIND_LABELS,
  HANDOVER_STATE_LABELS,
  handoverAnchor,
  type AreaCondition,
  type Handover,
  type HandoverKind,
  type HandoverState,
} from "../domain/handover";
import { HandoverActions } from "./handover-actions";

/**
 * One acta de entrega, as both parties read it.
 *
 * A Server Component: everything on it comes from the record, and the only interactive part — the
 * editor and the tenant's answer — is a `"use client"` leaf underneath. The photos arrive with
 * links the server already signed, so the picture is the one thing here that can be missing while
 * everything else still renders: see `handoverView`.
 */

const CONDITION_STYLES: Readonly<Record<AreaCondition, string>> = {
  good: "bg-status-approved-bg text-status-approved",
  fair: "bg-muted text-muted-foreground",
  damaged: "bg-status-rejected-bg text-status-rejected",
};

/**
 * `accepted` is the only green one, and `disputed` is deliberately **not red**.
 *
 * An objection is not an error and not a rejection — it is the tenant using the one control the
 * acta gives them. Painting it as a failure would tell a landlord that their tenant did something
 * wrong by disagreeing about the state of a wall, which is the whole thing this record is for.
 */
const STATE_STYLES: Readonly<Record<HandoverState, string>> = {
  draft: "bg-muted text-muted-foreground",
  awaiting_tenant: "bg-status-pending-bg text-status-pending",
  disputed: "bg-status-current-bg text-status-current",
  accepted: "bg-status-approved-bg text-status-approved",
};

export function HandoverPanel({
  leaseId,
  kind,
  view,
  isLandlord,
  blocked,
  seed = [],
}: {
  readonly leaseId: string;
  readonly kind: HandoverKind;
  readonly view: HandoverView;
  readonly isLandlord: boolean;
  /** Set on the check-out while there is no check-in to compare it against. */
  readonly blocked: boolean;
  /**
   * The rooms a fresh acta starts with. On the **devolución** these are the check-in's, which is the
   * whole point of the format: an acta naming different rooms than the one it is read beside is an
   * acta that compares nothing.
   */
  readonly seed?: readonly string[];
}) {
  const { handover, state, links } = view;

  return (
    <section
      id={handoverAnchor(kind)}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <ClipboardListIcon className="size-4 text-brand-panel" aria-hidden="true" />
            Acta de {HANDOVER_KIND_LABELS[kind].toLowerCase()}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {kind === "checkin"
              ? "Cómo se entregó el inmueble, espacio por espacio."
              : "Cómo se devolvió, para compararlo con la entrega."}
          </p>
        </div>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATE_STYLES[state])}>
          {HANDOVER_STATE_LABELS[state]}
        </span>
      </div>

      {blocked ? (
        /*
          A checkout is a comparison, so there has to be something to compare against. Said here
          rather than by hiding the section: a landlord looking for where the devolución went would
          otherwise conclude the product does not have one.
        */
        <p className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Primero envía el acta de entrega. La devolución se lee al lado de ella, así que necesita
          algo contra qué compararse.
        </p>
      ) : (
        <>
          {handover && handover.areas.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {handover.areas.map((area) => (
                <li key={area.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-foreground">{area.name}</h3>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        CONDITION_STYLES[area.condition],
                      )}
                    >
                      {AREA_CONDITION_LABELS[area.condition]}
                    </span>
                  </div>
                  {area.note ? (
                    <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                      {area.note}
                    </p>
                  ) : null}
                  <Photos photos={area.photos} links={links} />
                </li>
              ))}
            </ul>
          ) : (
            /*
              Solo del lado del inquilino. El del propietario vive dentro de `HandoverActions`,
              porque es el único que sabe si el editor está abierto — y decir "todavía no hay
              espacios" encima de un editor con dos espacios escritos es contradecir la pantalla.
            */
            !isLandlord && (
              <p className="mt-4 text-sm text-muted-foreground">
                El propietario aún no ha preparado esta acta.
              </p>
            )
          )}

          {handover?.objection ? <Objection handover={handover} links={links} /> : null}
          {handover?.acceptance ? <Acceptance handover={handover} /> : null}

          <HandoverActions
            leaseId={leaseId}
            kind={kind}
            state={state}
            isLandlord={isLandlord}
            areas={handover?.areas ?? []}
            seed={seed}
          />
        </>
      )}
    </section>
  );
}

/**
 * The pictures of one area.
 *
 * A photo whose link could not be signed is **left out** rather than rendered as a broken frame:
 * `handoverView` returns the paths it managed to sign, and the record itself — the name, the
 * condition, the note — comes from the document either way.
 */
function Photos({
  photos,
  links,
}: {
  readonly photos: readonly { readonly path: string; readonly fileName: string }[];
  readonly links: Readonly<Record<string, string>>;
}) {
  const signed = photos.filter((photo) => links[photo.path]);
  if (signed.length === 0) return null;

  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {signed.map((photo) => (
        <li key={photo.path} className="overflow-hidden rounded-lg border border-border">
          <a
            href={links[photo.path]}
            target="_blank"
            rel="noopener noreferrer"
            className="block focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {/*
              `unoptimized`, like every other photo behind a signed URL in this product: the
              optimiser would have to be handed a host that rotates, and the link expires in an hour
              anyway.
            */}
            <Image
              src={links[photo.path] ?? ""}
              alt={photo.fileName}
              width={320}
              height={240}
              unoptimized
              className="aspect-4/3 w-full bg-muted object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** What the tenant said does not match, kept on the record whether or not it was resolved. */
function Objection({
  handover,
  links,
}: {
  readonly handover: Handover;
  readonly links: Readonly<Record<string, string>>;
}) {
  const objection = handover.objection;
  if (!objection) return null;

  /*
   * An objection about a version that no longer exists still shows, and says so. Hiding it once the
   * landlord revised would erase half of what the acta is *for*: the record that the two of them
   * disagreed, and what about.
   */
  const stale = objection.fingerprint !== handover.fingerprint;

  return (
    <div className="mt-4 rounded-xl border border-brand-panel/30 bg-secondary p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-brand-panel">
        <MessageSquareWarningIcon className="size-4" aria-hidden="true" />
        Observaciones del inquilino
        <span className="font-normal text-muted-foreground">
          · {formatBogotaDateTime(objection.at)}
        </span>
      </h3>
      <p className="mt-2 text-sm whitespace-pre-line text-secondary-foreground">{objection.note}</p>
      {stale ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Se escribieron sobre una versión anterior del acta, que ya fue corregida.
        </p>
      ) : null}
      <Photos photos={objection.photos} links={links} />
    </div>
  );
}

/**
 * The record of the acceptance: when, and from where.
 *
 * The ip and the user agent are shown to **both** parties rather than kept in the database, for the
 * reason the signature log already gives: evidence nobody can read is evidence that has to be
 * exported by hand the day it matters.
 */
function Acceptance({ handover }: { readonly handover: Handover }) {
  const acceptance = handover.acceptance;
  if (!acceptance) return null;

  const stale = acceptance.fingerprint !== handover.fingerprint;

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2Icon className="size-4 text-status-approved" aria-hidden="true" />
        {stale ? "Aceptada sobre una versión anterior" : "Aceptada por el inquilino"}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatBogotaDateTime(acceptance.at)}
        {acceptance.ip ? ` · desde ${acceptance.ip}` : ""}
      </p>
      {stale ? (
        <p className="mt-2 text-xs text-muted-foreground">
          El acta cambió después de esa aceptación, así que vuelve a estar pendiente de revisión.
        </p>
      ) : null}
    </div>
  );
}
