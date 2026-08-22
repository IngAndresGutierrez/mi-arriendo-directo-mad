import { describe, expect, it } from "vitest";

import {
  applicationBlocker,
  canAdvance,
  canClose,
  closedAtLabel,
  isUnbuilt,
  nextStage,
  stageProgress,
  stageProgressLabel,
  stageState,
  STAGES,
  stageDescription,
  STAGE_DESCRIPTIONS,
  STAGE_DESCRIPTIONS_LANDLORD,
  STAGE_LABELS,
  type Application,
  type Stage,
} from "./application";

const at = (stage: Stage, status: Application["status"] = "open") => ({ stage, status });

describe("the nine stages", () => {
  it("are nine, in the agreed order, and end with the rental in course", () => {
    expect(STAGES).toHaveLength(9);
    expect(STAGES[0]).toBe("submitted");
    expect(STAGES.at(-1)).toBe("active");
  });

  /*
   * Checking records comes right after the documents that make it possible: the identity
   * document is what the search is run against, so asking before it exists asks for nothing.
   */
  it("checks records only once the documents are in", () => {
    expect(STAGES.indexOf("background_check")).toBe(STAGES.indexOf("tenant_data") + 1);
    expect(STAGES.indexOf("background_check")).toBeLessThan(STAGES.indexOf("approved"));
  });

  /*
   * Reviewing the documents *is* stage two, where each is approved or rejected. A stage that
   * repeats what the previous one settled is a stage everybody clicks through without reading.
   */
  it("has no separate document review stage", () => {
    expect(STAGES).not.toContain("document_review");
  });

  /*
   * Ley 820 de 2003 forbids cash deposits on urban housing leases in Colombia. The reference
   * design this was adapted from has one; if it ever comes back, this test is where it stops.
   */
  it("has no deposit stage, and does have the guarantee that replaces it", () => {
    expect(STAGES).not.toContain("deposit");
    expect(Object.values(STAGE_LABELS).join(" ").toLowerCase()).not.toContain("depósito");
    expect(STAGES).toContain("guarantee");
  });

  it("names and explains every one of them, to each side", () => {
    for (const stage of STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
      expect(STAGE_DESCRIPTIONS[stage]).toBeTruthy();
      expect(STAGE_DESCRIPTIONS_LANDLORD[stage]).toBeTruthy();
    }
  });

  /*
   * Both sides read the same screen. One set of words cannot serve them: the sentence that
   * tells the tenant to wait for a call is the sentence that tells the landlord to make it.
   */
  it("does not tell the landlord to wait for the landlord", () => {
    expect(stageDescription("interview", false)).toMatch(/El propietario te contactará/);
    expect(stageDescription("interview", true)).toMatch(/Contáctalo/);
    for (const stage of STAGES) {
      expect(stageDescription(stage, true)).not.toMatch(/El propietario te/);
    }
  });

  it("marks as unbuilt only the stages with nothing behind them yet", () => {
    expect(isUnbuilt("submitted")).toBe(false);
    expect(isUnbuilt("active")).toBe(false);
    expect(isUnbuilt("contract_signature")).toBe(true);
    // The documents stage is built now: files are uploaded and previewed in the product.
    expect(isUnbuilt("tenant_data")).toBe(false);
    // Checking records is not: no source can be queried from here yet.
    expect(isUnbuilt("background_check")).toBe(true);
  });
});

describe("nextStage", () => {
  it("walks the list and stops at the end", () => {
    expect(nextStage("submitted")).toBe("tenant_data");
    expect(nextStage("tenant_data")).toBe("background_check");
    expect(nextStage("approved")).toBe("contract_signature");
    expect(nextStage("active")).toBeNull();
  });

  it("reaches the last stage in exactly eight moves", () => {
    let stage: Stage | null = "submitted";
    let moves = 0;
    while (nextStage(stage!) !== null) {
      stage = nextStage(stage!);
      moves += 1;
    }
    expect(stage).toBe("active");
    expect(moves).toBe(8);
  });
});

describe("stageState", () => {
  it("sorts the list into done, current and pending", () => {
    expect(stageState("submitted", "interview")).toBe("done");
    expect(stageState("interview", "interview")).toBe("current");
    expect(stageState("approved", "interview")).toBe("pending");
  });
});

describe("progress", () => {
  it("counts from one, not from zero", () => {
    expect(stageProgressLabel("submitted")).toBe("Paso 1 de 9");
    expect(stageProgressLabel("active")).toBe("Paso 9 de 9");
  });

  it("fills the bar only when the process is at the last stage", () => {
    expect(stageProgress("submitted")).toBeCloseTo(1 / 9);
    expect(stageProgress("active")).toBe(1);
  });
});

describe("canAdvance / canClose", () => {
  it("advances only an open process that has somewhere to go", () => {
    expect(canAdvance(at("submitted"))).toBe(true);
    expect(canAdvance(at("active"))).toBe(false);
    expect(canAdvance(at("interview", "rejected"))).toBe(false);
    expect(canAdvance(at("interview", "withdrawn"))).toBe(false);
  });

  // Stopping a rental that is already running is a termination, which is another feature.
  it("stops an open process at any stage except the rental in course", () => {
    expect(canClose(at("submitted"))).toBe(true);
    expect(canClose(at("first_payment"))).toBe(true);
    expect(canClose(at("active"))).toBe(false);
    expect(canClose(at("interview", "rejected"))).toBe(false);
  });
});

describe("closedAtLabel", () => {
  it("says nothing while the process is open", () => {
    expect(closedAtLabel(at("interview"))).toBeNull();
  });

  // "Rejected at the interview" and "rejected on arrival" are different stories.
  it("keeps the stage it stopped at", () => {
    expect(closedAtLabel(at("interview", "rejected"))).toBe(
      'Rechazada en la etapa "Entrevista con el propietario"',
    );
    expect(closedAtLabel(at("submitted", "withdrawn"))).toBe(
      'Retirada en la etapa "Postulación recibida"',
    );
  });
});

describe("applicationBlocker", () => {
  const listing = { landlordUid: "landlord", status: "available" };

  it("lets a stranger apply to an available listing", () => {
    expect(applicationBlocker(listing, "tenant", null)).toBeNull();
  });

  it("does not let a landlord apply to their own listing", () => {
    expect(applicationBlocker(listing, "landlord", null)).toBe("own_property");
  });

  it("refuses a listing that is not published", () => {
    expect(applicationBlocker({ ...listing, status: "rented" }, "tenant", null)).toBe("not_available");
    expect(applicationBlocker({ ...listing, status: "draft" }, "tenant", null)).toBe("not_available");
  });

  // A second live application would split the conversation in two.
  it("refuses a second application while one is open", () => {
    expect(applicationBlocker(listing, "tenant", { status: "open" })).toBe("already_applied");
  });

  /*
   * A rejection is final: the landlord looked at this person and said no. Offering the form
   * again offers the same answer with extra steps — and the first version did worse, offering
   * the button and refusing on submit.
   */
  it("refuses again after a rejection", () => {
    expect(applicationBlocker(listing, "tenant", { status: "rejected" })).toBe("rejected_before");
  });

  /*
   * A withdrawal is not. The tenant stopped it themselves, and locking them out for changing
   * their mind would be punishing them for using the button we gave them.
   */
  it("lets someone who withdrew apply again", () => {
    expect(applicationBlocker(listing, "tenant", { status: "withdrawn" })).toBeNull();
  });

  // Order matters: their own property is the answer even if everything else is also wrong.
  it("reports the owner first when several things are wrong", () => {
    expect(applicationBlocker({ ...listing, status: "rented" }, "landlord", { status: "open" })).toBe(
      "own_property",
    );
  });
});
