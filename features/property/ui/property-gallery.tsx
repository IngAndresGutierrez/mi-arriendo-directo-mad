"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

import type { PropertyPhoto } from "../domain/property";

/**
 * The listing's photos: a cover, a strip of thumbnails, and a full-screen slider that any of
 * them opens.
 *
 * The slider is a Radix dialog rather than hand-rolled markup — focus trapping, Escape, the
 * scroll lock and returning focus to whatever opened it are exactly the parts that get skipped
 * when a lightbox is written from scratch. What is added on top is the navigation: arrows,
 * left/right keys, and a thumbnail strip, because a listing with twenty photos is unusable if
 * reaching the last one takes nineteen clicks.
 */
export function PropertyGallery({
  photos,
  title,
}: {
  readonly photos: readonly PropertyPhoto[];
  readonly title: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const isOpen = openAt !== null;
  // The dialog is opened from state, not from a DialogTrigger, so Radix has no trigger to
  // hand focus back to and drops it on <body>. Keyboard users would lose their place, so the
  // opener is remembered and refocused on close.
  const opener = useRef<HTMLButtonElement | null>(null);
  const total = photos.length;

  const go = useCallback(
    (delta: number) => {
      setOpenAt((current) => (current === null ? current : (current + delta + total) % total));
    },
    [total],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    // On the document: the focused element inside the dialog changes as the user tabs, and the
    // arrows should work wherever they are.
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, go]);

  const cover = photos[0];
  if (!cover) return null;

  const active = openAt === null ? cover : (photos[openAt] ?? cover);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={(event) => {
          opener.current = event.currentTarget;
          setOpenAt(0);
        }}
        aria-label={`Ver las ${total} fotos de ${title}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Image
          src={cover.url}
          alt={`${title} — foto 1 de ${total}`}
          width={1200}
          height={800}
          priority
          unoptimized
          className="aspect-4/3 w-full object-cover sm:aspect-16/10"
        />
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors group-hover:bg-background">
          <ExpandIcon className="size-3.5" aria-hidden="true" />
          {total === 1 ? "Ver la foto" : `Ver las ${total} fotos`}
        </span>
      </button>

      {total > 1 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.path}>
              <button
                type="button"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setOpenAt(index);
                }}
                aria-label={`Ver la foto ${index + 1} de ${total}`}
                className="block w-full cursor-zoom-in overflow-hidden rounded-lg border-2 border-transparent transition-colors hover:border-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Image
                  src={photo.url}
                  alt=""
                  width={200}
                  height={150}
                  unoptimized
                  className="aspect-4/3 w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={isOpen} onOpenChange={(next) => setOpenAt(next ? 0 : null)}>
        <DialogContent
          className="flex h-svh max-h-none w-screen max-w-none flex-col gap-3 rounded-none bg-background p-4 sm:h-[92svh] sm:max-h-none sm:w-[min(96vw,1400px)] sm:max-w-none sm:rounded-2xl"
          overlayClassName="bg-foreground/80"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Fotos de {title}</DialogTitle>

          {/*
            Fixed-height stage, `object-contain` inside it. Photos come in every aspect ratio a
            phone can produce, and sizing the frame to each one made the whole dialog — arrows,
            counter, thumbnails — jump on every change.
          */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <Image
              key={active.path}
              src={active.url}
              alt={`${title} — foto ${(openAt ?? 0) + 1} de ${total}`}
              width={1600}
              height={1200}
              unoptimized
              className="h-full w-full object-contain"
            />

            {total > 1 && (
              <>
                <SliderButton side="left" onClick={() => go(-1)} label="Foto anterior" />
                <SliderButton side="right" onClick={() => go(1)} label="Foto siguiente" />
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3">
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {(openAt ?? 0) + 1} de {total}
            </p>

            {total > 1 && (
              <ul className="flex justify-center gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <li key={photo.path} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenAt(index)}
                      aria-label={`Ir a la foto ${index + 1}`}
                      aria-current={index === openAt}
                      className={cn(
                        "block overflow-hidden rounded-md border-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        index === openAt ? "border-accent" : "border-transparent opacity-60 hover:opacity-100",
                      )}
                    >
                      <Image
                        src={photo.url}
                        alt=""
                        width={96}
                        height={72}
                        unoptimized
                        className="h-14 w-20 object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Big, always-visible arrows: on a phone a hover-only control is a control that does not exist. */
function SliderButton({
  side,
  onClick,
  label,
}: {
  readonly side: "left" | "right";
  readonly onClick: () => void;
  readonly label: string;
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-xs ring-1 ring-border transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
