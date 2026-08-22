"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon, CheckCheckIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { markNotificationsRead } from "../actions/mark-read";
import { notificationCopy, notificationPath, relativeTime } from "../domain/notification";
import type { Notification } from "../domain/notification";

/**
 * The bell: how many things happened while you were not looking, and what they were.
 *
 * The list is rendered by the server and handed over already read — a popover that fetches on
 * open shows a spinner every single time for data that was already on the page.
 *
 * Opening it marks everything read. That is on purpose: the badge answers "is there something
 * new for me", and the honest moment to stop saying yes is when the person has looked. Marking
 * each one as it is clicked would keep the badge lit over things already seen.
 */
export function NotificationBell({
  notifications,
  unread,
}: {
  readonly notifications: readonly Notification[];
  readonly unread: number;
}) {
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
        className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <BellIcon className="size-5" aria-hidden="true" />
        {badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold text-white"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificaciones"
          className="absolute top-12 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Notificaciones</h2>
            {notifications.length > 0 && unread === 0 ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCheckIcon className="size-3.5" aria-hidden="true" />
                Al día
              </span>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nada por ahora. Aquí te avisaremos cuando algo se mueva en tus procesos.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => {
                const copy = notificationCopy(notification);

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
