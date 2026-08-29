import { describe, expect, it } from "vitest";
import jsQR from "jsqr";

import { QR_QUIET_ZONE, qrMatrix, qrRenderSize, qrSvg, qrTotalModules, type QrMatrix } from "./qr";

/**
 * The matrix rasterised into the RGBA buffer a decoder reads, at whole pixels per module.
 *
 * This is the poster's own drawing rule applied twice — quiet zone included, one pixel block per
 * module — which is what makes the round trip below mean something about what gets printed rather
 * than about a shape invented for the test.
 */
function raster(matrix: QrMatrix, scale: number): { data: Uint8ClampedArray; side: number } {
  const side = qrTotalModules(matrix) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.modules[row]?.[column]) continue;

      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const px = (column + QR_QUIET_ZONE) * scale + x;
          const py = (row + QR_QUIET_ZONE) * scale + y;
          const at = (py * side + px) * 4;
          data[at] = 0;
          data[at + 1] = 0;
          data[at + 2] = 0;
        }
      }
    }
  }

  return { data, side };
}

function decode(text: string): string | null {
  const { data, side } = raster(qrMatrix(text), 4);

  return jsQR(data, side, side)?.data ?? null;
}

describe("qrMatrix", () => {
  /**
   * **The only assertion that can tell a QR code from a grid of squares.**
   *
   * Everything else about this module — the module count, the finder patterns, the shape of the
   * path — is true of a code that encodes the wrong string just as much as of one that encodes the
   * right one. Reading it back with an independent decoder is what says the thing printed on a
   * wall actually opens the listing, and it is the reason `jsqr` is a devDependency.
   */
  it("encodes a URL that decodes back to itself", () => {
    const url = "https://www.miarriendodirecto.com/inmuebles/apartaestudio-en-los-alcazares-manizales";

    expect(decode(url)).toBe(url);
  });

  /** The English side of the catalogue carries a prefix, and it is part of the payload. */
  it("encodes the prefixed English URL too", () => {
    const url = "https://www.miarriendodirecto.com/en/inmuebles/casa-en-palermo-manizales";

    expect(decode(url)).toBe(url);
  });

  /**
   * The payload today is ASCII, and the guard is here for the day it is not: the library's own
   * `stringToBytes` truncates every character to one byte, so an accent would decode as a
   * different character rather than fail. This is what pins the UTF-8 replacement in `qr.ts`.
   */
  it("survives a payload that is not ASCII", () => {
    const url = "https://www.miarriendodirecto.com/inmuebles/apartamento-en-bogotá";

    expect(decode(url)).toBe(url);
  });

  it("is square, and grows with the payload", () => {
    const short = qrMatrix("https://mad.co/i/a");
    const long = qrMatrix(`https://www.miarriendodirecto.com/inmuebles/${"a-".repeat(60)}manizales`);

    expect(short.modules).toHaveLength(short.size);
    expect(short.modules[0]).toHaveLength(short.size);
    expect(long.size).toBeGreaterThan(short.size);
  });

  it("refuses an empty payload rather than drawing an empty code", () => {
    expect(() => qrMatrix("")).toThrow();
  });
});

describe("qrRenderSize", () => {
  /**
   * The rule this exists for: whatever comes back divides exactly by the module count, so every
   * module is the same number of pixels wide. A code drawn at 350 px over 45 modules gives 7.7,
   * and a rasteriser resolves that by making some modules 7 and some 8 — which merges neighbours.
   */
  it("snaps down to a whole number of pixels per module", () => {
    const matrix = qrMatrix("https://www.miarriendodirecto.com/inmuebles/casa-en-palermo-manizales");
    const total = qrTotalModules(matrix);

    for (const target of [200, 320, 360, 512, 700]) {
      const size = qrRenderSize(matrix, target);

      expect(size % total, `${target} → ${size}`).toBe(0);
      expect(size).toBeLessThanOrEqual(target);
    }
  });

  /** Never zero: a target smaller than the code still has to draw something. */
  it("never collapses to nothing", () => {
    const matrix = qrMatrix("https://www.miarriendodirecto.com/inmuebles/casa");

    expect(qrRenderSize(matrix, 4)).toBe(qrTotalModules(matrix));
  });
});

describe("qrSvg", () => {
  const matrix = qrMatrix("https://www.miarriendodirecto.com/inmuebles/casa-en-palermo-manizales");

  /**
   * The white background is the assertion worth keeping, because losing it is invisible in a
   * review and fatal on the page: the poster's panel is brand purple, and a code with no ground of
   * its own is a code drawn on purple, which no scanner reads.
   */
  it("paints its own white ground over the whole drawing, quiet zone included", () => {
    const svg = qrSvg(matrix, 360);

    expect(svg).toContain(`<rect width="${qrTotalModules(matrix)}" height="${qrTotalModules(matrix)}" fill="#FFFFFF"/>`);
    expect(svg).toContain(`viewBox="0 0 ${qrTotalModules(matrix)} ${qrTotalModules(matrix)}"`);
  });

  /** One subpath per dark module, offset by the quiet zone. Nothing drawn outside it. */
  it("draws exactly the dark modules", () => {
    const dark = matrix.modules.flat().filter(Boolean).length;
    const svg = qrSvg(matrix, 360);

    expect(svg.match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(dark);
    expect(svg).toContain(`M${QR_QUIET_ZONE} ${QR_QUIET_ZONE}h1v1h-1z`);
  });
});
