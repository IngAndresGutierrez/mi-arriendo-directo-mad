/**
 * What is new since the last time we looked.
 *
 * The bell already subscribes to the caller's fifteen most recent notifications, and it uses that
 * subscription as a signal to re-render from the server. Making a sound needs a stricter question
 * than "did the snapshot change?", because most snapshots are not news:
 *
 * - **Opening the panel writes `readAt` on every unread notification.** That write happens in a
 *   Server Action, with the Admin SDK, so it does not show up as a pending write on the client —
 *   `snapshot.metadata.hasPendingWrites` cannot filter it out. A bell that rang on any change
 *   would chime at the person for having read their own notifications.
 * - **The first callback is what is already on screen**, rendered by the server. Ringing there
 *   would mean a chime on every navigation.
 *
 * So the gate is identity: a snapshot is news exactly when it carries a document id that was not
 * there before. Ten arriving at once are one piece of news, not ten chimes.
 *
 * `seen` only ever grows, and deliberately so. Pruning it to the current window would let an id
 * that fell off the bottom of the fifteen count as new if it ever came back; it is bounded by how
 * many notifications one person receives while a tab stays open, which is tens.
 */
export type ArrivalWatch = {
  /** Every id this session has already accounted for. */
  readonly seen: ReadonlySet<string>;
  /** Whether the snapshot that produced this watch brought something that was not there before. */
  readonly arrived: boolean;
};

/** The state of play when the subscription first answers: everything is already known. */
export function firstSnapshot(ids: readonly string[]): ArrivalWatch {
  return { seen: new Set(ids), arrived: false };
}

/** The same question on every later snapshot: is any of this new? */
export function nextSnapshot(watch: ArrivalWatch, ids: readonly string[]): ArrivalWatch {
  const fresh = ids.filter((id) => !watch.seen.has(id));
  if (fresh.length === 0) return { seen: watch.seen, arrived: false };

  const seen = new Set(watch.seen);
  for (const id of fresh) seen.add(id);
  return { seen, arrived: true };
}
