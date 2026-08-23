/**
 * A file size a person can read, in es-CO.
 *
 * Binary units (1024), because that is what an operating system shows for the same file: telling
 * somebody their 8 MB document is 8.4 MB because we divided by 1000 is a discrepancy they cannot
 * explain and will not trust.
 */
const UNITS = ["B", "KB", "MB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Whole bytes and whole kilobytes; one decimal from megabytes up, where it starts to matter.
  const decimals = unit < 2 ? 0 : 1;

  return `${value.toLocaleString("es-CO", { maximumFractionDigits: decimals })} ${UNITS[unit]}`;
}
