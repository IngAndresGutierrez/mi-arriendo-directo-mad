"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
  Loader2Icon,
  PrinterIcon,
  Share2Icon,
} from "lucide-react";

import { propertyPosterImageRoute } from "@/shared/auth/routes";
import type { Dictionary } from "@/shared/i18n";
import { localeHref } from "@/shared/i18n/locale";
import { useLocale } from "@/shared/i18n/locale-context";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { POSTER_FORMAT_SEGMENTS, POSTER_SIZES, type PosterFormat } from "../domain/poster";

/**
 * Choosing a notice, looking at it, and getting it out of the browser.
 *
 * **One format on screen at a time, not both side by side.** They carry the same six facts in the
 * same order — the point of one composition for two shapes — so showing both is showing the same
 * poster twice, and it would put two calls to action on the page: printing the sheet and sharing
 * the square, each of which wants to be *the* action of the view. One choice up front makes the
 * button underneath unambiguous, and it halves the work: each preview is a satori render of an
 * A4 page on the server.
 *
 * A radio group and not a tab rail. The two options need a sentence each — "imprímelo y pégalo en
 * la portería" is the whole difference between them — and a tab label has nowhere to put one. It is
 * a native `<input type="radio">` behind a card, so arrow keys, the focus ring and the announced
 * group name all work without a line of JavaScript.
 */
export function PosterActions({
  propertyId,
  slug,
  shareText,
  copy,
}: {
  readonly propertyId: string;
  /** Only for the downloaded file's name: a landlord ends up with several of these in Descargas. */
  readonly slug: string;
  /**
   * The caption that goes with the square: the fact sheet and the link, resolved by the page.
   *
   * **It is the mechanism of the social format, not a nicety.** No network makes a link inside an
   * image tappable, and the square deliberately carries no QR — so this text is how somebody gets
   * from a post to the listing. Resolved on the server because it is parameterised copy; the
   * `poster` namespace has to stay function-free to reach this component at all.
   */
  readonly shareText: string;
  /**
   * The screen's words, resolved by the page. A prop and not a dictionary import: this is a Client
   * Component, and importing the dictionary here would ship both languages in the bundle.
   */
  readonly copy: Dictionary["poster"];
}) {
  const locale = useLocale();
  const [format, setFormat] = useState<PosterFormat>("wall");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /*
   * **Two readiness flags, not one, and they are not the same wait.** Each poster is a Firestore
   * read, a photo fetch and a PNG encode on the server, so both arrive late — but the preview is
   * the one somebody is looking at, and the print sheet is the hidden A4 that `Imprimir` sends to
   * the printer. Sharing one flag would either leave the preview blank while the sheet downloads or
   * — far worse — let `Imprimir` fire before the sheet exists, which prints one empty page. That is
   * the same blank sheet the `[hidden]` cascade bug produced, arriving by a different route.
   */
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "failed">("loading");
  const [printReady, setPrintReady] = useState(false);
  const [isBusy, startBusy] = useTransition();
  const canShareFiles = useSyncExternalStore(subscribeNothing, readShareSupport, () => false);

  /*
   * Through `localeHref`, for the same reason every `<Link>` in this product goes through
   * `LocaleLink`: the route lives under `[lang]`, so a bare `/mis-inmuebles/…` fetched from
   * `/en/mis-inmuebles/…` renders the **Spanish** poster — a QR pointing at the Spanish listing,
   * on a sheet whose landlord is reading English. Nothing errors and no type checker can see it.
   */
  const source = (which: PosterFormat) =>
    localeHref(locale, propertyPosterImageRoute(propertyId, POSTER_FORMAT_SEGMENTS[which]));

  const options: readonly { readonly value: PosterFormat; readonly name: string; readonly hint: string }[] = [
    { value: "wall", name: copy.wallName, hint: copy.wallHint },
    { value: "social", name: copy.socialName, hint: copy.socialHint },
  ];

  async function fileOf(which: PosterFormat): Promise<File> {
    const response = await fetch(source(which));
    if (!response.ok) throw new Error(`the notice answered ${response.status}`);

    return new File([await response.blob()], `aviso-${slug}-${POSTER_FORMAT_SEGMENTS[which]}.png`, {
      type: "image/png",
    });
  }

  function download() {
    setError(null);
    startBusy(async () => {
      try {
        const file = await fileOf(format);
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        /*
         * Revoked, and not immediately: Safari reads the blob after the click returns, so freeing
         * it on the next line downloads an empty file. A frame is enough and costs nothing.
         */
        requestAnimationFrame(() => URL.revokeObjectURL(url));
      } catch {
        setError(copy.downloadFailed);
      }
    });
  }

  async function copyCaption() {
    setError(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* An insecure origin or a withheld permission. The text is on screen either way. */
      setError(copy.copyTextFailed);
    }
  }

  function share() {
    setError(null);
    startBusy(async () => {
      try {
        /*
         * `text` alongside the file, and it is **best effort by design**: some targets take it as
         * the caption (WhatsApp does), others drop it silently. That is exactly why the caption is
         * also a button of its own — on Instagram and Facebook it is pasted by hand, and a
         * mechanism that only works where the share sheet cooperates is a mechanism that fails
         * quietly on the two networks this format exists for.
         */
        await navigator.share({
          files: [await fileOf(format)],
          title: copy.shareTitle,
          text: shareText,
        });
      } catch (cause) {
        /*
         * Dismissing the sheet rejects with `AbortError`, and that is not a failure — telling
         * somebody "no pudimos preparar el archivo" because they changed their mind is the kind of
         * error message that teaches people to distrust every other one.
         */
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(copy.downloadFailed);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">{copy.title}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                format === option.value
                  ? "border-brand-panel bg-secondary"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="poster-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => {
                    setFormat(option.value);
                    /* The other format's PNG has not been asked for yet: back to the skeleton. */
                    setPreviewState("loading");
                    setError(null);
                  }}
                  className="size-4 accent-[var(--brand-panel)]"
                />
                <span className="font-medium text-foreground">{option.name}</span>
              </span>
              <span className="pl-6 text-sm text-muted-foreground">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        The preview, at the poster's own aspect ratio so the box does not resize when the image
        lands — a page that jumps once the render comes back reads as broken on the slow connection
        where it is most likely to happen. A plain `<img>`: this route is decided by who is asking
        and answers `private, no-store`, so putting Next's optimiser in front of it would be asking
        a shared cache to hold a per-landlord response.
      */}
      {/*
        The box keeps the poster's own aspect ratio whether or not the image has arrived, so nothing
        moves when it does. A page that jumps once the render comes back reads as broken on exactly
        the slow connection where it is most likely to happen — and this render is not instant: it
        is a Firestore read, a photo fetch and a PNG encode, on the server, per format.
      */}
      <div
        role="status"
        aria-live="polite"
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-muted"
        style={{ aspectRatio: `${POSTER_SIZES[format].width} / ${POSTER_SIZES[format].height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- see the note above: this route
            is owner-gated and answers `private, no-store`, so putting Next's shared optimiser in
            front of it would cache a per-landlord response. */}
        <img
          key={format}
          src={source(format)}
          alt={copy.previewAlt}
          width={POSTER_SIZES[format].width}
          height={POSTER_SIZES[format].height}
          /*
           * **The ref decides both outcomes, and the handlers are the fallback — not the other way
           * round.** This `<img>` is in the server-rendered HTML, so the browser starts fetching it
           * while the page is still parsing and can finish *long* before React attaches a listener;
           * `onLoad` and `onError` then never fire and the skeleton sits for ever over a poster
           * that is perfectly ready, or over one that failed. It was found by aborting the request
           * in the driver and watching "Preparando el aviso…" stay put next to `complete: true,
           * naturalWidth: 0`.
           *
           * `complete` with a natural width is a picture; `complete` with none is a failure; not
           * complete yet is a wait, and that is the only case the handlers below are left to
           * answer. `setState` to the value it already holds bails out, so this cannot loop.
           */
          ref={(node) => {
            if (!node?.complete) return;
            setPreviewState(node.naturalWidth > 0 ? "ready" : "failed");
          }}
          onLoad={() => setPreviewState("ready")}
          onError={() => setPreviewState("failed")}
          className={cn(
            "block h-auto w-full transition-opacity",
            previewState === "ready" ? "opacity-100" : "opacity-0",
          )}
        />

        {previewState === "ready" ? null : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {previewState === "loading" ? (
              <>
                <Skeleton className="absolute inset-0 rounded-none" />
                <Loader2Icon
                  className="relative size-6 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="relative text-sm text-muted-foreground">{copy.loadingPreview}</p>
              </>
            ) : (
              /*
                A failed render says so instead of leaving a shimmering rectangle for ever. It is
                the same reason `SupportActions` prints the address when the clipboard refuses:
                a placeholder that never resolves is indistinguishable from a broken page.
              */
              <p className="text-sm text-destructive">{copy.previewFailed}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/*
          One cyan per view, and which action earns it depends on where the notice is going. The
          wall sheet exists to be printed; the square exists to be posted. The other one is always
          "Descargar", in `brand` — a real control, plainly not the one being pointed at.

          On a desktop `navigator.share` cannot take a file, so the square has no share button at
          all and the download takes the cyan instead. A control that fails is worse than one that
          is absent — the same rule the signature's WhatsApp channel already follows.
        */}
        {format === "wall" ? (
          <>
            {/*
              **Disabled until the hidden A4 has actually downloaded.** `window.print()` prints the
              document as it stands, so pressing this a second too early sends one blank sheet to a
              printer — the failure is silent, costs paper, and the person only finds out at the
              tray. `disabled` and not `aria-disabled` because this is a wait rather than a refusal:
              there is nothing to explain, only something to finish.
            */}
            <Button
              type="button"
              variant="accent"
              size="xl"
              onClick={() => window.print()}
              disabled={!printReady}
            >
              {printReady ? (
                <PrinterIcon aria-hidden="true" />
              ) : (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              {printReady ? copy.print : copy.preparingPrint}
            </Button>
            <Button type="button" variant="brand" size="xl" onClick={download} disabled={isBusy}>
              <DownloadIcon aria-hidden="true" />
              {copy.download}
            </Button>
          </>
        ) : (
          <>
            {canShareFiles ? (
              <Button type="button" variant="accent" size="xl" onClick={share} disabled={isBusy}>
                <Share2Icon aria-hidden="true" />
                {isBusy ? copy.sharing : copy.share}
              </Button>
            ) : null}
            {/*
              Copying the caption is the accent when there is no share sheet, because on a desktop
              it *is* the whole flow: download the square, paste the text, post. Where sharing works
              it steps back to `brand` — still a real control, plainly not the one being pointed at.
            */}
            <Button
              type="button"
              variant={canShareFiles ? "brand" : "accent"}
              size="xl"
              onClick={copyCaption}
            >
              {copied ? <CheckIcon aria-hidden="true" /> : <ClipboardIcon aria-hidden="true" />}
              {copied ? copy.textCopied : copy.copyText}
            </Button>
            <Button type="button" variant="brand" size="xl" onClick={download} disabled={isBusy}>
              <DownloadIcon aria-hidden="true" />
              {copy.download}
            </Button>
          </>
        )}
      </div>

      {/*
        The caption itself, on screen and readable.

        Not hidden behind the copy button: the clipboard can refuse — an insecure origin, a withheld
        permission — and a landlord who wants to change a word before posting has nowhere to do it
        otherwise. It is the same call `SupportActions` makes by printing the address under a copy
        button that failed.
      */}
      {format === "social" ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">{copy.captionLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.captionHint}</p>
          <p className="mt-3 text-sm whitespace-pre-line break-words text-foreground">{shareText}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <PrintSheet source={source("wall")} alt={copy.previewAlt} onReady={setPrintReady} />
    </div>
  );
}

/**
 * The sheet the print dialog actually gets: the A4 poster, alone, edge to edge.
 *
 * **Portalled to `<body>` rather than rendered in place**, and that is what makes the print rule in
 * `app/globals.css` a single line instead of a fight with the cascade. Hiding everything else from
 * inside the page means either `visibility: hidden` on every element — which still reserves the
 * space, and prints blank pages after the poster — or naming each ancestor of the app shell, which
 * breaks the day the shell changes. As a direct child of `<body>` the rule is "hide my siblings",
 * and it stays true wherever this screen is composed.
 *
 * It is always the **wall** format regardless of what is selected, because printing a square onto
 * A4 is not a thing anybody wants: `Ctrl+P` anywhere on this page produces the sheet meant for a
 * wall, which is the only interpretation of "print" this screen has.
 *
 * **It carries no `hidden` attribute**, and that is not an oversight: `app/globals.css` hides it on
 * screen instead. Tailwind's preflight sets `[hidden] { display: none !important }` inside a layer,
 * and for important declarations the cascade inverts layer order — so an unlayered
 * `display: block !important` under `@media print` never won, and the print dialog produced a
 * correctly-sized, completely blank A4 page.
 *
 * `createPortal` needs a DOM, so it is skipped until mounted. `useSyncExternalStore` answers that
 * without a `setState` in an effect body, which the React compiler refuses.
 */
function PrintSheet({
  source,
  alt,
  onReady,
}: {
  readonly source: string;
  readonly alt: string;
  /** Told when the sheet is downloadable, so `Imprimir` cannot fire over an empty page. */
  readonly onReady: (ready: boolean) => void;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div data-print-sheet>
      {/* eslint-disable-next-line @next/next/no-img-element -- same owner-gated, uncacheable route
          as the preview; and this one is only ever laid out by a print dialog. */}
      <img
        src={source}
        alt={alt}
        /* Same race as the preview's, and the same answer: the sheet is in the SSR HTML too. */
        ref={(node) => {
          if (node?.complete && node.naturalWidth > 0) onReady(true);
        }}
        onLoad={() => onReady(true)}
      />
    </div>,
    document.body,
  );
}

/** Nothing ever changes these snapshots; the store is only a way to ask the browser once. */
function subscribeNothing(): () => void {
  return () => {};
}

/**
 * Whether this browser can hand a **file** to the share sheet.
 *
 * `navigator.share` exists on desktop Safari and shares links only, so testing for it alone offers
 * a button that opens a sheet with no image in it. `canShare({ files })` is the question that
 * matches what this screen wants to do.
 *
 * Cached in a module-level variable so the snapshot is reference-stable — `useSyncExternalStore`
 * compares with `Object.is`, and a getter that built a fresh probe file on every render is exactly
 * the shape that once produced "Maximum update depth exceeded" out of the cookie banner.
 */
let shareSupport: boolean | null = null;

function readShareSupport(): boolean {
  if (shareSupport !== null) return shareSupport;

  try {
    shareSupport =
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([], "aviso.png", { type: "image/png" })] });
  } catch {
    shareSupport = false;
  }

  return shareSupport;
}
