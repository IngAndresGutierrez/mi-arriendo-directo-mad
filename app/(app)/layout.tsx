import type { ReactNode } from "react";

import { listNotifications, NotificationBell } from "@/features/notification";
import { getSessionUser } from "@/shared/auth/session";
import { AppShell } from "@/shared/shell/app-shell";

/**
 * The product's chrome, composed once for every screen behind a session.
 *
 * It lives here rather than in `shared/shell` because it needs the notification module, and
 * `shared/` may not depend on a feature — the shell leaves a slot and this fills it. It also
 * saves five pages from repeating the same wrapper, which is how one of them ended up a
 * container width apart from the others.
 *
 * Each page still guards itself with `requireCompleteProfile()`: a layout does not re-run on
 * every navigation within the group, so authorization cannot live here.
 */
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await getSessionUser();

  // Rendered here rather than fetched by the bell on open: a popover that loads when you click
  // it shows a spinner every time for something that was already on the page.
  const { items, unread } = user
    ? await listNotifications(user.uid)
    : { items: [], unread: 0 };

  return (
    <AppShell bell={<NotificationBell notifications={items} unread={unread} />}>
      {children}
    </AppShell>
  );
}
