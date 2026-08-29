/**
 * Text as a PDF standard font can draw it.
 *
 * `StandardFonts.Helvetica` encodes WinAnsi. Verified against `pdf-lib` rather than assumed:
 * Spanish accents and the bullet used to mask an email **are** encodable, but anything outside
 * that range is not — and the failure surfaces at `pdf.save()`, not at `drawText`, so it would
 * come from the line that writes the file rather than the line with the bad character in it.
 *
 * What realistically arrives here is an emoji in a property title or somebody's display name:
 * `WinAnsi cannot encode "🎉" (0x1f389)`. That must not be what stops the one document in this
 * whole process a court would ask for from being generated.
 *
 * The bullet is still folded to `*`, for a different and smaller reason: it renders as a lump in
 * Helvetica at 7pt and the masked value reads better with an asterisk.
 *
 * Pure and here rather than beside the stamping so it can be tested without a PDF.
 *
 * **In `shared/` and no longer inside `features/application`**, because the second caller arrived:
 * the tenancy generates the rent receipt and the paz y salvo, and "what a standard PDF font can
 * draw" is not a fact about a rental application. Two domains needing it is exactly the rule that
 * decides where a module lives — and the alternative was `features/lease` reaching into another
 * feature's internals, which eslint refuses for good reason.
 */
export function drawableText(value: string): string {
  return value.replace(/[•·]/g, "*").replace(/[^\x20-\xFF]/g, "?");
}

/**
 * Breaks a sentence into lines of at most `columns` characters.
 *
 * By hand because a PDF page has no layout engine: the clause is one long sentence and drawing it
 * as one line would run it off the paper.
 */
export function wrapText(text: string, columns: number): readonly string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current && `${current} ${word}`.length > columns) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines;
}
