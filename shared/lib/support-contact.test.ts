import { describe, expect, it } from "vitest";

import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_E164,
  supportEmailUrl,
  supportWhatsAppDisplay,
  supportWhatsAppUrl,
} from "./support-contact";

describe("supportWhatsAppUrl", () => {
  it("strips the plus: wa.me takes digits only", () => {
    expect(supportWhatsAppUrl()).toMatch(/^https:\/\/wa\.me\/34656724435\?text=/);
  });

  it("percent-encodes the message, accents and punctuation included", () => {
    const url = supportWhatsAppUrl("¿Cómo pago mi arriendo?");

    expect(url).toContain("text=%C2%BFC%C3%B3mo%20pago%20mi%20arriendo%3F");
    // An unencoded "?" or "&" would end the parameter and truncate the draft.
    expect(url.split("?text=")[1]).not.toMatch(/[?&\s]/);
  });

  it("opens with a greeting short enough to send as it is", () => {
    const message = decodeURIComponent(supportWhatsAppUrl().split("text=")[1] ?? "");

    expect(message).toContain("miarriendoDIRECTO");
    expect(message.length).toBeLessThanOrEqual(60);
  });
});

describe("supportEmailUrl", () => {
  it("addresses the support inbox with a subject already filled in", () => {
    expect(supportEmailUrl()).toBe(
      `mailto:${SUPPORT_EMAIL}?subject=Soporte%20miarriendoDIRECTO`,
    );
  });

  it("encodes a subject a caller passes in", () => {
    expect(supportEmailUrl("Duda sobre mi contrato & mis pagos")).toContain(
      "subject=Duda%20sobre%20mi%20contrato%20%26%20mis%20pagos",
    );
  });
});

describe("supportWhatsAppDisplay", () => {
  it("groups the number the way it is read out loud", () => {
    expect(supportWhatsAppDisplay()).toBe("+34 656 724 435");
  });

  it("shows every digit of the stored number", () => {
    expect(supportWhatsAppDisplay().replace(/\D/g, "")).toBe(
      SUPPORT_WHATSAPP_E164.replace(/\D/g, ""),
    );
  });
});
