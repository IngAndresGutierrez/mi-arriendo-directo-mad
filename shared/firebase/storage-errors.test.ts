import { describe, expect, it } from "vitest";

import { storageErrorMessage } from "./storage-errors";

describe("storageErrorMessage", () => {
  /*
   * El caso que existe por un fallo real: reglas sin desplegar para la ruta. Antes caía en la frase
   * genérica y mandaba a revisar la conexión, que es el único sitio donde no estaba el problema.
   */
  it("does NOT blame the connection for a permissions error", () => {
    const message = storageErrorMessage({ code: "storage/unauthorized" });

    expect(message).toMatch(/permiso/i);
    expect(message).not.toMatch(/conexi[óo]n/i);
  });

  it("says the session expired when the web SDK has no session", () => {
    expect(storageErrorMessage({ code: "storage/unauthenticated" })).toMatch(/sesi[óo]n/i);
  });

  /** El único caso en el que la conexión *es* la respuesta. */
  it("blames the connection only when the upload really kept failing", () => {
    expect(storageErrorMessage({ code: "storage/retry-limit-exceeded" })).toMatch(/conexi[óo]n/i);
  });

  it("falls back for anything it does not know, without leaking the code", () => {
    for (const thrown of [
      new Error("boom"),
      { code: "storage/something-new" },
      "a string",
      null,
      undefined,
    ]) {
      const message = storageErrorMessage(thrown);
      expect(message).toMatch(/No pudimos subir el archivo/);
      expect(message).not.toMatch(/storage\//);
    }
  });
});
