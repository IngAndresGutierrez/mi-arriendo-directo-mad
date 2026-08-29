"use client";

/**
 * Picking files in the browser and pushing them straight to Cloud Storage.
 *
 * **Extracted from `incident-list.tsx` rather than copied into the acta**, because what is in here
 * is not boilerplate: it is two bugs already paid for. The `blob:` URLs are revoked **only on
 * unmount** — the first version had `[picked]` as the effect's dependency, which revoked the preview
 * of the first file the moment a second was added, and no driver saw it because a driver picks both
 * at once. And the files are **held, not uploaded on pick**, because these buckets deny `delete` to
 * every client: a file uploaded on pick and then dropped from the form would sit there for ever with
 * nothing referring to it.
 *
 * The four things that differ per form — the ceiling, the judgement, the folder and the wording when
 * somebody picks too many — are arguments. Everything that was worth learning is shared.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureClientSession } from "@/shared/auth/client";
import { storage } from "@/shared/firebase/storage";
import { storageErrorMessage } from "@/shared/firebase/storage-errors";

/** A file the person picked but has not sent yet, with a preview made in the browser. */
export type Picked = {
  readonly file: File;
  /** `URL.createObjectURL` — revoked when the pick is dropped or the form goes away. */
  readonly preview: string;
};

/** What the server records about a file, once it is in the bucket. */
export type UploadedFile = {
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  readonly uploadedAt: string;
};

/**
 * Files held in the browser until the form is sent.
 *
 * **Held, not uploaded on pick**, and the reason is a rule rather than a preference: `incidents/**`
 * denies `delete` to every client — the other party reads this record, and somebody who could delete
 * the file would leave it pointing at nothing — so a file uploaded on pick and then removed from the
 * form would sit in the bucket for ever with nothing referring to it. Holding them means dropping a
 * pick costs nothing and the preview is instant, because it never leaves the machine.
 *
 * The upload has to go through the web SDK either way: a Server Action's body is capped at 1 MB and
 * this accepts a 50 MB video.
 */
export function usePickedFiles({
  max,
  problemOf,
  folderOf,
  tooMany,
}: {
  /** How many files this form accepts in total. */
  readonly max: number;
  /** The same judgement the server makes: the picker and the action share the function. */
  readonly problemOf: (file: { readonly type: string; readonly size: number }) => string | null;
  /** Where in Cloud Storage this uploader's files go, keyed by the uploader's own uid. */
  readonly folderOf: (uid: string) => string;
  /** What to say when the pick would go over `max`. Wording differs per form. */
  readonly tooMany: (room: number) => string;
}) {
  const [picked, setPicked] = useState<readonly Picked[]>([]);

  /*
   * Las URLs `blob:` se revocan **solo al desmontar**, y por eso hacen falta la `ref` y el array de
   * dependencias vacío.
   *
   * La primera versión tenía `[picked]` como dependencia, que es la trampa: al añadir un segundo
   * archivo React ejecuta la limpieza del render anterior — con el array viejo — y revocaba la vista
   * previa del primero, que sigue en pantalla. No se vio porque el driver elige los dos ficheros de
   * una vez, así que `picked` pasaba de `[]` a `[A, B]` en un solo paso y la limpieza no tenía nada
   * que revocar. Una persona eligiendo uno y luego otro sí lo habría visto.
   */
  const current = useRef<readonly Picked[]>([]);
  // La `ref` se escribe en un efecto, no en el render: leer o escribir `current` mientras se renderiza
  // es lo que prohíbe `react-hooks/refs`, y con razón — un valor que el render usa no es una `ref`.
  useEffect(() => {
    current.current = picked;
  }, [picked]);
  useEffect(
    () => () => {
      for (const one of current.current) URL.revokeObjectURL(one.preview);
    },
    [],
  );

  const pick = useCallback(
    (files: FileList | null): string | null => {
      if (!files || files.length === 0) return null;

      const chosen = [...files];
      const room = max - picked.length;
      if (chosen.length > room) return tooMany(room);

      // El mismo juicio que hace el servidor: el picker y la acción comparten la función.
      const problem = chosen.map((file) => problemOf(file)).find(Boolean);
      if (problem) return problem;

      setPicked([...picked, ...chosen.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);

      return null;
    },
    [picked, max, problemOf, tooMany],
  );

  const drop = useCallback((target: Picked) => {
    URL.revokeObjectURL(target.preview);
    setPicked((all) => all.filter((one) => one !== target));
  }, []);

  const clear = useCallback(() => {
    for (const one of current.current) URL.revokeObjectURL(one.preview);
    setPicked([]);
  }, []);

  /**
   * Straight to Cloud Storage, one at a time, reporting which one is going up.
   *
   * Sequential rather than parallel on purpose: five 50 MB videos at once on a phone connection is
   * five uploads that all crawl, and there would be no honest way to say how far along it is.
   */
  const uploadAll = useCallback(
    async (onProgress: (done: number, total: number) => void): Promise<UploadedFile[]> => {
      if (picked.length === 0) return [];

      // El SDK web tiene su propia sesión y puede tardar un instante tras cargar la página: nunca se
      // lee `auth.currentUser` para decidir si alguien está dentro.
      const user = await ensureClientSession();
      if (!user) throw new Error("no-session");

      const { ref, uploadBytes } = await import("firebase/storage");
      const uploaded: UploadedFile[] = [];

      for (const [index, one] of picked.entries()) {
        onProgress(index, picked.length);
        const safeName = one.file.name.replace(/[^\w.-]/g, "-").slice(-80) || "archivo";
        const path = `${folderOf(user.uid)}${crypto.randomUUID()}-${safeName}`;
        await uploadBytes(ref(storage, path), one.file, { contentType: one.file.type });

        uploaded.push({
          path,
          fileName: one.file.name.slice(-120),
          contentType: one.file.type,
          bytes: one.file.size,
          // El servidor lo reescribe con su propio reloj: el del navegador no es de fiar.
          uploadedAt: new Date().toISOString(),
        });
      }
      onProgress(picked.length, picked.length);

      return uploaded;
    },
    [picked, folderOf],
  );

  return { picked, pick, drop, clear, uploadAll };
}

/**
 * What to say when an upload throws.
 *
 * The session case is called out separately because it is the one with an action attached: every
 * other Storage failure is "try again", and this one is "sign in again". `ensureClientSession`
 * answers `null` when the web SDK's own session is gone — which is a different session from the
 * httpOnly cookie the server reads, and can die on its own.
 */
export function uploadError(thrown: unknown): string {
  return thrown instanceof Error && thrown.message === "no-session"
    ? "Tu sesión expiró. Vuelve a iniciar sesión para adjuntar los archivos."
    : storageErrorMessage(thrown);
}
