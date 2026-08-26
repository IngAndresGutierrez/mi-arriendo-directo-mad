"use client";

import type { Dictionary } from "@/shared/i18n";
import { useId, useRef, useState } from "react";
import { FilmIcon, Loader2Icon, Trash2Icon } from "lucide-react";

import { ensureClientSession } from "@/shared/auth/client";
import { storage } from "@/shared/firebase/storage";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

import { acceptedVideo, PROPERTY_VIDEO_TYPES, type PropertyVideo } from "../domain/property";

type VideoUploaderProps = {
  readonly video: PropertyVideo | null;
  readonly onChange: (video: PropertyVideo | null) => void;
  /** Form-level error for the field, already resolved by the caller. */
  readonly error?: string;
  /** Editing: the video is already on a published listing, so removing it asks first. */
  readonly confirmBeforeRemove?: boolean;
  /**
   * Its words, resolved by the page that mounts the form. A prop and not a dictionary import: this
   * is a Client Component, and importing the dictionary would put both languages in the bundle.
   */
  readonly copy: Dictionary["propertyForm"];
};

/**
 * Uploads the listing's walkthrough video straight from the browser to Cloud Storage.
 *
 * The same route the photos take — `properties/{uid}/…`, the landlord's own folder, because the
 * property has no id while the form is being filled — and the same two gates behind it: the
 * Storage rules are keyed by that uid, and the Server Action refuses any path that does not start
 * with it.
 *
 * **One video, so picking a second one replaces the first.** There is no gallery to manage and no
 * cover to choose: a place has one walkthrough. That also makes the control a pair of buttons
 * instead of a grid, which is the whole reason this is not a `multiple` on `PhotoUploader`.
 *
 * Two things it does that the photo uploader deliberately does not:
 *
 * - **It reports progress**, through `uploadBytesResumable` rather than `uploadBytes`. A photo is
 *   capped at 8 MB and a spinner covers it; a 50 MB upload on a Colombian mobile connection is
 *   long enough that a spinner with no number reads as a page that has hung, and the landlord's
 *   next move is to press the button again.
 * - **It previews with a real `<video controls>`**, not a thumbnail. There is no transcoding step
 *   in this product and therefore no generated poster frame, so the only way to answer "is this
 *   the right file, the right way up?" is to let them play it before they publish it.
 */
export function VideoUploader({
  video,
  onChange,
  error,
  confirmBeforeRemove = false,
  copy,
}: VideoUploaderProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  /** `null` when idle; 0–100 while a file is going up. Not `useTransition`: the SDK reports bytes. */
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const isUploading = progress !== null;

  /**
   * The domain answers with a reason code and the words come from the dictionary — see
   * `acceptedVideo`. A sentence returned from the domain would be a Spanish sentence rendered
   * inside the English form.
   */
  function messageFor(reason: "unsupported_type" | "empty" | "too_large"): string {
    if (reason === "too_large") return copy.videoTooLarge;
    if (reason === "empty") return copy.videoEmpty;

    return copy.videoUnsupported;
  }

  async function onPick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setLocalError(null);

    // Checked here *and* by the Storage rules, which is what makes the rejection honest: the
    // browser says why in a sentence, and the bucket refuses regardless of what the browser did.
    const accepted = acceptedVideo(file);
    if (!accepted.ok) {
      setLocalError(messageFor(accepted.reason));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setProgress(0);
    try {
      /*
       * The upload goes straight from the browser to Cloud Storage, so it needs the *web SDK's*
       * session and not the cookie the rest of the app runs on — see `PhotoUploader`, where
       * reading `auth.currentUser` directly produced "tu sesión expiró" for people who were
       * perfectly signed in.
       */
      const user = await ensureClientSession();
      if (!user) {
        setLocalError(copy.videoSessionExpired);
        return;
      }

      const { getDownloadURL, ref, uploadBytesResumable } = await import("firebase/storage");
      const path = `properties/${user.uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "")}`;
      const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });

      task.on("state_changed", (snapshot) => {
        // `totalBytes` can be 0 for a moment before the first chunk is acknowledged.
        if (snapshot.totalBytes > 0) {
          setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      });
      await task;

      onChange({
        path,
        url: await getDownloadURL(task.snapshot.ref),
        // Comes out of `acceptedVideo` already narrowed: no cast, and no second reading of
        // `file.type` that could disagree with the one that was checked.
        contentType: accepted.contentType,
      });
    } catch (cause) {
      /*
       * **A rejected file and a dropped connection are not the same failure**, and telling
       * somebody to "revisa tu conexión" about a file Cloud Storage refused on purpose is the
       * error message this codebase keeps paying for — the same rule `shared/auth/errors.ts`
       * follows, one layer out.
       *
       * `storage/unauthorized` is what the bucket answers when the rules say no, and the rules
       * for `properties/{uid}/**` say no for exactly two reasons: the content type is not one of
       * the three containers, or the file is over 50 MB. So that branch names both, which is
       * actionable — while the generic branch keeps the connection wording it is actually about.
       *
       * It is also the only signal that the rules **have not been deployed**: this file changing
       * in the repository does not change the bucket, so an upload that passes `acceptedVideo` in
       * the browser and still comes back unauthorized means the deployed ruleset predates it.
       * That is why the code is logged rather than swallowed — without it the diagnosis from the
       * screen is indistinguishable from a bad network.
       */
      const code = typeof cause === "object" && cause !== null && "code" in cause
        ? String((cause as { code: unknown }).code)
        : "";
      console.error("property video upload failed", code || cause);
      setLocalError(
        code === "storage/unauthorized" || code === "storage/unauthenticated"
          ? copy.videoRejected
          : copy.videoUploadFailed,
      );
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function askToRemove() {
    if (confirmBeforeRemove) setConfirmingRemoval(true);
    else onChange(null);
  }

  const message = localError ?? error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{copy.videoLabel}</span>
        <span className="text-xs text-muted-foreground">{copy.videoOptional}</span>
      </div>

      {video && (
        <div className="space-y-2 overflow-hidden rounded-xl border border-border">
          {/*
            `preload="metadata"`, not `auto`: this is the landlord's own confirmation that the
            right file went up, and fetching 50 MB to answer it would be paid on every render of
            the edit form. `key` on the path so replacing the video reloads the element instead of
            leaving the previous file playing.
          */}
          <video
            key={video.path}
            src={video.url}
            controls
            preload="metadata"
            playsInline
            aria-label={copy.videoPreviewLabel}
            className="aspect-video w-full bg-muted"
          />
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        /* Its own handle, so a driver names the input it means. See `PhotoUploader`. */
        data-slot="property-video"
        accept={PROPERTY_VIDEO_TYPES.join(",")}
        className="sr-only"
        aria-describedby={message ? errorId : undefined}
        onChange={(event) => void onPick(event.target.files)}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="w-full border-dashed sm:flex-1"
        >
          {isUploading ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <FilmIcon aria-hidden="true" />
          )}
          {isUploading
            ? `${copy.uploadingVideo} ${progress}%`
            : video
              ? copy.changeVideo
              : copy.addVideo}
        </Button>

        {video && !isUploading && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={askToRemove}
            className="w-full text-destructive sm:w-auto"
          >
            <Trash2Icon aria-hidden="true" />
            {copy.removeVideo}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{copy.videoHint}</p>

      {/*
        A percentage inside a button says nothing to a screen reader, and this is the one upload in
        the product long enough for that to matter. The number is announced, not just the fact.
      */}
      <p className="sr-only" aria-live="polite">
        {isUploading ? `${copy.uploadingVideoStatus} ${progress}%` : ""}
      </p>

      {message && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <ConfirmDialog
        open={confirmingRemoval}
        onOpenChange={(open) => (open ? undefined : setConfirmingRemoval(false))}
        title={copy.removeVideoTitle}
        description={copy.removeVideoBody}
        confirmLabel={copy.removeVideoConfirm}
        pendingLabel={copy.removeVideoPending}
        onConfirm={() => {
          onChange(null);
          setConfirmingRemoval(false);
        }}
      />
    </div>
  );
}
