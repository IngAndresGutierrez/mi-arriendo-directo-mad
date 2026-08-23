import { describe, expect, it } from "vitest";

import {
  contractBlocker,
  contractBlockerMessage,
  contractFileProblem,
  contractState,
  isPdfContract,
  CONTRACT_MAX_BYTES,
  CONTRACT_PROVIDER,
  type SignedContract,
} from "./contract";

const SIGNED: SignedContract = {
  path: "contracts/abc123/contrato-firmado.pdf",
  fileName: "contrato-firmado.pdf",
  contentType: "application/pdf",
  bytes: 120_000,
  uploadedAt: "2026-09-20T15:00:00.000Z",
  note: "",
};

describe("contractState", () => {
  it("is `none` with nothing uploaded", () => {
    expect(contractState(null)).toBe("none");
  });

  it("is `signed` once the file is there", () => {
    expect(contractState(SIGNED)).toBe("signed");
  });

  /*
   * A record without a file is not a signature. It would come from a half-written document, and
   * treating it as signed is how the stage advances with nothing in it.
   */
  it("is `none` for a record whose file is missing", () => {
    expect(contractState({ ...SIGNED, path: "" })).toBe("none");
  });
});

describe("contractBlocker", () => {
  it("blocks until the signed file is uploaded", () => {
    expect(contractBlocker(null)).toBe("not_uploaded");
    expect(contractBlocker({ ...SIGNED, path: "" })).toBe("not_uploaded");
  });

  it("lets the process through once it is", () => {
    expect(contractBlocker(SIGNED)).toBeNull();
  });

  it("says whose move it is, on each side", () => {
    expect(contractBlockerMessage("not_uploaded", true)).toMatch(/Sube el contrato firmado/);
    expect(contractBlockerMessage("not_uploaded", false)).toMatch(/El propietario subirá/);
  });

  it("says nothing when nothing blocks", () => {
    expect(contractBlockerMessage(null, true)).toBeNull();
  });
});

describe("isPdfContract", () => {
  it("tells a PDF from a photo of a signed page", () => {
    expect(isPdfContract({ contentType: "application/pdf" })).toBe(true);
    expect(isPdfContract({ contentType: "image/jpeg" })).toBe(false);
  });
});

describe("contractFileProblem", () => {
  it("accepts the PDF ZapSign gives back", () => {
    expect(contractFileProblem({ type: "application/pdf", size: 200_000 })).toBeNull();
  });

  /* Someone who printed, signed and photographed the contract has a real document. */
  it("accepts a photo of the signed contract", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(contractFileProblem({ type, size: 200_000 })).toBeNull();
    }
  });

  it("refuses anything else, whatever it is called", () => {
    expect(contractFileProblem({ type: "application/zip", size: 1000 })).toMatch(/PDF/);
    expect(contractFileProblem({ type: "text/html", size: 1000 })).toMatch(/PDF/);
    expect(contractFileProblem({ type: "", size: 1000 })).toMatch(/PDF/);
  });

  it("refuses an empty file", () => {
    expect(contractFileProblem({ type: "application/pdf", size: 0 })).toMatch(/vacío/);
  });

  it("refuses one over the ceiling, and accepts one exactly at it", () => {
    expect(contractFileProblem({ type: "application/pdf", size: CONTRACT_MAX_BYTES + 1 })).toMatch(/8 MB/);
    expect(contractFileProblem({ type: "application/pdf", size: CONTRACT_MAX_BYTES })).toBeNull();
  });
});

describe("CONTRACT_PROVIDER", () => {
  /* The free tier is the landlord's own, and the copy promises this number. */
  it("names the free tier the panel tells the landlord to use", () => {
    expect(CONTRACT_PROVIDER.freeMonthlyDocuments).toBe(5);
    expect(CONTRACT_PROVIDER.name).toBe("ZapSign");
  });
});
