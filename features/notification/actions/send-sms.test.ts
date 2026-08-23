import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendSms } from "./send-sms";

const CODE = "418362";
const BODY = `${CODE} es tu código para firmar. No lo compartas.`;

describe("sendSms sin Twilio configurado", () => {
  const original = { ...process.env };
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("no envía y lo dice", async () => {
    expect(await sendSms({ to: "+573001234567", body: BODY })).toBe(false);
    expect(info).toHaveBeenCalled();
  });

  /*
   * Lo que de verdad importa aquí. El remitente de correo registra su asunto para poder ejercitar el
   * flujo en local, y eso está bien porque un asunto es una línea de copy. Aquí el cuerpo lleva el
   * código: un log que lo escriba convierte cualquiera con acceso a los logs en alguien que puede
   * firmar un contrato.
   */
  it("nunca escribe el código en el log", async () => {
    await sendSms({ to: "+573001234567", body: BODY });
    const escrito = info.mock.calls.flat().join(" ");
    expect(escrito).not.toContain(CODE);
    expect(escrito).not.toContain(BODY);
  });

  it("ni el número completo, solo los últimos cuatro", async () => {
    await sendSms({ to: "+573001234567", body: BODY });
    const escrito = info.mock.calls.flat().join(" ");
    expect(escrito).not.toContain("3001234567");
    expect(escrito).toContain("4567");
  });

  /* Un canal a medio configurar es el que falla justo cuando alguien lo elige. */
  it("con credenciales incompletas tampoco envía", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secreto";
    // Falta el número de origen.
    expect(await sendSms({ to: "+573001234567", body: BODY })).toBe(false);
  });
});
