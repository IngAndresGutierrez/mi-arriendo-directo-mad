"use client";

import { useLocale } from "@/shared/i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";
import { useRouter } from "next/navigation";
import { BellIcon, CheckCheckIcon, Volume2Icon, VolumeXIcon } from "lucide-react";

import { ensureClientSession, isSigningOut } from "@/shared/auth/client";
import { reportOrRecover } from "@/shared/auth/subscription-error";
import { cn } from "@/shared/lib/utils";

import { markNotificationsRead } from "../actions/mark-read";
import { firstSnapshot, nextSnapshot, type ArrivalWatch } from "../domain/arrivals";
import { notificationCopy, notificationPath, relativeTime } from "../domain/notification";
import type { Notification } from "../domain/notification";
import {
  armChime,
  playChime,
  readSoundEnabled,
  soundEnabledOnServer,
  subscribeSoundPreference,
  writeSoundEnabled,
} from "./chime";

/**
 * The bell: how many things happened while you were not looking, and what they were.
 *
 * The list is rendered by the server and handed over already read — a popover that fetches on
 * open shows a spinner every single time for data that was already on the page.
 *
 * Opening it marks everything read. That is on purpose: the badge answers "is there something
 * new for me", and the honest moment to stop saying yes is when the person has looked. Marking
 * each one as it is clicked would keep the badge lit over things already seen.
 *
 * ## An arrival is announced three ways, and none of them is the only one
 *
 * A grey icon with a four-pixel sticker on it is a notification system somebody discovers the
 * next day. So something arriving now: **sounds** (`./chime`, switchable and remembered),
 * **swings** the bell once, and **says so in a live region** for a screen reader. Three channels
 * because each one fails on its own — the sound is blocked until the first gesture and can be
 * turned off, the swing is off under `prefers-reduced-motion`, and neither is any use to somebody
 * listening to the page. What never fails is the count, which is why it is on the accessible name
 * of the button and not only in the badge.
 *
 * ## The button, and why the strong state is purple and not cyan
 *
 * Unread, it is a **filled brand-purple control with a cyan count**; read, an outlined one with a
 * purple icon. The old version was `text-muted-foreground` either way, which is the colour this
 * design system uses for text that does not matter, on the one control whose whole job is to say
 * that something does.
 *
 * It is not cyan, and that is the one-`accent`-per-view rule rather than timidity: the cyan on a
 * screen belongs to that screen's action, and the bell is chrome — it is on every screen, so a
 * cyan bell would compete with all of them. A twenty-pixel cyan badge on a purple control is a
 * signal; a cyan button is a call to action. The badge is `text-accent-foreground` because white
 * on `#00E5FF` does not pass AA.
 */
export function NotificationBell({
  notifications,
  unread,
}: {
  readonly notifications: readonly Notification[];
  readonly unread: number;
}) {
  /*
   * The reader's own language: the bell renders `notificationCopy`, and the context carries exactly
   * one two-character string for cases like this.
   */
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  /*
   * The badge clears the moment the panel opens, without waiting for the round trip — and comes
   * back on its own when something new arrives.
   *
   * Adjusted during render rather than in an effect: an effect that calls `setState` runs a
   * second render pass over every notification, and the value is derived from a prop, which is
   * exactly the case React documents this pattern for.
   */
  const [dismissed, setDismissed] = useState(false);
  const [lastSeen, setLastSeen] = useState(unread);
  if (unread !== lastSeen) {
    setLastSeen(unread);
    setDismissed(false);
  }
  const badge = dismissed ? 0 : unread;

  /*
   * Bumped once per arrival, and used as the icon's `key`: remounting the element is what restarts
   * a CSS animation, and toggling a class does not — the second one only replays if the class has
   * been off for a frame, which is a race nobody should have to think about.
   */
  const [rings, setRings] = useState(0);

  /*
   * Only the toggle's own icon reads this. The ring path calls `readSoundEnabled()` at the moment
   * it rings instead, so there is no copy of the preference inside the subscription's closure to
   * go stale — the subscription is set up once and outlives every change to this.
   *
   * `useSyncExternalStore` and not `useState` + an effect: `localStorage` is an external store, so
   * copying it into state on mount is both what the React compiler refuses and a second source of
   * truth. The server snapshot is "on", which is also the default, so the first paint and the
   * hydrated one agree — and the panel this icon lives in cannot be open on the first paint anyway.
   */
  const sound = useSyncExternalStore(
    subscribeSoundPreference,
    readSoundEnabled,
    soundEnabledOnServer,
  );

  /* The audio context can only be created inside a gesture. This waits for the first one. */
  useEffect(() => armChime(), []);

  /*
   * Live, without polling. The rules already let someone read their own notifications, so the
   * bell subscribes to exactly that query and uses it as a signal: when the set changes, ask the
   * server to render again. The count and the words still come from the server — the same reason
   * the process page does it this way.
   */
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    /*
     * Un solo reintento por montaje. `subscribe()` se puede volver a llamar porque una negación con
     * la credencial sana suele ser una suscripción creada bajo el token anterior —tras cambiar la
     * contraseña y volver a entrar— y hasta ahora eso dejaba la campana muerta hasta recargar. El
     * guardia vive aquí y no en el helper: el helper no sabe cuántas veces lo han llamado.
     */
    let retried = false;

    async function subscribe(): Promise<void> {
      const user = await ensureClientSession();
      if (!user || cancelled) return;

      const [{ collection, limit, onSnapshot, orderBy, query, where }, { db }] = await Promise.all([
        import("firebase/firestore"),
        import("@/shared/firebase/db"),
      ]);
      if (cancelled) return;

      /*
       * `null` until the first callback, which is what is already on screen. What comes after it
       * is only news if it carries an id that was not there — see `../domain/arrivals`, and note
       * that "the snapshot changed" is *not* the same question: opening the panel writes `readAt`
       * on every unread notification through a Server Action, so those documents come back changed
       * with nothing new in them.
       */
      let watch: ArrivalWatch | null = null;
      stop = onSnapshot(
        query(
          collection(db, "notifications"),
          where("recipientUid", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(15),
        ),
        (snapshot) => {
          const ids = snapshot.docs.map((document) => document.id);
          if (watch === null) {
            watch = firstSnapshot(ids);
            return;
          }
          watch = nextSnapshot(watch, ids);

          if (snapshot.metadata.hasPendingWrites) return;
          if (watch.arrived) {
            setRings((count) => count + 1);
            if (readSoundEnabled()) playChime();
          }
          router.refresh();
        },
        /*
         * El **código** además del mensaje: cuando el servidor rechaza el listen, lo que hay que
         * saber es *por qué* — `permission-denied` (las reglas desplegadas no permiten esta
         * consulta), `failed-precondition` (falta el índice compuesto) o `unauthenticated` (la
         * sesión del SDK web no es la que cree). Sin el código, lo único que llegaba a la consola
         * era el fallo interno del SDK al limpiar el target, que no dice nada de la causa.
         */
        (error) => {
          /*
           * Un cierre de sesión revoca los tokens **antes** de que el SDK suelte su credencial, así
           * que un listener todavía enganchado recibe `permission-denied`. Eso es la sesión
           * acabándose, no una regla negando nada, y reportarlo manda el diagnóstico a las reglas
           * desplegadas y a los índices, que es exactamente donde no está.
           */
          if (isSigningOut()) return;

          /*
           * Y la sesión también puede acabarse **sin que esta pestaña haya hecho nada**: un
           * restablecimiento de contraseña revoca los refresh tokens, y lo mismo hace deshabilitar
           * la cuenta. `isSigningOut()` no puede saberlo —es una bandera de módulo— así que se
           * pregunta lo único que lo zanja: si la credencial todavía puede renovar su token.
           *
           * `router.refresh()` y no un silencio a secas: la cookie del servidor se verifica con
           * `checkRevoked`, así que un refresco hace que el guard mande al login en vez de dejar a
           * la persona mirando un portal que ya no es suyo.
           */
          void reportOrRecover(
            error,
            "live notifications stopped:",
            router,
            retried
              ? undefined
              : () => {
                  retried = true;
                  stop?.();
                  void subscribe();
                },
          );
        },
      );
    }

    void subscribe();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [router]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);

    if (next && badge > 0) {
      setDismissed(true);
      startTransition(async () => {
        await markNotificationsRead();
        router.refresh();
      });
    }
  }

  const toggleSound = useCallback(() => {
    const next = !readSoundEnabled();
    writeSoundEnabled(next);
    // Turning it on plays it: a sound setting whose effect you only learn about hours later is a
    // setting nobody trusts. This runs inside a click, so the context is unlocked by definition.
    if (next) playChime();
  }, []);

  const now = new Date();

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={
          badge > 0
            ? `Notificaciones, ${badge} sin leer`
            : "Notificaciones, ninguna sin leer"
        }
        className={cn(
          "relative flex size-11 items-center justify-center rounded-xl border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          badge > 0
            ? "border-transparent bg-brand-panel text-brand-panel-foreground shadow-sm hover:bg-brand-panel/90"
            : "border-border bg-card text-primary hover:bg-muted",
        )}
      >
        <BellIcon
          key={rings}
          className={cn("size-5 origin-top", rings > 0 && "animate-bell-ring")}
          aria-hidden="true"
        />
        {badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.7rem] leading-none font-bold text-accent-foreground ring-2 ring-background tabular-nums"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {/*
        The same news for somebody who is listening to the page rather than looking at it. Driven
        off `badge` and not off `unread`, so it says what is on screen: opening the panel clears it
        to an empty string, which announces nothing, which is correct.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {badge > 0
          ? `${badge} ${badge === 1 ? "notificación" : "notificaciones"} sin leer`
          : ""}
      </span>

      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificaciones"
          className="absolute top-13 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="mr-auto text-sm font-semibold text-foreground">Notificaciones</h2>
            {notifications.length > 0 && unread === 0 ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCheckIcon className="size-3.5" aria-hidden="true" />
                Al día
              </span>
            ) : null}
            {/*
              The off switch lives here rather than in a settings screen because this is where
              somebody is standing when the sound annoys them. A noise with no reachable way to
              stop it is a noise people silence at the operating system, and then the reminder ten
              minutes before an interview arrives silenced too.

              Labelled by what the click does, and the two icons differ in shape, not only in
              colour.
            */}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={sound ? "Silenciar las notificaciones" : "Activar el sonido de las notificaciones"}
              title={sound ? "Silenciar las notificaciones" : "Activar el sonido de las notificaciones"}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {sound ? (
                <Volume2Icon className="size-4" aria-hidden="true" />
              ) : (
                <VolumeXIcon className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nada por ahora. Aquí te avisaremos cuando algo se mueva en tus procesos.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => {
                const copy = notificationCopy(notification, locale);

                return (
                  <li key={notification.id}>
                    <Link
                      href={notificationPath(notification)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        notification.readAt === null && "bg-accent/5",
                      )}
                    >
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {notification.readAt === null ? (
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-accent"
                          />
                        ) : null}
                        {copy.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{copy.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {relativeTime(notification.createdAt, now)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
