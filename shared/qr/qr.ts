/**
 * A QR code, as data rather than as a picture.
 *
 * This is `shared/` and not `features/property/` on purpose: encoding a string into a matrix of
 * black and white squares is not a fact about renting a flat. It sits beside `shared/geo` and
 * `shared/phone` — a cross-cutting encoding with no domain of its own.
 *
 * The module answers in two steps, and the split is what makes it testable. `qrMatrix` produces
 * the modules and nothing else, so a unit test can decode them back and assert the code says what
 * it was asked to say; `qrSvg` draws that matrix, and a test can count what it drew. A single
 * "give me a PNG" function would have been one opaque blob that no assertion can look inside — and
 * a QR code that does not scan is the failure nobody notices until somebody is standing in front
 * of a wall with their phone out.
 */
import qrcode from "qrcode-generator";

/**
 * **UTF-8, because the library's default silently truncates.**
 *
 * `qrcode.stringToBytes` ships as `charCodeAt(i) & 0xff`, which turns every character above U+00FF
 * into a different byte rather than into an error. Today's payload is a URL made of a hostname and
 * a slug, so it is ASCII and the difference does not show — which is exactly the shape of a bug
 * that waits for the first accented character to reach it. Replacing the function is how the
 * library itself is meant to be configured; `qrcode_UTF8.js` in the same package does this and
 * nothing else, with a lookup table this does not need.
 */
qrcode.stringToBytes = (value: string): number[] => Array.from(new TextEncoder().encode(value));

/**
 * Four modules of white on every side, which is the minimum the spec asks for.
 *
 * It is not decoration and it is not padding that a layout may trim: a scanner finds the code by
 * looking for the quiet zone, so a QR printed flush against a coloured panel is a QR that does not
 * read. It is part of the drawing, which is why it lives here rather than in the poster's CSS.
 */
export const QR_QUIET_ZONE = 4;

/**
 * `Q` — 25% of the code can be lost and it still reads.
 *
 * One level for every use, and this is the one that suits the worse of the two: a sheet of paper
 * taped to a wall gets sun, rain off a doorway, a corner torn off and a strip of tape across it.
 * `M` (15%) is the usual default and would be enough for a code on a screen, but two levels would
 * mean two different codes for one listing, and the day they differ is the day the printed one is
 * the wrong one. The extra density costs nothing at the sizes these are drawn at.
 */
const ERROR_CORRECTION = "Q";

/** The modules of a code: `true` is dark. Square, `size` per side, without the quiet zone. */
export type QrMatrix = {
  readonly size: number;
  readonly modules: readonly (readonly boolean[])[];
};

/**
 * The matrix for a string, at the smallest version that fits it.
 *
 * `0` asks the library to pick the version, which is what keeps a short URL from being drawn as a
 * needlessly dense code. Byte mode: the payload is a URL, and alphanumeric mode does not cover
 * lowercase letters.
 */
export function qrMatrix(text: string): QrMatrix {
  if (text.length === 0) throw new Error("qrMatrix: refusing to encode an empty string");

  const code = qrcode(0, ERROR_CORRECTION);
  code.addData(text, "Byte");
  code.make();

  const size = code.getModuleCount();
  const modules = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => code.isDark(row, column)),
  );

  return { size, modules };
}

/** The side of the drawing in modules: the code plus its quiet zone on both sides. */
export function qrTotalModules(matrix: QrMatrix): number {
  return matrix.size + QR_QUIET_ZONE * 2;
}

/**
 * The largest whole number of pixels per module that fits in `target`, as a total side.
 *
 * **A QR drawn at a size that is not a multiple of its module count is a QR whose modules are not
 * all the same width.** The rasteriser has to put a 7.3-pixel square somewhere, and it does it by
 * rounding some rows up and some down — which at small sizes merges two adjacent modules into one.
 * Snapping down to a multiple costs a few pixels of the space allotted and buys a code where every
 * module is identical, which is what a scanner is looking for.
 */
export function qrRenderSize(matrix: QrMatrix, target: number): number {
  const total = qrTotalModules(matrix);

  return Math.max(1, Math.floor(target / total)) * total;
}

/**
 * The code as an SVG document, white background included.
 *
 * The background is drawn rather than inherited, and that is the whole reason this returns a
 * complete document instead of a path: the poster's panel is brand purple, and a code whose
 * "white" is whatever is behind it is a code that does not scan. Same for the quiet zone, which is
 * part of the background rect.
 *
 * One `<path>` for every dark module rather than one `<rect>` each: a version-6 code is over a
 * thousand modules, and a thousand elements is a document satori has to lay out one at a time.
 */
export function qrSvg(matrix: QrMatrix, pixels: number): string {
  const total = qrTotalModules(matrix);
  const parts: string[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.modules[row]?.[column]) {
        parts.push(`M${column + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="#FFFFFF"/>`,
    `<path d="${parts.join("")}" fill="#000000"/>`,
    `</svg>`,
  ].join("");
}

/**
 * The same drawing as a data URI, which is the only form satori accepts.
 *
 * Base64 rather than a percent-encoded UTF-8 payload: the document holds `#` and `"`, both of
 * which end a `src` attribute early, and one of them ends it *silently* — as a fragment.
 */
export function qrSvgDataUri(matrix: QrMatrix, pixels: number): string {
  return `data:image/svg+xml;base64,${Buffer.from(qrSvg(matrix, pixels), "utf8").toString("base64")}`;
}
