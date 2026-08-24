import { describe, expect, it } from "vitest";

import { soundEnabledFrom } from "./chime";

describe("soundEnabledFrom", () => {
  it("is on before anybody has chosen", () => {
    expect(soundEnabledFrom(null)).toBe(true);
  });

  it("is off only when it was turned off", () => {
    expect(soundEnabledFrom("off")).toBe(false);
    expect(soundEnabledFrom("on")).toBe(true);
  });

  it("stays on for a value it does not recognise", () => {
    // A bell silenced by a corrupted key is a bell nobody can turn back on from the panel it
    // silenced. Erring the other way is a sound somebody can switch off in one click.
    expect(soundEnabledFrom("")).toBe(true);
    expect(soundEnabledFrom("OFF")).toBe(true);
    expect(soundEnabledFrom("{}")).toBe(true);
  });
});
