import type { ReactNode } from "react";

import { listNotifications, NotificationBell } from "@/features/notification";
import { hasProperties } from "@/features/property";
import { getSessionUser } from "@/shared/auth/session";
import { AppShell } from "@/shared/shell/app-shell";

/**
 * The product's chrome: the menu, the bell and the content.
 *
 * It lives under `app/` rather than in `shared/shell` because it needs the notification module,
 * and `shared/` may not depend on a feature — the shell leaves a slot and this fills it.
 *
 * Used by the `(app)` layout for every screen behind a session, and by `/soporte`, which is the
 * one page that renders in either chrome: reaching a person should not require an account, so
 * with a session it appears inside the product and without one inside the public header.
 */
export async function ProductChrome({ children }: { readonly children: ReactNode }) {
  const user = await getSessionUser();

  // Rendered here rather than fetched by the bell on open: a popover that loads when you click
  // it shows a spinner every time for something that was already on the page.
  /*
   * Dos lecturas independientes, en paralelo.
   *
   * La segunda decide si el menú ofrece "Encargos", y la pregunta cambió: antes era "¿te
   * encargaron algo?" —cuando el colaborador vivía dentro del portal— y ahora es "¿tienes
   * inmuebles?". Encargar algo es una acción sobre un inmueble, así que quien no tiene ninguno no
   * tiene nada que delegar, y un inquilino no ve la entrada nunca.
   *
   * `hasProperties` lee un solo documento con `select()` y no lanza: falla escondiendo una entrada
   * del menú, no tumbando la pantalla.
   */
  const [{ items, unread }, owns] = await Promise.all([
    user ? listNotifications(user.uid) : Promise.resolve({ items: [], unread: 0 }),
    user ? hasProperties(user.uid) : Promise.resolve(false),
  ]);

  return (
    <AppShell bell={<NotificationBell notifications={items} unread={unread} />} showErrands={owns}>
      {children}
    </AppShell>
  );
}
