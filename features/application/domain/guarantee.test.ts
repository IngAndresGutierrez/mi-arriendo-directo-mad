import { describe, expect, it } from "vitest";

import {
  guaranteeBlocker,
  guaranteeBlockerMessage,
  guaranteeState,
  GUARANTEE_COVERAGES,
  GUARANTEE_LIMIT_NOTE,
  GUARANTEE_MAX_MONTHS,
  GUARANTEE_PROVIDER,
  type Guarantee,
} from "./guarantee";

const REQUESTED: Guarantee = {
  requestedAt: "2026-09-01T15:00:00.000Z",
  activeAt: null,
  policyNumber: "",
  note: "",
};

describe("guaranteeState", () => {
  it("is `none` with nothing recorded", () => {
    expect(guaranteeState(null)).toBe("none");
  });

  it("is `requested` once the landlord applied", () => {
    expect(guaranteeState(REQUESTED)).toBe("requested");
  });

  it("is `active` only with a policy number: a date alone proves nothing", () => {
    expect(
      guaranteeState({ ...REQUESTED, activeAt: "2026-09-03T10:00:00.000Z", policyNumber: "" }),
    ).toBe("requested");
    expect(
      guaranteeState({ ...REQUESTED, activeAt: "2026-09-03T10:00:00.000Z", policyNumber: "AR-99123" }),
    ).toBe("active");
  });
});

describe("guaranteeBlocker", () => {
  it("blocks with nothing requested", () => {
    expect(guaranteeBlocker(null)).toBe("not_requested");
  });

  it('blocks on "ya la solicité": a wait is not a guarantee', () => {
    expect(guaranteeBlocker(REQUESTED)).toBe("not_issued");
  });

  it("lets an issued policy through", () => {
    const active: Guarantee = {
      ...REQUESTED,
      activeAt: "2026-09-03T10:00:00.000Z",
      policyNumber: "AR-99123",
    };
    expect(guaranteeBlocker(active)).toBeNull();
    expect(guaranteeBlockerMessage(null, true)).toBeNull();
  });

  it("says why, differently to each side", () => {
    expect(guaranteeBlockerMessage("not_requested", true)).toContain("Sura");
    expect(guaranteeBlockerMessage("not_requested", false)).toContain("todavía no");
    expect(guaranteeBlockerMessage("not_issued", false)).toContain("en estudio");
  });
});

describe("what the product promises", () => {
  it("points at Sura's own quoting page, over https", () => {
    expect(GUARANTEE_PROVIDER.quoteUrl).toBe(
      "https://ecomm.sura.co/seguros/hogar/arriendo/cotizador",
    );
  });

  it("names the three coverages and never promises a deposit", () => {
    expect(GUARANTEE_COVERAGES).toHaveLength(3);
    const todo = GUARANTEE_COVERAGES.join(" ").toLowerCase();
    expect(todo).toContain("arriendo");
    expect(todo).toContain("administración");
    expect(todo).toContain("asistencia");
    expect(todo).not.toContain("depósito");
  });

  it("keeps the twelve-month ceiling in the sentence, not only in a constant", () => {
    expect(GUARANTEE_MAX_MONTHS).toBe(12);
    expect(GUARANTEE_LIMIT_NOTE).toContain("12 meses");
    expect(GUARANTEE_LIMIT_NOTE).toContain("vigente");
  });
});
