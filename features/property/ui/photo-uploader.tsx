"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlusIcon, StarIcon, Trash2Icon } from "lucide-react";

import { auth } from "@/shared/firebase/auth";
import { storage } from "@/shared/firebase/storage";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import { PHOTOS_MAX, type PropertyPhoto } from "../domain/property";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

type PhotoUploaderProps = {
  readonly photos: readonly PropertyPhoto[];
  readonly onChange: (photos: readonly PropertyPhoto[]) => void;
  /** Form-level error for the field, already resolved by the caller. */
  readonly error?: string;
};

/**
 * Uploads the listing photos straight from the browser to Cloud Storage.
 *
 * They go into `properties/{uid}/…` — the landlord's own folder — because the property has no
 * id yet while the form is being filled. The Storage rules are keyed by that uid, and the
 * Server Action rejects any path that does not start with it.
 *
 * The first photo is the cover: it is what the catalog card shows, so it is reorderable rather
 * than a separate field the landlord has to think about.
 */
export function PhotoUploader({ photos, onChange, error }: PhotoUploaderProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function onPick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];
    setLocalError(null);

    const room = PHOTOS_MAX - photos.length;
    if (files.length > room) {
      setLocalError(`Puedes subir ${PHOTOS_MAX} fotos como máximo.`);
      return;
    }
    const rejected = files.find((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES);
    if (rejected) {
      setLocalError("Solo JPG, PNG o WEBP, y hasta 8 MB por foto.");
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLocalError("Tu sesión expiró. Vuelve a iniciar sesión para subir fotos.");
      return;
    }

    startUpload(async () => {
      try {
        const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const path = `properties/${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "")}`;
            const target = ref(storage, path);
            await uploadBytes(target, file, { contentType: file.type });
            return { path, url: await getDownloadURL(target) };
          }),
        );
        onChange([...photos, ...uploaded]);
      } catch {
        setLocalError("No pudimos subir las fotos. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove(path: string) {
    onChange(photos.filter((photo) => photo.path !== path));
  }

  function makeCover(path: string) {
    const chosen = photos.find((photo) => photo.path === path);
    if (!chosen) return;
    onChange([chosen, ...photos.filter((photo) => photo.path !== path)]);
  }

  const message = localError ?? error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Fotos del inmueble</span>
        <span className="text-xs text-muted-foreground">
          {photos.length} de {PHOTOS_MAX}
        </span>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.path} className="group relative overflow-hidden rounded-xl border border-border">
              <Image
                src={photo.url}
                alt={index === 0 ? "Foto de portada" : `Foto ${index + 1}`}
                width={400}
                height={300}
                className="aspect-4/3 w-full object-cover"
                unoptimized
              />
              {index === 0 && (
                <span className="absolute top-2 left-2 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  Portada
                </span>
              )}
              <div className="absolute right-2 bottom-2 flex gap-1">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(photo.path)}
                    aria-label={`Usar la foto ${index + 1} como portada`}
                    className="rounded-md bg-background/90 p-1.5 text-foreground shadow-xs transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <StarIcon className="size-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo.path)}
                  aria-label={`Quitar la foto ${index + 1}`}
                  className="rounded-md bg-background/90 p-1.5 text-destructive shadow-xs transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-destructive/40 focus-visible:outline-none"
                >
                  <Trash2Icon className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        aria-describedby={message ? errorId : undefined}
        onChange={(event) => onPick(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isUploading || photos.length >= PHOTOS_MAX}
        onClick={() => inputRef.current?.click()}
        className={cn("w-full border-dashed", photos.length === 0 && "h-24")}
      >
        <ImagePlusIcon aria-hidden="true" />
        {isUploading ? "Subiendo…" : photos.length === 0 ? "Agregar fotos" : "Agregar más fotos"}
      </Button>

      <p className="text-xs text-muted-foreground">
        La primera foto es la portada. JPG, PNG o WEBP, hasta 8 MB cada una.
      </p>

      {message && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
