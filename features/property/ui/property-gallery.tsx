"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/shared/lib/utils";

import type { PropertyPhoto } from "../domain/property";

/**
 * The listing's photos: one large frame plus a strip of thumbnails that swap it.
 *
 * No lightbox and no carousel on purpose. A tenant deciding whether to apply looks at four or
 * five photos, and the cheapest interaction that serves that is clicking a thumbnail. A modal
 * gallery is a feature of its own, with focus trapping and keyboard handling to get right.
 */
export function PropertyGallery({
  photos,
  title,
}: {
  readonly photos: readonly PropertyPhoto[];
  readonly title: string;
}) {
  const [current, setCurrent] = useState(0);
  const active = photos[current] ?? photos[0];

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
        <Image
          src={active.url}
          alt={`${title} — foto ${current + 1} de ${photos.length}`}
          width={1200}
          height={800}
          priority
          unoptimized
          className="aspect-4/3 w-full object-cover sm:aspect-16/10"
        />
        {photos.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-md bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs">
            {current + 1} / {photos.length}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.path}>
              <button
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Ver la foto ${index + 1}`}
                aria-current={index === current}
                className={cn(
                  "block w-full overflow-hidden rounded-lg border-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  index === current ? "border-accent" : "border-transparent hover:border-border",
                )}
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
    </div>
  );
}
