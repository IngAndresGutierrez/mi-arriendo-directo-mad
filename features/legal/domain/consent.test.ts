import { describe, expect, it } from "vitest";

import {
  consentIsCurrent,
  latestConsent,
  needsReconsent,
  normalizeConsentVersion,
  pendingConsents,
  withLegacyConsent,
  type ConsentRecord,
} from "./consent";
import {
  CONSENT_KINDS,
  LEGAL_DOCUMENTS,
  type ConsentKind,
  type LegalDocument,
} from "@/shared/legal/documents";

function granted(
  kind: ConsentKind,
  version: number,
  grantedAt = "2026-08-24T12:00:00.000Z",
): ConsentRecord {
  return { id: `${kind}-${version}`, kind, version, grantedAt, ip: null, userAgent: null };
}

/** What onboarding writes today: both documents, at the version in force. */
function fullConsent(): readonly ConsentRecord[] {
  return CONSENT_KINDS.map((kind) => granted(kind, LEGAL_DOCUMENTS[kind].version));
}

describe("normalizeConsentVersion", () => {
  /*
   * A consent stored before consents were versioned is not corrupt: it is an authorisation to
   * version 1, which is what was in force when it was given.
   */
  it("reads an absent version as the first one", () => {
    expect(normalizeConsentVersion(undefined)).toBe(1);
    expect(normalizeConsentVersion(null)).toBe(1);
  });

  it("rejects anything that is not a positive integer", () => {
    expect(normalizeConsentVersion("2")).toBe(1);
    expect(normalizeConsentVersion(0)).toBe(1);
    expect(normalizeConsentVersion(-3)).toBe(1);
    expect(normalizeConsentVersion(1.5)).toBe(1);
  });

  it("keeps a real version", () => {
    expect(normalizeConsentVersion(4)).toBe(4);
  });
});

describe("latestConsent", () => {
  it("is null when there is nothing for that document", () => {
    expect(latestConsent([], "terms")).toBeNull();
    expect(latestConsent([granted("privacy", 1)], "terms")).toBeNull();
  });

  it("prefers the highest version over the latest date", () => {
    const older = granted("terms", 2, "2026-01-01T00:00:00.000Z");
    const newer = granted("terms", 1, "2026-08-01T00:00:00.000Z");

    expect(latestConsent([newer, older], "terms")?.version).toBe(2);
  });

  it("breaks a tie on the version by taking the latest", () => {
    const first = granted("terms", 1, "2026-01-01T00:00:00.000Z");
    const second = granted("terms", 1, "2026-08-01T00:00:00.000Z");

    expect(latestConsent([first, second], "terms")?.grantedAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("needsReconsent", () => {
  it("is true for somebody who never authorised", () => {
    for (const kind of CONSENT_KINDS) {
      expect(needsReconsent([], kind)).toBe(true);
    }
  });

  it("is false once the version in force has been authorised", () => {
    const records = fullConsent();

    for (const kind of CONSENT_KINDS) {
      expect(needsReconsent(records, kind)).toBe(false);
    }
  });

});

/**
 * **The distinction the whole design rests on**, and the one that is easy to lose: Decreto 1074
 * art. 2.2.2.25.2.5 requires a fresh authorisation when the *finalidad* changes, not when a
 * sentence is reworded. These cases are not true of the documents in force today, which is
 * exactly why the comparator takes the document instead of reading it.
 */
describe("consentIsCurrent", () => {
  const reworded: LegalDocument = {
    kind: "terms",
    version: 3,
    reconsentFrom: 1,
    effectiveDate: "2026-09-01",
  };
  const repurposed: LegalDocument = { ...reworded, reconsentFrom: 3 };

  it("never counts an absent authorisation", () => {
    expect(consentIsCurrent(null, reworded)).toBe(false);
  });

  it("keeps an old authorisation valid across a version bump that only reworded the text", () => {
    expect(consentIsCurrent(granted("terms", 1), reworded)).toBe(true);
  });

  it("voids it when the finalidad changed", () => {
    expect(consentIsCurrent(granted("terms", 1), repurposed)).toBe(false);
    expect(consentIsCurrent(granted("terms", 2), repurposed)).toBe(false);
  });

  it("accepts the exact version the floor sits on", () => {
    expect(consentIsCurrent(granted("terms", 3), repurposed)).toBe(true);
  });

  /* Somebody who authorised a *newer* version than the floor is not owed a second ask. */
  it("accepts anything above the floor", () => {
    expect(consentIsCurrent(granted("terms", 9), repurposed)).toBe(true);
  });
});

describe("pendingConsents", () => {
  it("lists every document still owed", () => {
    expect(pendingConsents([])).toEqual([...CONSENT_KINDS]);
  });

  it("is empty for somebody fully up to date", () => {
    expect(pendingConsents(fullConsent())).toEqual([]);
  });
});

/*
 * Every account created before this module has one `termsAcceptedAt` and no consent documents at
 * all. Reading that as nothing would tell a consenting user they had never consented.
 */
describe("withLegacyConsent", () => {
  const legacy = "2026-03-01T10:00:00.000Z";

  it("supplies both documents from the single timestamp onboarding used to write", () => {
    const records = withLegacyConsent([], legacy);

    for (const kind of CONSENT_KINDS) {
      const consent = latestConsent(records, kind);
      expect(consent?.version).toBe(1);
      expect(consent?.grantedAt).toBe(legacy);
    }
  });

  it("changes nothing for an account that never accepted anything", () => {
    expect(withLegacyConsent([], null)).toEqual([]);
  });

  /* A real record must win: otherwise a fresh authorisation would be shadowed by the old field. */
  it("does not synthesise a kind that already has a real record", () => {
    const real = granted("terms", 2, "2026-08-20T00:00:00.000Z");
    const records = withLegacyConsent([real], legacy);

    expect(latestConsent(records, "terms")).toEqual(real);
    expect(latestConsent(records, "privacy")?.grantedAt).toBe(legacy);
  });
});
