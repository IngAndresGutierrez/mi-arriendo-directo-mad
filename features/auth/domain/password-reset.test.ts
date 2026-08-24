import { describe, expect, it } from "vitest";

import {
  passwordResetEmail,
  resetThrottle,
  RESET_MAX_PER_WINDOW,
  RESET_WINDOW_MS,
} from "./password-reset";

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = Date.parse("2026-08-24T15:00:00.000Z");

describe("resetThrottle", () => {
  it("allows the first request an address ever makes", () => {
    const decision = resetThrottle(null, NOW);

    expect(decision.allowed).toBe(true);
    expect(decision.next).toEqual({ count: 1, windowStartedAt: NOW });
  });

  it("allows up to the limit inside one window", () => {
    let attempts = resetThrottle(null, NOW).next;

    for (let n = 2; n <= RESET_MAX_PER_WINDOW; n += 1) {
      const decision = resetThrottle(attempts, NOW + 1000 * n);
      expect(decision.allowed).toBe(true);
      attempts = decision.next;
    }

    expect(attempts.count).toBe(RESET_MAX_PER_WINDOW);
  });

  it("refuses the one past the limit", () => {
    const attempts = { count: RESET_MAX_PER_WINDOW, windowStartedAt: NOW };

    expect(resetThrottle(attempts, NOW + 60_000).allowed).toBe(false);
  });

  it("counts a refused attempt, so hammering it does not let the window lapse", () => {
    // A counter that only advanced on success would let somebody keep requesting for ever: the
    // window would expire on schedule while the requests kept landing.
    const attempts = { count: RESET_MAX_PER_WINDOW, windowStartedAt: NOW };
    const decision = resetThrottle(attempts, NOW + 60_000);

    expect(decision.allowed).toBe(false);
    expect(decision.next.count).toBe(RESET_MAX_PER_WINDOW + 1);
    expect(decision.next.windowStartedAt).toBe(NOW);
  });

  it("opens a fresh window once the old one is over", () => {
    const attempts = { count: 99, windowStartedAt: NOW };
    const decision = resetThrottle(attempts, NOW + RESET_WINDOW_MS);

    expect(decision.allowed).toBe(true);
    expect(decision.next).toEqual({ count: 1, windowStartedAt: NOW + RESET_WINDOW_MS });
  });

  it("treats the boundary as expired rather than as still inside", () => {
    expect(resetThrottle({ count: 99, windowStartedAt: NOW }, NOW + RESET_WINDOW_MS - 1).allowed).toBe(
      false,
    );
    expect(resetThrottle({ count: 99, windowStartedAt: NOW }, NOW + RESET_WINDOW_MS).allowed).toBe(true);
  });
});

describe("passwordResetEmail", () => {
  const link = "https://miarriendodirecto.com/recuperar/confirmar?oobCode=abc123";

  it("carries the link in both the text and the html parts", () => {
    const email = passwordResetEmail("alguien@example.com", link);

    expect(email.to).toBe("alguien@example.com");
    expect(email.text).toContain(link);
    expect(email.html).toContain(link);
  });

  it("says the link expires and can only be used once", () => {
    // What makes a forwarded screenshot of this email harmless a day later.
    const { text } = passwordResetEmail("alguien@example.com", link);

    expect(text).toMatch(/vence/i);
    expect(text).toMatch(/una sola vez|solo sirve una vez/i);
  });

  it("tells somebody who did not ask that their password has not changed", () => {
    // An unexplained reset email reads as "you have been hacked", and the panicked response is to
    // click the link — which is the behaviour phishing depends on.
    const { text } = passwordResetEmail("alguien@example.com", link);

    expect(text).toMatch(/no fuiste tú/i);
    expect(text).toMatch(/no ha cambiado/i);
  });

  it("does not claim the reader is part of a rental process", () => {
    // `renderNotificationEmail` ends with exactly that sentence, and here it would be false:
    // somebody with no process at all is entitled to get back into their account.
    const { text, html } = passwordResetEmail("alguien@example.com", link);

    expect(text).not.toMatch(/haces parte de un proceso/i);
    expect(html).not.toMatch(/haces parte de un proceso/i);
  });

  it("escapes a link that tries to break out of the href", () => {
    const hostile = 'https://example.test/"><script>alert(1)</script>';
    const { html } = passwordResetEmail("alguien@example.com", hostile);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });
});
