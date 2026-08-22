import { describe, expect, it } from "vitest";

import {
  checkProgress,
  checksBlocker,
  checksBlockerMessage,
  checkStatusOf,
  CHECK_SOURCES,
  CHECK_SOURCE_IDS,
  type CheckResults,
} from "./background-check";

const at = "2026-08-22T12:00:00.000Z";
const all: CheckResults = Object.fromEntries(
  CHECK_SOURCE_IDS.map((id) => [id, { status: "clean" as const, note: "", at }]),
);

describe("CHECK_SOURCES", () => {
  it("names each source, what it is for, and where it lives", () => {
    for (const source of CHECK_SOURCES) {
      expect(source.name).toBeTruthy();
      expect(source.what).toBeTruthy();
      expect(source.url.startsWith("https://")).toBe(true);
    }
  });

  it("covers the four a Colombian landlord actually checks", () => {
    expect(CHECK_SOURCE_IDS).toEqual(["simit", "police", "procuraduria", "contraloria"]);
  });
});

describe("checkStatusOf / checkProgress", () => {
  it("treats a source nobody looked at as pending", () => {
    expect(checkStatusOf({}, "simit")).toBe("pending");
    expect(checkProgress({})).toEqual({ done: 0, total: 4 });
  });

  it("counts the ones already recorded, whatever they found", () => {
    const mixed: CheckResults = {
      simit: { status: "clean", note: "", at },
      police: { status: "findings", note: "Un proceso en 2019", at },
    };

    expect(checkProgress(mixed)).toEqual({ done: 2, total: 4 });
  });
});

describe("checksBlocker", () => {
  it("stops before anything else when there is no authorisation", () => {
    expect(checksBlocker(null, all)).toEqual({ reason: "unauthorized" });
  });

  it("then counts what is left to consult", () => {
    expect(checksBlocker(at, {})).toEqual({ reason: "unchecked", count: 4 });
    expect(checksBlocker(at, { simit: { status: "clean", note: "", at } })).toEqual({
      reason: "unchecked",
      count: 3,
    });
  });

  /*
   * A finding is not a verdict. Somebody with an unpaid speeding ticket is not somebody who will
   * not pay rent; the product records what was found and leaves the decision to the landlord.
   * What blocks is not having looked.
   */
  it("does not block on findings, only on not having looked", () => {
    const withFindings: CheckResults = Object.fromEntries(
      CHECK_SOURCE_IDS.map((id) => [id, { status: "findings" as const, note: "Algo", at }]),
    );

    expect(checksBlocker(at, withFindings)).toBeNull();
    expect(checksBlocker(at, all)).toBeNull();
  });
});

describe("checksBlockerMessage", () => {
  it("tells each side what is theirs to do", () => {
    expect(checksBlockerMessage({ reason: "unauthorized" }, true)).toMatch(/no autoriza/);
    expect(checksBlockerMessage({ reason: "unauthorized" }, false)).toMatch(/Falta que autorices/);
  });

  it("counts in singular and plural", () => {
    expect(checksBlockerMessage({ reason: "unchecked", count: 1 }, true)).toMatch(/1 consulta por registrar/);
    expect(checksBlockerMessage({ reason: "unchecked", count: 3 }, true)).toMatch(/3 consultas por registrar/);
  });
});
