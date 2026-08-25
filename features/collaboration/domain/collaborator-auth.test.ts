import { describe, expect, it } from "vitest";

import {
  codeProblem,
  CODE_MAX_ATTEMPTS,
  CODE_PROBLEMS,
  CODE_PROBLEM_MESSAGES,
  type Challenge,
} from "./collaborator-auth";

const NOW = Date.parse("2026-08-25T15:00:00.000Z");

const challenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  codeHash: "correct-hash",
  salt: "salt",
  expiresAt: NOW + 60_000,
  attempts: 0,
  ...overrides,
});

describe("codeProblem", () => {
  it("accepts the right code inside its window", () => {
    expect(codeProblem(challenge(), "correct-hash", NOW)).toBeNull();
  });

  it("refuses a code with no challenge behind it", () => {
    expect(codeProblem(null, "anything", NOW)).toBe("missing");
  });

  it("refuses the wrong code", () => {
    expect(codeProblem(challenge(), "other-hash", NOW)).toBe("wrong");
  });

  it("refuses an expired one, and treats the boundary as expired", () => {
    expect(codeProblem(challenge({ expiresAt: NOW }), "correct-hash", NOW)).toBe("expired");
    expect(codeProblem(challenge({ expiresAt: NOW + 1 }), "correct-hash", NOW)).toBeNull();
  });

  it("refuses once the attempts are spent", () => {
    expect(codeProblem(challenge({ attempts: CODE_MAX_ATTEMPTS }), "correct-hash", NOW)).toBe(
      "too_many_attempts",
    );
  });

  /*
   * The order of the checks is the rule worth pinning.
   *
   * Comparing the code first would let somebody keep testing guesses against a challenge that is
   * already expired or already spent — which is exactly the limit they are trying to get around. So
   * a *correct* code must still be refused when the challenge is dead, and the reason must be the
   * dead challenge rather than the comparison.
   */
  it("checks expiry and attempts before it compares the code", () => {
    expect(codeProblem(challenge({ expiresAt: NOW - 1 }), "correct-hash", NOW)).toBe("expired");
    expect(codeProblem(challenge({ attempts: 99 }), "correct-hash", NOW)).toBe("too_many_attempts");
    // And expiry outranks the attempt count, so a stale challenge never reports the wrong reason.
    expect(codeProblem(challenge({ expiresAt: NOW - 1, attempts: 99 }), "x", NOW)).toBe("expired");
  });

  it("has a message for every problem", () => {
    for (const problem of CODE_PROBLEMS) expect(CODE_PROBLEM_MESSAGES[problem]).toBeTruthy();
  });
});
