import type { ReactNode } from "react";

import { listNotifications, NotificationBell } from "@/features/notification";
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
  const { items, unread } = user ? await listNotifications(user.uid) : { items: [], unread: 0 };

  return (
    <AppShell bell={<NotificationBell notifications={items} unread={unread} />}>
      {children}
    </AppShell>
  );
}
