import { describe, expect, it } from "vitest";

import {
  countOf,
  documentsBlocker,
  documentsBlockerMessage,
  identitySatisfied,
  identityShape,
  statusOf,
  documentProgress,
  documentsComplete,
  isPdf,
  missingDocuments,
  requiredDocuments,
  type DocumentKind,
  type TenantDocument,
} from "./documents";
import { OCCUPATIONS } from "./tenant-profile";

/** `n` uploads of one kind. */
function uploaded(kind: DocumentKind, n = 1): TenantDocument[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${kind}-${i}`,
    kind,
    path: `applicants/uid/${kind}-${i}.pdf`,
    name: `${kind}-${i}.pdf`,
    contentType: "application/pdf",
    size: 1024,
    uploadedAt: "2026-08-22T12:00:00.000Z",
  }));
}

const identity = [...uploaded("id_front"), ...uploaded("id_back")];

describe("requiredDocuments", () => {
  it("always asks for both sides of the identity document", () => {
    for (const occupation of OCCUPATIONS) {
      const kinds = requiredDocuments(occupation).map((r) => r.kind);
      expect(kinds).toContain("id_front");
      expect(kinds).toContain("id_back");
    }
  });

  /*
   * A scanner gives you one PDF with both faces; a phone gives you two photos. Demanding the
   * second shape from someone holding the first is asking them to split a PDF.
   */
  it("asks for one file instead of two when that is the shape the person has", () => {
    const kinds = requiredDocuments("employee", true).map((r) => r.kind);
    expect(kinds).toContain("id_both");
    expect(kinds).not.toContain("id_front");
    expect(kinds).not.toContain("id_back");
  });

  /*
   * The whole reason the list is derived: a payslip means nothing to someone independent, and
   * asking an employee for a RUT is asking for a document they may not have.
   */
  it("asks each occupation only for what it can produce", () => {
    const kindsFor = (o: Parameters<typeof requiredDocuments>[0]) =>
      requiredDocuments(o).map((r) => r.kind);

    expect(kindsFor("employee")).toEqual(["id_front", "id_back", "employment_letter", "payslip"]);
    expect(kindsFor("self_employed")).toContain("rut");
    expect(kindsFor("self_employed")).not.toContain("payslip");
    expect(kindsFor("business_owner")).toContain("chamber_of_commerce");
    expect(kindsFor("retired")).toEqual([
      "id_front",
      "id_back",
      "pension_certificate",
      "pension_payslip",
    ]);
    // A student has no income document: the co-signer stage is what answers for them.
    expect(kindsFor("student")).toEqual(["id_front", "id_back", "study_certificate"]);
  });

  it("asks for three of the things that come in threes", () => {
    const payslip = requiredDocuments("employee").find((r) => r.kind === "payslip");
    const statements = requiredDocuments("self_employed").find((r) => r.kind === "bank_statement");

    expect(payslip?.count).toBe(3);
    expect(statements?.count).toBe(3);
  });

  // Somebody who does not file taxes has no tax return; blocking on it asks for the impossible.
  it("marks the tax return as optional", () => {
    expect(requiredDocuments("self_employed").find((r) => r.kind === "tax_return")?.optional).toBe(true);
  });
});

describe("the identity document, in either shape", () => {
  it("is satisfied by one file with both faces", () => {
    expect(identitySatisfied(uploaded("id_both"))).toBe(true);
    expect(identityShape(uploaded("id_both"))).toBe("one_file");
  });

  it("is satisfied by the two faces separately", () => {
    expect(identitySatisfied(identity)).toBe(true);
    expect(identityShape(identity)).toBe("two_files");
  });

  it("is not satisfied by one face alone", () => {
    expect(identitySatisfied(uploaded("id_front"))).toBe(false);
    expect(missingDocuments("student", uploaded("id_front")).map((r) => r.kind)).toEqual([
      "id_back",
      "study_certificate",
    ]);
  });

  it("does not ask for the other shape once one is used", () => {
    const single = [...uploaded("id_both"), ...uploaded("study_certificate")];
    expect(missingDocuments("student", single)).toEqual([]);
    expect(documentProgress("student", single)).toEqual({ uploaded: 2, required: 2 });
  });
});

describe("missingDocuments", () => {
  it("lists what is still needed and nothing else", () => {
    const missing = missingDocuments("employee", identity).map((r) => r.kind);
    expect(missing).toEqual(["employment_letter", "payslip"]);
  });

  it("counts partial uploads: two payslips out of three is still missing", () => {
    const almost = [...identity, ...uploaded("employment_letter"), ...uploaded("payslip", 2)];
    expect(missingDocuments("employee", almost).map((r) => r.kind)).toEqual(["payslip"]);

    const done = [...identity, ...uploaded("employment_letter"), ...uploaded("payslip", 3)];
    expect(missingDocuments("employee", done)).toEqual([]);
  });

  it("never asks for an optional one", () => {
    const complete = [...identity, ...uploaded("rut"), ...uploaded("bank_statement", 3)];
    expect(missingDocuments("self_employed", complete)).toEqual([]);
    expect(documentsComplete("self_employed", complete)).toBe(true);
  });

  it("does not count a document of the wrong kind", () => {
    const wrong = [...identity, ...uploaded("payslip", 3)];
    expect(missingDocuments("employee", wrong).map((r) => r.kind)).toEqual(["employment_letter"]);
  });
});

describe("documentProgress", () => {
  it("counts files, which is what the person is holding", () => {
    expect(documentProgress("employee", [])).toEqual({ uploaded: 0, required: 6 });
    expect(documentProgress("employee", identity)).toEqual({ uploaded: 2, required: 6 });
    expect(documentProgress("student", [])).toEqual({ uploaded: 0, required: 3 });
  });

  // Four payslips do not make the bar say 7 of 6.
  it("does not count more than was asked for", () => {
    const extra = [...identity, ...uploaded("employment_letter"), ...uploaded("payslip", 5)];
    expect(documentProgress("employee", extra)).toEqual({ uploaded: 6, required: 6 });
  });
});

describe("countOf / isPdf", () => {
  it("counts by kind", () => {
    expect(countOf(uploaded("payslip", 3), "payslip")).toBe(3);
    expect(countOf(uploaded("payslip", 3), "rut")).toBe(0);
  });

  it("tells a PDF from an image, which decides how it is previewed", () => {
    expect(isPdf({ contentType: "application/pdf" })).toBe(true);
    expect(isPdf({ contentType: "image/jpeg" })).toBe(false);
  });
});

describe("documentsBlocker", () => {
  const complete = [...identity, ...uploaded("study_certificate")];
  const approved = Object.fromEntries(
    complete.map((d) => [d.id, { status: "approved" as const, note: "", at: "2026-08-22T12:00:00.000Z" }]),
  );

  it("clears only when everything is uploaded and approved", () => {
    expect(documentsBlocker("student", complete, approved)).toBeNull();
  });

  // The order matters: uploading is what has to happen first, so it is what gets reported first.
  it("reports the missing ones before anything else", () => {
    expect(documentsBlocker("student", identity, {})).toEqual({ reason: "missing", count: 1 });
  });

  it("reports a rejection before an unreviewed one", () => {
    const mixed = {
      ...approved,
      [complete[0]!.id]: { status: "rejected" as const, note: "Ilegible", at: "2026-08-22T12:00:00.000Z" },
      [complete[1]!.id]: { status: "pending" as const, note: "", at: "2026-08-22T12:00:00.000Z" },
    };
    expect(documentsBlocker("student", complete, mixed)).toEqual({ reason: "rejected", count: 1 });
  });

  /*
   * A document nobody has looked at is not approved. This is the distinction the gate on
   * "Continuar" leans on: uploaded is not the same as accepted.
   */
  it("treats an unseen document as unreviewed, not as approved", () => {
    expect(statusOf({}, "whatever")).toBe("pending");
    expect(documentsBlocker("student", complete, {})).toEqual({ reason: "unreviewed", count: 3 });
  });
});

describe("documentsBlockerMessage", () => {
  // The same obstacle is a different instruction depending on who has to act on it.
  it("tells each side what *they* have to do", () => {
    const unreviewed = { reason: "unreviewed" as const, count: 2 };
    expect(documentsBlockerMessage(unreviewed, true)).toMatch(/Apruébalos o recházalos/);
    expect(documentsBlockerMessage(unreviewed, false)).toMatch(/está revisando/);

    const missing = { reason: "missing" as const, count: 1 };
    expect(documentsBlockerMessage(missing, true)).toMatch(/El inquilino tiene que/);
    expect(documentsBlockerMessage(missing, false)).toMatch(/Te falta/);
  });

  it("counts in singular and plural", () => {
    expect(documentsBlockerMessage({ reason: "missing", count: 1 }, false)).toMatch(/Te falta 1 documento\b/);
    expect(documentsBlockerMessage({ reason: "missing", count: 3 }, false)).toMatch(/Te faltan 3 documentos/);
  });
});
