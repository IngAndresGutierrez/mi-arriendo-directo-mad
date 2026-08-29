import { describe, expect, it } from "vitest";

import { drawableText, wrapText } from "./text";

describe("drawableText", () => {
  it("keeps Spanish accents, which WinAnsi does encode", () => {
    expect(drawableText("Cédula de ciudadanía número")).toBe("Cédula de ciudadanía número");
    expect(drawableText("Marta Gómez Peña")).toBe("Marta Gómez Peña");
  });

  /*
   * El bullet sí es codificable en WinAnsi — se comprobó contra `pdf-lib`, no se supuso. Se cambia
   * por estética: a 7pt se lee como un borrón y el asterisco no.
   */
  it("replaces the mask bullet, which reads badly at 7pt", () => {
    expect(drawableText("ca••••••@ejemplo.test")).toBe("ca******@ejemplo.test");
    expect(drawableText("•••7654")).toBe("***7654");
  });

  /*
   * El que de verdad rompe: `pdf.save()` lanza `WinAnsi cannot encode "🎉" (0x1f389)`, y falla en
   * la línea que escribe el archivo, no en la que tiene el carácter malo. Un emoji en el título de
   * un inmueble o en el nombre de alguien no puede impedir generar el contrato firmado.
   */
  it("folds what WinAnsi cannot encode, which is what makes pdf.save() throw", () => {
    expect(drawableText("emoji 🎉 aquí")).toBe("emoji ?? aquí");
    expect(drawableText("flecha → derecha")).toBe("flecha ? derecha");
    // Un emoji ocupa dos unidades UTF-16, así que sustituye por dos signos.
    expect(drawableText("🎉")).toBe("??");
  });

  it("leaves plain text untouched", () => {
    expect(drawableText("Contrato de arrendamiento")).toBe("Contrato de arrendamiento");
    expect(drawableText("")).toBe("");
  });
});

describe("wrapText", () => {
  it("breaks at the column and keeps every word", () => {
    const lines = wrapText("uno dos tres cuatro cinco seis", 11);
    expect(lines.every((line) => line.length <= 11)).toBe(true);
    expect(lines.join(" ")).toBe("uno dos tres cuatro cinco seis");
  });

  it("does not lose a word longer than the column", () => {
    const lines = wrapText("corto responsabilidadesextraordinarias fin", 10);
    expect(lines.join(" ")).toContain("responsabilidadesextraordinarias");
  });

  it("collapses the whitespace a multi-line constant carries", () => {
    expect(wrapText("  uno   dos  ", 20)).toEqual(["uno dos"]);
  });

  it("gives nothing for nothing", () => {
    expect(wrapText("", 20)).toEqual([]);
    expect(wrapText("   ", 20)).toEqual([]);
  });
});
