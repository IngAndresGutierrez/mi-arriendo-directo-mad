import { describe, expect, it } from "vitest";

import { DEFAULT_NOTIFICATION_PREFERENCES } from "../domain/preferences";
import { notificationPreferencesSchema } from "./preferences";

describe("notificationPreferencesSchema", () => {
  it("accepts the full table", () => {
    expect(notificationPreferencesSchema.safeParse(DEFAULT_NOTIFICATION_PREFERENCES).success).toBe(
      true,
    );
  });

  it("rejects a table missing a category", () => {
    const rest: Record<string, unknown> = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    delete rest.process;

    expect(notificationPreferencesSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a category missing a channel", () => {
    expect(
      notificationPreferencesSchema.safeParse({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        lease: { email: true },
      }).success,
    ).toBe(false);
  });

  it("rejects a string where a boolean belongs", () => {
    // El cliente manda JSON: `"false"` es verdadero en JavaScript, y coercionarlo aquí sería
    // guardar lo contrario de lo que alguien pidió.
    expect(
      notificationPreferencesSchema.safeParse({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        lease: { email: "false", whatsapp: true },
      }).success,
    ).toBe(false);
  });

  it("rejects anything that is not an object", () => {
    for (const value of [null, undefined, "todo", 1, []]) {
      expect(notificationPreferencesSchema.safeParse(value).success).toBe(false);
    }
  });
});
