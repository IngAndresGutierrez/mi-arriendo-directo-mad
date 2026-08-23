import { describe, expect, it } from "vitest";

import { OTP_LENGTH } from "./contract";
import {
  formatCode,
  signatureCodeEmail,
  signatureCodeWhatsAppParameters,
  OTP_MINUTES,
} from "./signature-code";

describe("signatureCodeEmail", () => {
  const input = {
    code: "418362",
    propertyTitle: "Apartamento con balcón en Palermo",
    recipientName: "Carlos Inquilino Ramírez",
  };

  it("puts the code in the subject, so se lee sin abrir el correo", () => {
    expect(signatureCodeEmail(input).subject).toContain("418362");
  });

  it("dice el inmueble, cuánto dura y que solo sirve una vez", () => {
    const { text } = signatureCodeEmail(input);
    expect(text).toContain("Apartamento con balcón en Palermo");
    expect(text).toContain(String(OTP_MINUTES));
    expect(text).toContain("una vez");
  });

  /*
   * Sin enlace, a propósito: una petición de firma que llega con un botón que pulsar es
   * indistinguible del phishing que enseñaría a aceptar. La persona ya está en la página.
   */
  it("no lleva ningún enlace", () => {
    const { text, html } = signatureCodeEmail(input);
    expect(text).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<a\s/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("dice qué hacer si no fuiste tú", () => {
    expect(signatureCodeEmail(input).text).toMatch(/Si no fuiste tú/);
  });

  /* El título del inmueble lo escribe un usuario. */
  it("escapa el HTML del título y del nombre", () => {
    const { html } = signatureCodeEmail({
      ...input,
      propertyTitle: '<script>alert("x")</script>',
      recipientName: "Ana <b>Pérez</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>Pérez</b>");
  });

  it("sobrevive un nombre vacío sin dejar un saludo roto", () => {
    const { text } = signatureCodeEmail({ ...input, recipientName: "" });
    expect(text.startsWith("Hola,")).toBe(true);
  });
});

describe("signatureCodeWhatsAppParameters", () => {
  it("pasa el inmueble y el código, en ese orden", () => {
    expect(
      signatureCodeWhatsAppParameters({ code: "418362", propertyTitle: "Casa en Laureles" }),
    ).toEqual(["Casa en Laureles", "418362"]);
  });
});

describe("formatCode", () => {
  it("siempre da la longitud esperada, rellenando con ceros", () => {
    expect(formatCode(7)).toBe("7".padStart(OTP_LENGTH, "0"));
    expect(formatCode(7)).toHaveLength(OTP_LENGTH);
    expect(formatCode(0)).toBe("0".repeat(OTP_LENGTH));
  });

  /* Un entero grande no debe producir un código más largo que lo que el formulario acepta. */
  it("recorta un número mayor que la longitud del código", () => {
    expect(formatCode(123456789)).toHaveLength(OTP_LENGTH);
    expect(formatCode(Number.MAX_SAFE_INTEGER)).toHaveLength(OTP_LENGTH);
  });

  it("solo produce dígitos", () => {
    for (const value of [0, 1, 999999, 1000000, 987654321]) {
      expect(formatCode(value)).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    }
  });
});
