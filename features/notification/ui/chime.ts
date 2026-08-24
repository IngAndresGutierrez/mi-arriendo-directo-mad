/**
 * The sound the bell makes, and the switch that turns it off.
 *
 * It is **synthesised, not a file**. Two sine notes a fifth apart with a fast attack and an
 * exponential decay is about forty lines of Web Audio and no network request, no asset to keep in
 * `public/`, and no decode before the first one can play — which matters, because the moment a
 * notification arrives is exactly the moment there is no time to fetch anything.
 *
 * ## The autoplay policy is the whole difficulty
 *
 * A browser will not let a page make noise before the person has interacted with it: an
 * `AudioContext` created outside a gesture starts `suspended` and `resume()` does nothing. That is
 * not a bug to work around, it is the rule, and the honest way to live with it is:
 *
 * - `armChime()` waits for the first click, tap or keypress anywhere in the document and creates
 *   the context **there**, inside the gesture, which is what makes it `running`. It costs nothing
 *   and makes no sound.
 * - `playChime()` refuses to schedule anything unless the context is already `running`. Scheduling
 *   into a suspended context would be worse than silence: `currentTime` does not advance while
 *   suspended, so every note held back would fire at once the moment it resumed — a chime for a
 *   notification from ten minutes ago, at the instant somebody clicks something unrelated.
 *
 * The cost of that is real and worth stating: a notification that arrives before the person has
 * touched the page at all is silent. The badge, the swing and the live region still say so.
 */

/** A5 and E6 — a rising fifth, which reads as "something arrived" rather than as an alarm. */
const CHIME_NOTES = [880, 1318.5] as const;
/** Seconds between the two notes. Short enough to be one sound, not two. */
const NOTE_GAP_S = 0.09;
const ATTACK_S = 0.008;
const NOTE_LENGTH_S = 0.34;
/** Quiet on purpose: this is news, not an alarm, and it may arrive while somebody is on a call. */
const PEAK_GAIN = 0.09;

export const SOUND_PREFERENCE_KEY = "mad.notification-sound";

/**
 * What a stored preference means.
 *
 * Anything that is not an explicit `"off"` is on, including a missing key and a corrupted value:
 * the failure that matters is a bell that has gone quiet without anyone asking it to, and that is
 * the one this default cannot produce.
 */
export function soundEnabledFrom(raw: string | null): boolean {
  return raw !== "off";
}

/**
 * Reads the preference. Never throws: `localStorage` is unavailable in a private window with site
 * data blocked, and a bell that crashed the top bar over a sound setting would take every screen
 * behind a session with it.
 *
 * It is read at the moment of ringing rather than held in state, so there is no stale copy of it
 * inside the subscription's closure.
 */
export function readSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_KEY);
    if (stored !== null) return soundEnabledFrom(stored);
  } catch {
    // Storage is unavailable, so the in-memory answer below is all there is.
  }

  return forThisTab ?? true;
}

/**
 * What was chosen when `localStorage` refused to keep it — a private window with site data
 * blocked, or a browser told not to store anything.
 *
 * Without this the off switch would be a control that does nothing: the icon would stay put and
 * the sound would keep arriving after somebody had asked it to stop, which is the same lie as a
 * "Continuar" that does not continue. It lasts as long as the tab, which is the most this browser
 * will allow, and stored wins over it so muting in another tab still takes effect here.
 */
let forThisTab: boolean | null = null;

export function writeSoundEnabled(on: boolean): void {
  forThisTab = on;
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, on ? "on" : "off");
  } catch {
    // Nothing to say: `forThisTab` already carries it for as long as this tab lives.
  }
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

/**
 * The store half of the preference, so a component can read it with `useSyncExternalStore` instead
 * of copying it into state from an effect — which is the thing the React compiler refuses, and
 * rightly: `localStorage` is an external store and this is the API for one.
 *
 * It also listens for `storage`, which fires in the *other* tabs: silencing the bell in one and
 * leaving it ringing in another would be a preference that did not take.
 */
export function subscribeSoundPreference(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SOUND_PREFERENCE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The server has no `localStorage`, and the sound is on until somebody says otherwise. */
export function soundEnabledOnServer(): boolean {
  return true;
}

let context: AudioContext | null = null;

function open(): AudioContext | null {
  if (context) return context;
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  try {
    context = new window.AudioContext();
  } catch {
    // An old or locked-down browser. No sound is a lesser problem than a broken top bar.
    context = null;
  }
  return context;
}

/**
 * Prepares the audio context on the first gesture anywhere in the document, and returns the
 * cleanup. Call it once, on mount.
 */
export function armChime(): () => void {
  if (typeof window === "undefined") return () => {};

  const events = ["pointerdown", "keydown", "touchstart"] as const;
  function unlock() {
    stop();
    const ctx = open();
    // Created inside the gesture it is usually `running` already; Safari still wants the resume.
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  }
  function stop() {
    for (const event of events) window.removeEventListener(event, unlock);
  }

  for (const event of events) window.addEventListener(event, unlock, { passive: true });
  return stop;
}

/** Rings, if the browser will let us. Silent — never throwing — when it will not. */
export function playChime(): void {
  const ctx = context;
  if (!ctx || ctx.state !== "running") return;

  const start = ctx.currentTime;
  CHIME_NOTES.forEach((frequency, index) => {
    const at = start + index * NOTE_GAP_S;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // `exponentialRampToValueAtTime` cannot reach zero, so it decays to near-silence and stops.
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(PEAK_GAIN, at + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S);

    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_LENGTH_S);
  });
}
