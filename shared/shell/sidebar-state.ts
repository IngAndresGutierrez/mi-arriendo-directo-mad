/**
 * Whether the desktop menu is collapsed, remembered per browser.
 *
 * A cookie rather than `localStorage`: the server renders the menu, so it has to know the
 * width before the first paint. Read from `localStorage` the page would always come up
 * collapsed and then jump open, which is worse than not remembering at all.
 *
 * It is a preference, not data: nothing here identifies anyone, so it needs no per-uid scope.
 */
export const SIDEBAR_COOKIE = "sidebar";

/** A year. The choice is a habit, and asking again next week would be noise. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Collapsed is the default: the icons with their labels are enough to navigate by. */
export function isSidebarCollapsed(cookieValue: string | undefined): boolean {
  return cookieValue !== "expanded";
}

/** The value to store. Written from the client, read on the server. */
export function sidebarCookieValue(collapsed: boolean): string {
  return collapsed ? "collapsed" : "expanded";
}
