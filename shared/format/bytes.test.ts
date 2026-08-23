import { describe, expect, it } from "vitest";

import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("keeps small files in bytes", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1023)).toBe("1.023 B");
  });

  it("moves up at 1024, not at 1000", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1000)).toBe("1.000 B");
  });

  it("gives megabytes one decimal, where it starts to matter", () => {
    expect(formatBytes(8 * 1024 * 1024)).toBe("8 MB");
    expect(formatBytes(Math.round(1.5 * 1024 * 1024))).toBe("1,5 MB");
  });

  /* A record whose size was never written must not render "NaN B" on the page. */
  it("survives a missing or nonsense size", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});
