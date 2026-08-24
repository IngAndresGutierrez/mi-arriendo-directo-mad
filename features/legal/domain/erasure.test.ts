import { describe, expect, it } from "vitest";

import {
  erasureBlocker,
  erasureBlockerMessage,
  erasureDeletions,
  erasureRetentions,
  ERASURE_PLAN,
} from "./erasure";

describe("erasureBlocker", () => {
  it("lets a clean account through", () => {
    expect(erasureBlocker({ openApplications: 0, runningLeases: 0 })).toBeNull();
  });

  it("blocks on an open process", () => {
    expect(erasureBlocker({ openApplications: 2, runningLeases: 0 })).toEqual({
      reason: "open_application",
      count: 2,
    });
  });

  it("blocks on a tenancy in course", () => {
    expect(erasureBlocker({ openApplications: 0, runningLeases: 1 })).toEqual({
      reason: "running_lease",
      count: 1,
    });
  });

  /*
   * Somebody with both is in the middle of living somewhere. Naming the application would send
   * them to withdraw something that is not the obstacle.
   */
  it("names the tenancy when there is both", () => {
    expect(erasureBlocker({ openApplications: 3, runningLeases: 1 })?.reason).toBe("running_lease");
  });
});

describe("erasureBlockerMessage", () => {
  it("says what is in the way and what to do about it", () => {
    expect(erasureBlockerMessage({ reason: "open_application", count: 1 })).toMatch(/Retíralo/);
    expect(erasureBlockerMessage({ reason: "running_lease", count: 1 })).toMatch(/otra parte/);
  });

  it("agrees in number", () => {
    expect(erasureBlockerMessage({ reason: "open_application", count: 1 })).toMatch(
      /un proceso abierto/,
    );
    expect(erasureBlockerMessage({ reason: "open_application", count: 4 })).toMatch(
      /4 procesos abiertos/,
    );
    expect(erasureBlockerMessage({ reason: "running_lease", count: 1 })).toMatch(
      /un arriendo en curso/,
    );
    expect(erasureBlockerMessage({ reason: "running_lease", count: 2 })).toMatch(
      /2 arriendos en curso/,
    );
  });
});

describe("the plan somebody reads before pressing the button", () => {
  it("says what goes and what stays", () => {
    expect(erasureDeletions().length).toBeGreaterThan(0);
    expect(erasureRetentions().length).toBeGreaterThan(0);
    expect(erasureDeletions().length + erasureRetentions().length).toBe(ERASURE_PLAN.length);
  });

  /*
   * **The assertion that keeps this honest.** Supresión is a right; every exception to it is an
   * exception somebody has to be able to defend. A retention with no reason written down is one
   * nobody can, and adding one is the easiest way to quietly widen what this product keeps.
   */
  it("gives a reason for every single thing it keeps", () => {
    for (const item of erasureRetentions()) {
      expect(item.why.length, `"${item.what}" se conserva sin explicar por qué`).toBeGreaterThan(20);
    }
  });

  it("does not explain away a deletion", () => {
    for (const item of erasureDeletions()) {
      expect(item.why).toBe("");
    }
  });

  /* The account itself has to be one of the things that disappears, or this is not a deletion. */
  it("deletes the account and the identifying half of the profile", () => {
    const deleted = erasureDeletions()
      .map((item) => item.what)
      .join(" ");

    expect(deleted).toMatch(/cuenta/);
    expect(deleted).toMatch(/perfil/);
  });
});
