"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { ensureClientSession, isSigningOut } from "@/shared/auth/client";
import { reportOrRecover } from "@/shared/auth/subscription-error";

/**
 * Re-renders the page on the server whenever a document it depends on changes.
 *
 * **Why a refresh and not the snapshot's data.** What is on screen comes from the server, and
 * some of it *only* the server can produce: a signed URL for a private file, a document
 * collection the reader is not allowed to query, an email address. Rendering from the snapshot
 * would mean either weakening those rules or keeping two versions of every screen. So the
 * snapshot is used as a **signal** — something changed — and the server render stays the single
 * source of truth. The subscription reads one field and nothing else.
 *
 * The client SDK needs its own session for this, and the rules to allow the read; without either
 * the page simply behaves as it did before, which is the right failure: no live updates is a
 * lesser problem than a broken screen.
 */
export function useLiveRefresh(path: string, version: string): void {
  const router = useRouter();
  // What is already on screen. Refreshing for the change we caused is a wasted round trip.
  const rendered = useRef(version);

  useEffect(() => {
    rendered.current = version;
  }, [version]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    // Un solo reintento por montaje, igual que en la campana y por el mismo motivo.
    let retried = false;

    async function subscribe(): Promise<void> {
      const user = await ensureClientSession();
      if (!user || cancelled) return;

      const [{ doc, onSnapshot }, { db }] = await Promise.all([
        import("firebase/firestore"),
        import("@/shared/firebase/db"),
      ]);
      if (cancelled) return;

      stop = onSnapshot(
        doc(db, path),
        (snapshot) => {
          const at = snapshot.get("updatedAt");
          const changed = typeof at?.toMillis === "function" ? String(at.toMillis()) : "";
          if (changed && changed !== rendered.current) {
            rendered.current = changed;
            router.refresh();
          }
        },
        // A denied or dropped subscription is not worth an error on screen: the page still works,
        // it just stops updating on its own.
        // El código además del mensaje: `permission-denied`, `failed-precondition` (índice) y
        // `unauthenticated` se arreglan en sitios distintos, y el mensaje solo no los distingue.
        (error) => {
          // Igual que en la campana: al cerrar sesión los tokens se revocan antes de que el SDK
          // suelte la credencial, así que este rechazo es el final de la sesión, no una regla.
          if (isSigningOut()) return;

          // Misma historia que en la campana, y por eso el helper es compartido: la sesión puede
          // morir en otra pestaña (un cambio de contraseña revoca los tokens) y aquí llega como un
          // `permission-denied` que parece de reglas — o la suscripción quedó atada al token
          // anterior, y entonces lo que hace falta es rehacerla, no reportarla.
          void reportOrRecover(
            error,
            "live updates stopped:",
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
  }, [path, router]);
}
